import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import ws from 'ws';
import { PrismaService } from '../prisma/prisma.service';

/** Every bucket this store writes to. */
export const MEDIA_BUCKETS = ['hero-banners', 'products', 'review-media', 'lab-reports'] as const;

export interface OrphanReport {
  bucket: string;
  name: string;
  sizeBytes: number;
  createdAt: string | null;
}

export interface SweepResult {
  checked: number;
  referenced: number;
  orphans: number;
  deleted: number;
  bytesFreed: number;
  dryRun: boolean;
  skippedTooRecent: number;
  details: OrphanReport[];
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * No fallback URL, deliberately.
   *
   * This used to default to the production project when SUPABASE_URL was
   * unset. A dev deployment that forgot the variable therefore uploaded into
   * production's buckets — and because this service deletes the previous file
   * whenever an image is replaced, editing a product on dev could destroy a
   * production image. Silently writing to production is never the safer
   * default; doing nothing and saying so is.
   */
  private getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Object storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). ' +
          'Uploads and deletes are disabled rather than aimed at another project.',
      );
      return null;
    }

    if (supabaseUrl && supabaseKey) {
      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: {
          // supabase-js types this as the browser WebSocket; on Node we pass
          // the ws implementation, which is structurally compatible.
          transport: ws as unknown as typeof WebSocket,
        },
      });
    }
    return null;
  }

  /**
   * Splits a stored URL into its bucket and object path.
   *
   * Returns null for anything that is not ours to delete — a seed placeholder
   * under /images/, or an absolute URL on someone else's host.
   */
  private parseStoragePath(url: string): { bucket: string; filePath: string } | null {
    let relative = url;

    if (relative.includes('/storage/v1/object/public/')) {
      relative = '/' + relative.split('/storage/v1/object/public/')[1];
    }

    if (!relative.startsWith('/')) return null;

    const parts = relative.substring(1).split('/');
    if (parts.length < 2) return null;

    const [bucket, ...rest] = parts;
    if (!(MEDIA_BUCKETS as readonly string[]).includes(bucket)) return null;

    return { bucket, filePath: rest.join('/') };
  }

  /**
   * Deletes a stored file from Supabase Storage or local disk.
   *
   * The bucket is read from the path rather than matched against a hardcoded
   * pair. It used to accept only /hero-banners/ and /products/, so every
   * review attachment and every lab report PDF this was asked to remove was
   * silently kept — and paid for.
   */
  async deleteMediaFile(imageUrl?: string | null): Promise<boolean> {
    if (!imageUrl) return false;

    // Seed placeholders and third-party URLs are not ours to remove.
    if (imageUrl.startsWith('/images/') || imageUrl.includes('images.unsplash.com')) {
      return false;
    }

    try {
      if (imageUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), imageUrl);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          this.logger.log(`[Media] Removed local file ${imageUrl}`);
          return true;
        }
        return false;
      }

      const parsed = this.parseStoragePath(imageUrl);
      if (!parsed) return false;

      const supabase = this.getSupabaseClient();
      if (!supabase) return false;

      const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.filePath]);

      if (error) {
        this.logger.warn(
          `[Media] Could not remove ${parsed.bucket}/${parsed.filePath}: ${error.message}`,
        );
        return false;
      }

      this.logger.log(`[Media] Removed ${parsed.bucket}/${parsed.filePath}`);
      return true;
    } catch (err) {
      this.logger.warn(`[Media] Exception removing ${imageUrl}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Every storage path the database still points at.
   *
   * Anything in a bucket and not in this set belongs to nothing: a file that
   * was uploaded while someone filled in a form they then abandoned.
   */
  private async collectReferencedPaths(): Promise<Set<string>> {
    const [images, banners, reports, reviews, products] = await Promise.all([
      this.prisma.productImage.findMany({ select: { imageUrl: true, thumbnailUrl: true } }),
      this.prisma.heroBanner.findMany({ select: { imageUrl: true } }),
      this.prisma.labReport.findMany({ select: { fileUrl: true } }),
      this.prisma.productReview.findMany({ select: { mediaUrls: true } }),
      this.prisma.productVariant.findMany({ select: { imageUrl: true } }),
    ]);

    const referenced = new Set<string>();

    const add = (url?: string | null) => {
      if (!url) return;
      const parsed = this.parseStoragePath(url);
      if (parsed) referenced.add(`${parsed.bucket}/${parsed.filePath}`);
    };

    images.forEach((i) => {
      add(i.imageUrl);
      add(i.thumbnailUrl);
    });
    banners.forEach((b) => add(b.imageUrl));
    reports.forEach((r) => add(r.fileUrl));
    reviews.forEach((r) => r.mediaUrls.forEach(add));
    products.forEach((v) => add(v.imageUrl));

    return referenced;
  }

  /**
   * Finds and optionally removes files no row points at.
   *
   * `minAgeHours` is the important argument. A file is uploaded before the
   * form that references it is saved, so anything recent may simply be a
   * half-finished product edit — deleting it would break a save in progress.
   * Nothing younger than this is touched.
   */
  async sweepOrphans(
    options: { dryRun?: boolean; minAgeHours?: number } = {},
  ): Promise<SweepResult> {
    const dryRun = options.dryRun ?? true;
    const minAgeHours = options.minAgeHours ?? 24;
    const cutoff = Date.now() - minAgeHours * 3_600_000;

    const result: SweepResult = {
      checked: 0,
      referenced: 0,
      orphans: 0,
      deleted: 0,
      bytesFreed: 0,
      dryRun,
      skippedTooRecent: 0,
      details: [],
    };

    const supabase = this.getSupabaseClient();
    if (!supabase) {
      this.logger.warn('[Media] Sweep skipped — no Supabase credentials configured');
      return result;
    }

    const referenced = await this.collectReferencedPaths();
    result.referenced = referenced.size;

    for (const bucket of MEDIA_BUCKETS) {
      // Storage list is paginated; walk it rather than trusting one page.
      let offset = 0;
      const pageSize = 100;

      for (;;) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list('', { limit: pageSize, offset, sortBy: { column: 'created_at', order: 'asc' } });

        if (error) {
          this.logger.warn(`[Media] Could not list ${bucket}: ${error.message}`);
          break;
        }
        if (!data || data.length === 0) break;

        const doomed: string[] = [];

        for (const object of data) {
          // list() returns folder entries with no id; skip them.
          if (!object.id) continue;

          result.checked += 1;
          const key = `${bucket}/${object.name}`;
          if (referenced.has(key)) continue;

          const createdAt = object.created_at ? new Date(object.created_at).getTime() : 0;
          if (createdAt && createdAt > cutoff) {
            result.skippedTooRecent += 1;
            continue;
          }

          const size = Number(object.metadata?.size ?? 0);
          result.orphans += 1;
          result.details.push({
            bucket,
            name: object.name,
            sizeBytes: size,
            createdAt: object.created_at ?? null,
          });

          if (!dryRun) {
            doomed.push(object.name);
            result.bytesFreed += size;
          }
        }

        if (doomed.length > 0) {
          const { error: removeError } = await supabase.storage.from(bucket).remove(doomed);
          if (removeError) {
            this.logger.warn(`[Media] Sweep could not remove from ${bucket}: ${removeError.message}`);
            result.bytesFreed -= result.details
              .filter((d) => d.bucket === bucket && doomed.includes(d.name))
              .reduce((sum, d) => sum + d.sizeBytes, 0);
          } else {
            result.deleted += doomed.length;
          }
        }

        if (data.length < pageSize) break;
        offset += pageSize;
      }
    }

    this.logger.log(
      `[Media] Sweep ${dryRun ? '(dry run) ' : ''}checked ${result.checked}, ` +
        `${result.orphans} orphaned, ${result.deleted} removed, ` +
        `${(result.bytesFreed / 1048576).toFixed(1)}MB freed`,
    );

    return result;
  }
}
