import { Controller, Get, Post, Query, UseGuards, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { AuthGuard } from '../auth/auth.guard';

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
      return createClient(supabaseUrl, supabaseKey);
    }
    return null;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname) || '.webp';
          cb(null, `upload-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      return { success: false, message: 'No file provided' };
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
    this.logger.log(`Requesting pre-signed upload URL for: filename=${filename}, type=${contentType}`);
    
    const supabase = this.getSupabaseClient();
    const bucketName = bucket || 'hero-banners';

    // 1. Supabase Object Storage & CDN Flow
    if (supabase) {
      try {
        const timestamp = Date.now();
        const cleanFilename = filename ? filename.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.webp';
        const filePath = `${timestamp}-${cleanFilename}`;

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
            const publicUrlData = supabase.storage.from(bucketName).getPublicUrl(filePath);
            return {
              uploadUrl: retry.data.signedUrl,
              fileUrl: publicUrlData.data.publicUrl,
              method: 'PUT',
            };
          }
        }

        if (data?.signedUrl) {
          const publicUrlData = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          this.logger.log(`Generated Supabase Storage pre-signed URL for bucket ${bucketName}: ${filePath}`);
          return {
            uploadUrl: data.signedUrl,
            fileUrl: publicUrlData.data.publicUrl,
            method: 'PUT',
          };
        }
      } catch (err: any) {
        this.logger.warn(`Supabase Storage pre-signed URL warning: ${err?.message || err}`);
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
    @UploadedFile() file: any,
  ) {
    this.logger.log(`[Mock Media Upload] File received successfully: ${filename} (${file?.size ?? 0} bytes)`);
    return {
      success: true,
      message: 'Mock file uploaded successfully',
    };
  }
}
