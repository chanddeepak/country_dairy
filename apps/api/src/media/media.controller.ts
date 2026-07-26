import { Controller, Get, Post, Query, UseGuards, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  ) {
    this.logger.log(`Requesting pre-signed upload URL for: filename=${filename}, type=${contentType}`);
    const mockUploadUrl = `http://localhost:4000/api/media/upload`;
    const mockFileUrl = `/uploads/${Date.now()}-${filename}`;

    return {
      uploadUrl: mockUploadUrl,
      fileUrl: mockFileUrl,
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
