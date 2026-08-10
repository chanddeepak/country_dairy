import { BadRequestException, Controller, Get, Post, Body, Query, UseGuards, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
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
import { AuthGuard } from '../auth/auth.guard';
import {
  ALL_MEDIA_MIME_TYPES,
  extensionFor,
  humanSize,
  maxBytesFor,
  mediaKindFor,
} from './media.constants';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diskStorage } = require('multer');

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  private getSupabaseClient() {

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
      throw new BadRequestException(
        `${kind === 'VIDEO' ? 'Video' : 'Image'} exceeds the ${humanSize(maxBytesFor(kind))} limit`,
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
  async deleteMedia(@Body() body: { url: string }) {
    const url = body?.url;
    if (!url) {
      return { success: false, message: 'URL is required' };
    }

    this.logger.log(`Received request to delete media: ${url}`);
    const supabase = this.getSupabaseClient();

    // 1. Delete from Supabase Storage if URL points to Supabase bucket
    if (supabase && (url.startsWith('/hero-banners/') || url.startsWith('/products/') || url.includes('/storage/v1/object/public/'))) {
      try {
        let bucket = 'hero-banners';
        let filePath = url.replace(/^\/hero-banners\//, '');
        if (url.startsWith('/products/')) {
          bucket = 'products';
          filePath = url.replace(/^\/products\//, '');
        } else if (url.includes('/storage/v1/object/public/')) {
          const parts = url.split('/storage/v1/object/public/')[1]?.split('/');
          if (parts && parts.length >= 2) {
            bucket = parts[0];
            filePath = parts.slice(1).join('/');
          }
        }
        const { error } = await supabase.storage.from(bucket).remove([filePath]);
        if (error) {
          this.logger.warn(`Supabase Storage remove warning (${bucket}/${filePath}): ${error.message}`);
        } else {
          this.logger.log(`[Supabase Storage] Deleted file (${bucket}/${filePath}) successfully!`);
        }
      } catch (err) {
        this.logger.warn(`Supabase Storage remove error: ${(err as Error).message}`);
      }
    }

    // 2. Delete local file if stored locally in uploads/
    if (url.startsWith('/uploads/')) {
      try {
        const filename = path.basename(url);
        const localPath = path.join(uploadDir, filename);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          this.logger.log(`[Local Disk] Deleted file (${localPath}) successfully!`);
        }
      } catch (err) {
        this.logger.warn(`Local file deletion error: ${(err as Error).message}`);
      }
    }

    return { success: true, message: 'Media deleted successfully' };
  }
}
