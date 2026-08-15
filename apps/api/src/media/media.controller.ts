import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

/** The fields we use from a multipart upload; @types/multer is not installed. */
interface UploadedFileInfo {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  filename: string;
}
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { MediaService } from './media.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  ALL_MEDIA_MIME_TYPES,
  extensionFor,
  humanSize,
  maxBytesFor,
  mediaKindFor,
} from './media.constants';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diskStorage } = require('multer');

/**
 * Where an upload lands when object storage is not configured.
 *
 * Creating it must not be fatal. On a hosted container the working directory
 * can belong to root while the process does not, and this ran at module load
 * — so a failure here took the whole API down at boot with EACCES rather than
 * disabling one fallback. Uploads go to Supabase Storage in every deployed
 * environment anyway, and a hosted filesystem is ephemeral, so a local
 * directory is a convenience for development and nothing more.
 */
const uploadDir = path.join(process.cwd(), 'uploads');
let localUploadsAvailable = true;

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  localUploadsAvailable = false;
  // eslint-disable-next-line no-console
  console.warn(
    `[media] Local upload directory unavailable (${(err as Error).message}). ` +
      'Uploads will use object storage.',
  );
}

export { localUploadsAvailable };

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  private getSupabaseClient() {

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
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

  private async ensureBucketExists(supabase: SupabaseClient, bucketName: string) {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === bucketName);
      if (exists) {
        return;
      }
      this.logger.log(`Bucket '${bucketName}' missing. Creating public bucket in Supabase Storage...`);
      const { error } = await supabase.storage.createBucket(bucketName, { public: true });
      if (error) {
        this.logger.warn(`Supabase createBucket warning on '${bucketName}': ${error.message}`);
      } else {
        this.logger.log(`Public bucket '${bucketName}' created successfully in Supabase Storage!`);
      }
    } catch (e) {
      this.logger.warn(`Could not check/create bucket '${bucketName}': ${(e as Error).message}`);
    }
  }

  @Post('upload')
  // Was unauthenticated: anyone could fill the bucket at our expense, and
  // host whatever they liked on our domain. Customers legitimately upload
  // review attachments here, so this is authentication without a role.
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (
          _req: Request,
          file: UploadedFileInfo,
          cb: (err: Error | null, name: string) => void,
        ) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname) || '.webp';
          cb(null, `upload-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: UploadedFileInfo) {
    if (!file) {
      return { success: false, message: 'No file provided' };
    }

    const kind = mediaKindFor(file.mimetype);
    if (!kind) {
      throw new BadRequestException(`Unsupported file type "${file.mimetype}"`);
    }
    if (file.size > maxBytesFor(kind)) {
      const label = { VIDEO: 'Video', DOCUMENT: 'Document', IMAGE: 'Image' }[kind];
      throw new BadRequestException(
        `${label} exceeds the ${humanSize(maxBytesFor(kind))} limit`,
      );
    }

    const supabase = this.getSupabaseClient();
    if (supabase) {
      try {
        await this.ensureBucketExists(supabase, 'hero-banners');
        await this.ensureBucketExists(supabase, 'products');

        const timestamp = Date.now();
        const randomHash = Math.random().toString(36).substring(2, 10);
        const mimeType = file.mimetype || 'image/webp';
        const fileExt =
          (file.originalname && path.extname(file.originalname).toLowerCase()) ||
          extensionFor(mimeType);
        const pathName = `${timestamp}-${randomHash}${fileExt}`;
        const fileBuffer = fs.readFileSync(file.path);

        const { data: sData, error: sErr } = await supabase.storage
          .from('hero-banners')
          .upload(pathName, fileBuffer, {
            // Was hardcoded to image/webp, so an mp4 was served with an image
            // content type and would not play.
            contentType: mimeType,
            upsert: true,
          });

        if (!sErr && sData?.path) {
          const relativeStoragePath = `/hero-banners/${sData.path}`;
          this.logger.log(`[Supabase Storage] File uploaded successfully: ${relativeStoragePath}`);
          return {
            success: true,
            url: relativeStoragePath,
            filename: file.filename,
          };
        }
        if (sErr) {
          this.logger.warn(`[Supabase Storage Upload Warning] ${sErr.message}. Falling back to local server storage.`);
        }
      } catch (err) {
        this.logger.warn(`[Supabase Storage Upload Exception] ${(err as Error).message}`);
      }
    }

    const relativeUrl = `/uploads/${file.filename}`;
    this.logger.log(`File saved locally: ${relativeUrl} (${file.size} bytes)`);
    return {
      success: true,
      url: relativeUrl,
      filename: file.filename,
    };
  }

  @Get('presigned-url')
  @UseGuards(AuthGuard)
  async getPresignedUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @Query('bucket') bucket?: string,
  ) {
    // Reject anything we do not serve, before handing out a signed URL that
    // would let it into the bucket.
    const kind = mediaKindFor(contentType);
    if (!kind) {
      throw new BadRequestException(
        `Unsupported file type "${contentType}". Allowed: ${ALL_MEDIA_MIME_TYPES.join(', ')}`,
      );
    }

    this.logger.log(`Pre-signed upload URL requested: ${filename} (${contentType}, ${kind})`);

    const supabase = this.getSupabaseClient();
    const bucketName = bucket || 'hero-banners';

    // 1. Supabase Object Storage & CDN Flow
    if (supabase) {
      try {
        const timestamp = Date.now();
        const randomHash = Math.random().toString(36).substring(2, 10);
        const fileExt =
          (filename && path.extname(filename).toLowerCase()) || extensionFor(contentType);
        const filePath = `${timestamp}-${randomHash}${fileExt}`;
        const relativeStoragePath = `/${bucketName}/${filePath}`;

        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUploadUrl(filePath);

        if (error) {
          this.logger.warn(`Supabase createSignedUploadUrl warning on bucket ${bucketName}: ${error.message}. Attempting bucket creation...`);
          try {
            await supabase.storage.createBucket(bucketName, { public: true });
          } catch (bErr) {
            // Bucket might already exist or policy error
          }
          const retry = await supabase.storage.from(bucketName).createSignedUploadUrl(filePath);
          if (retry.data?.signedUrl) {
            return {
              uploadUrl: retry.data.signedUrl,
              fileUrl: relativeStoragePath,
              method: 'PUT',
            };
          }
        }

        if (data?.signedUrl) {
          this.logger.log(`Generated Supabase Storage pre-signed URL for bucket ${bucketName}: ${filePath}`);
          return {
            uploadUrl: data.signedUrl,
            fileUrl: relativeStoragePath,
            method: 'PUT',
            mediaType: kind,
            maxBytes: maxBytesFor(kind),
          };
        }
      } catch (err) {
        this.logger.warn(`Supabase Storage pre-signed URL warning: ${(err as Error).message}`);
      }
    }

    // 2. Production S3 / Cloudflare R2 / AWS Object Storage Pre-signed URL Flow
    const s3Bucket = process.env.AWS_S3_BUCKET;
    const cdnBase = process.env.CDN_BASE_URL;

    if (s3Bucket && process.env.AWS_ACCESS_KEY_ID) {
      const timestamp = Date.now();
      const cleanFilename = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.webp';
      const key = `uploads/${timestamp}-${cleanFilename}`;
      
      const region = process.env.AWS_REGION || 'ap-south-1';
      const uploadUrl = `https://${s3Bucket}.s3.${region}.amazonaws.com/${key}`;
      const fileUrl = cdnBase ? `${cdnBase}/${key}` : `https://${s3Bucket}.s3.${region}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        fileUrl,
        method: 'PUT',
      };
    }

    // Local Development Fallback Handler
    const port = process.env.PORT || 4000;
    const mockUploadUrl = `http://localhost:${port}/api/media/upload`;
    const mockFileUrl = `/uploads/${Date.now()}-${filename || 'image.webp'}`;

    return {
      uploadUrl: mockUploadUrl,
      fileUrl: mockFileUrl,
      method: 'POST',
    };
  }

  @Post('mock-upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async mockUpload(
    @Query('filename') filename: string,
    @UploadedFile() file: UploadedFileInfo,
  ) {
    this.logger.log(`[Mock Media Upload] File received successfully: ${filename} (${file?.size ?? 0} bytes)`);
    return {
      success: true,
      message: 'Mock file uploaded successfully',
    };
  }

  @Post('delete')
  // Was unauthenticated. Media URLs are public on the storefront, so anyone
  // could have walked the catalogue and deleted every product image.
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CATALOG_MANAGER)
  async deleteMedia(@Body() body: { url: string }) {
    const url = body?.url;
    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    // One implementation, in the service. This route used to carry its own
    // copy that recognised only two of the four buckets.
    const removed = await this.mediaService.deleteMediaFile(url);
    return { success: removed, url };
  }

  /**
   * Files in a bucket that no row points at — an upload whose form was
   * abandoned. Reports only; nothing is removed.
   */
  @Get('orphans')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async listOrphans(@Query('minAgeHours') minAgeHours?: string) {
    return this.mediaService.sweepOrphans({
      dryRun: true,
      minAgeHours: minAgeHours ? Number(minAgeHours) : 24,
    });
  }

  /**
   * Removes them. Super admin only, and it will not touch anything younger
   * than minAgeHours, because a recent upload may belong to a form somebody
   * is still filling in.
   */
  @Post('orphans/sweep')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async sweepOrphans(@Body() body: { minAgeHours?: number }) {
    return this.mediaService.sweepOrphans({
      dryRun: false,
      minAgeHours: body?.minAgeHours ?? 24,
    });
  }
}
