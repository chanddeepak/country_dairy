import { Controller, Get, Post, Query, UseGuards, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  @Get('presigned-url')
  @UseGuards(AuthGuard)
  async getPresignedUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    this.logger.log(`Requesting pre-signed upload URL for: filename=${filename}, type=${contentType}`);
    
    // If AWS credentials are set up, we would generate a real pre-signed S3 URL here.
    // For local MVP and developer testing, we return a mock URL pointing to our local API.
    const mockUploadUrl = `http://localhost:4000/api/media/mock-upload?filename=${encodeURIComponent(filename)}`;
    const mockFileUrl = `https://country-dairy-assets.s3.ap-south-1.amazonaws.com/uploads/${Date.now()}-${filename}`;

    this.logger.log(`Returning mock upload URL config`);
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
