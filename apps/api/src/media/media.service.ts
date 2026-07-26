import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import ws from 'ws';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  private getSupabaseClient() {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

    const supabaseUrl = process.env.SUPABASE_URL || 'https://ieugxahinfowtlryyzmv.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (supabaseUrl && supabaseKey) {
      return createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: {
          transport: ws as any,
        },
      });
    }
    return null;
  }

  /**
   * Deletes old media file from Supabase Storage bucket and local disk
   */
  async deleteMediaFile(imageUrl?: string | null) {
    if (!imageUrl) return;

    // Ignore static seed placeholders
    if (imageUrl.startsWith('/images/') || imageUrl.startsWith('http://images.unsplash.com') || imageUrl.startsWith('https://images.unsplash.com')) {
      return;
    }

    try {
      // 1. If Supabase Storage CDN URL (e.g. .../storage/v1/object/public/<bucket>/<path>)
      if (imageUrl.includes('/storage/v1/object/public/')) {
        const parts = imageUrl.split('/storage/v1/object/public/')[1]?.split('/');
        if (parts && parts.length >= 2) {
          const bucket = parts[0];
          const filePath = parts.slice(1).join('/');
          const supabase = this.getSupabaseClient();
          if (supabase) {
            const { error } = await supabase.storage.from(bucket).remove([filePath]);
            if (!error) {
              this.logger.log(`[Media Cleanup] Deleted old file from Supabase Storage: ${bucket}/${filePath}`);
            } else {
              this.logger.warn(`[Media Cleanup Warning] Failed to delete ${bucket}/${filePath}: ${error.message}`);
            }
          }
        }
      }
      // 2. If local server storage path (/uploads/upload-xxx.webp)
      else if (imageUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), imageUrl);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          this.logger.log(`[Media Cleanup] Deleted old local file: ${localPath}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Media Cleanup Exception] Could not delete ${imageUrl}: ${err?.message || err}`);
    }
  }
}
