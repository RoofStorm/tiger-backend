import {
  Controller,
  Post,
  Get,
  Options,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Storage')
@Controller('api/storage')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to S3' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const url = await this.storageService.uploadToS3(file);
    return { url };
  }

  @Post('upload/cloudinary')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file to Cloudinary' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  async uploadToCloudinary(@UploadedFile() file: Express.Multer.File) {
    const url = await this.storageService.uploadToCloudinary(file);
    return { url };
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate presigned URL for direct upload' })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully',
  })
  async generatePresignedUrl(
    @Body() body: { key: string; contentType: string },
  ) {
    const url = await this.storageService.generatePresignedUrl(
      body.key,
      body.contentType,
    );
    return { url };
  }

  @Post('sign')
  @ApiOperation({ summary: 'Generate signed URL for upload' })
  @ApiResponse({
    status: 201,
    description: 'Signed URL generated successfully',
  })
  async getSignedUploadUrl(
    @Body() body: { filename: string; contentType: string },
  ) {
    const result = await this.storageService.generatePresignedUrl(
      body.filename,
      body.contentType,
    );
    return result;
  }

  @Get('video/:filename')
  @ApiOperation({ summary: 'Get video from MinIO' })
  @ApiResponse({
    status: 200,
    description: 'Video streamed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async getVideo(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const stream = await this.storageService.getVideoStream(filename);

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // ✅ CORS + CORP headers
      res.setHeader(
        'Access-Control-Allow-Origin',
        process.env.FRONTEND_URL || 'http://localhost:3000',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Range, Content-Type, Accept-Ranges',
      );
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      );

      // ✅ Quan trọng: Chrome yêu cầu để video cross-origin hiển thị được
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

      stream.pipe(res);
    } catch (error) {
      console.error('Error streaming video:', error);
      res.status(404).json({ message: 'Video not found' });
    }
  }

  @Options('video/:filename')
  @ApiOperation({ summary: 'CORS preflight for video endpoint' })
  async handleVideoOptions(@Res() res: Response) {
    // CORS headers are handled by global CORS middleware
    res.status(200).end();
  }

  @Get('video-stream/:filename')
  @ApiOperation({ summary: 'Stream video from MinIO with range support' })
  @ApiResponse({
    status: 200,
    description: 'Video streamed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async streamVideo(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const stream = await this.storageService.getVideoStream(filename);

      // Set proper headers for video streaming
      res.setHeader('Content-Type', 'video/x-matroska');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');

      stream.pipe(res);
    } catch (error) {
      res.status(404).json({ message: 'Video not found' });
    }
  }
}
