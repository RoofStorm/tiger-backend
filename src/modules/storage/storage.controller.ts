import {
  Controller,
  Post,
  Get,
  Options,
  Param,
  Res,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Body,
  BadRequestException,
  Logger,
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
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { getMulterMemoryConfig } from './multer.config';

@ApiTags('Storage')
@Controller('api/storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post('upload')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', getMulterMemoryConfig()))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image file to S3 (max 10MB)' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file, file too large, or not an image' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const startTime = Date.now();

    // Log upload request
    this.logger.log(
      `📤 Upload request received - File: ${file?.originalname || 'N/A'}, Size: ${file?.size || 0} bytes, MIME: ${file?.mimetype || 'N/A'}`,
    );

    // Validate file exists
    if (!file) {
      this.logger.error('❌ No file provided in upload request');
      throw new BadRequestException('No file provided');
    }

    // Get max file size from config (in bytes)
    const maxFileSize = parseInt(
      process.env.MAX_FILE_SIZE || '10485760', // 10MB default
    );
    const maxFileSizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);

    // Validate file size
    if (file.size > maxFileSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      this.logger.error(
        `❌ File too large - File: ${file.originalname}, Size: ${fileSizeMB}MB, Max allowed: ${maxFileSizeMB}MB`,
      );
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${maxFileSizeMB}MB. Your file is ${fileSizeMB}MB.`,
      );
    }

    // Validate file type (should be image)
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      this.logger.error(
        `❌ Invalid file type - File: ${file.originalname}, MIME: ${file.mimetype}`,
      );
      throw new BadRequestException(
        `Invalid file type. Only image files are allowed. Received: ${file.mimetype}`,
      );
    }

    // Log file details
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    this.logger.log(
      `📋 File details - Name: ${file.originalname}, Size: ${fileSizeMB}MB, Type: ${file.mimetype}`,
    );

    try {
      const { publicUrl } = await this.storageService.uploadToS3(file);
      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Upload successful - File: ${file.originalname}, Size: ${fileSizeMB}MB, Duration: ${duration}ms, URL: ${publicUrl}`,
      );

      return { url: publicUrl };  
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Upload failed - File: ${file.originalname}, Size: ${fileSizeMB}MB, Duration: ${duration}ms, Error: ${error.message}`,
        error.stack,
      );

      // Re-throw with more context
      throw new BadRequestException(
        `Upload failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  @Post('upload/cloudinary')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', getMulterMemoryConfig()))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload image file to Cloudinary (max 10MB)' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file, file too large, or not an image' })
  async uploadToCloudinary(@UploadedFile() file: Express.Multer.File) {
    const startTime = Date.now();

    this.logger.log(
      `📤 Cloudinary upload request - File: ${file?.originalname || 'N/A'}, Size: ${file?.size || 0} bytes`,
    );

    if (!file) {
      this.logger.error('❌ No file provided in Cloudinary upload request');
      throw new BadRequestException('No file provided');
    }

    // Get max file size from config (in bytes)
    const maxFileSize = parseInt(
      process.env.MAX_FILE_SIZE || '10485760', // 10MB default
    );
    const maxFileSizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);

    // Validate file size
    if (file.size > maxFileSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      this.logger.error(
        `❌ File too large - File: ${file.originalname}, Size: ${fileSizeMB}MB, Max allowed: ${maxFileSizeMB}MB`,
      );
      throw new BadRequestException(
        `File size exceeds the maximum allowed size of ${maxFileSizeMB}MB. Your file is ${fileSizeMB}MB.`,
      );
    }

    // Validate file type (should be image)
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      this.logger.error(
        `❌ Invalid file type - File: ${file.originalname}, MIME: ${file.mimetype}`,
      );
      throw new BadRequestException(
        `Invalid file type. Only image files are allowed. Received: ${file.mimetype}`,
      );
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    this.logger.log(
      `📋 Cloudinary upload - Name: ${file.originalname}, Size: ${fileSizeMB}MB`,
    );

    try {
      const url = await this.storageService.uploadToCloudinary(file);
      const duration = Date.now() - startTime;

      this.logger.log(
        `✅ Cloudinary upload successful - File: ${file.originalname}, Duration: ${duration}ms`,
      );

      return { url };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Cloudinary upload failed - File: ${file.originalname}, Duration: ${duration}ms, Error: ${error.message}`,
        error.stack,
      );

      throw new BadRequestException(
        `Cloudinary upload failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  @Post('presigned-url')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
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
  @ApiOperation({ summary: 'Get video from MinIO with Range support (public)' })
  @ApiResponse({
    status: 200,
    description: 'Video streamed successfully',
  })
  @ApiResponse({
    status: 206,
    description: 'Partial content (Range request)',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async getVideo(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      // Decode filename (handle URL encoding)
      const decodedFilename = decodeURIComponent(filename);
      this.logger.log(`📹 Video request: ${decodedFilename}`);

      // Get video metadata first
      const metadata = await this.storageService.getVideoMetadata(decodedFilename);
      const totalSize = metadata.contentLength;

      // Parse Range header if present
      const rangeHeader = req.headers.range;
      let start = 0;
      let end = totalSize - 1;
      let statusCode = 200;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        // Validate range
        if (start >= totalSize || end >= totalSize) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
          return res.end();
        }

        statusCode = 206; // Partial Content
      }

      // Get video stream with range support
      const { stream, contentLength, contentType } =
        await this.storageService.getVideoStream(decodedFilename, start, end);

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      // CORS headers
      const frontendUrl = process.env.FRONTEND_URL || '*';
      res.setHeader('Access-Control-Allow-Origin', frontendUrl);
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Range, Content-Type, Accept-Ranges',
      );
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      );

      // Cross-Origin headers for video playback
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Set Content-Range header for partial content
      if (statusCode === 206) {
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.status(206);
      } else {
        res.status(200);
      }

      // Pipe stream to response
      stream.on('error', (error: Error) => {
        this.logger.error(`❌ Stream error for ${decodedFilename}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Stream error' });
        }
      });

      stream.pipe(res);
    } catch (error: any) {
      this.logger.error(`❌ Error streaming video ${filename}:`, error);
      if (!res.headersSent) {
        res.status(404).json({ 
          message: error.message || 'Video not found',
          filename: filename,
        });
      }
    }
  }

  @Options('video/:filename')
  @ApiOperation({ summary: 'CORS preflight for video endpoint' })
  async handleVideoOptions(@Res() res: Response) {
    // CORS headers are handled by global CORS middleware
    res.status(200).end();
  }

  @Get('video-stream/:filename')
  @ApiOperation({
    summary: 'Stream video from MinIO with range support (public)',
  })
  @ApiResponse({
    status: 200,
    description: 'Video streamed successfully',
  })
  @ApiResponse({
    status: 206,
    description: 'Partial content (Range request)',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async streamVideo(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      const decodedFilename = decodeURIComponent(filename);
      
      // Get video metadata
      const metadata = await this.storageService.getVideoMetadata(decodedFilename);
      const totalSize = metadata.contentLength;

      // Parse Range header if present
      const rangeHeader = req.headers.range;
      let start = 0;
      let end = totalSize - 1;
      let statusCode = 200;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize) {
          res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
          return res.end();
        }

        statusCode = 206;
      }

      // Get video stream
      const { stream, contentLength, contentType } =
        await this.storageService.getVideoStream(decodedFilename, start, end);

      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (statusCode === 206) {
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.status(206);
      } else {
        res.status(200);
      }

      stream.on('error', (error: Error) => {
        this.logger.error(`❌ Stream error for ${decodedFilename}:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Stream error' });
        }
      });

      stream.pipe(res);
    } catch (error: any) {
      this.logger.error(`❌ Error streaming video ${filename}:`, error);
      if (!res.headersSent) {
        res.status(404).json({ 
          message: error.message || 'Video not found',
          filename: filename,
        });
      }
    }
  }

  @Get('video-signed/:filename')
  @ApiOperation({ summary: 'Get signed URL for video from MinIO (public)' })
  @ApiResponse({
    status: 200,
    description: 'Signed URL generated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async getSignedVideoUrl(@Param('filename') filename: string) {
    try {
      const signedUrl = await this.storageService.getSignedVideoUrl(filename);
      return { url: signedUrl };
    } catch (error) {
      throw new Error(`Failed to generate signed URL for: ${filename}`);
    }
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Test S3/MinIO connection and credentials (public)' })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
  })
  async testConnection() {
    return await this.storageService.testConnection();
  }
}
