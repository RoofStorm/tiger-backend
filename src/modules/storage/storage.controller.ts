import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Storage')
@Controller('api/storage')
@UseGuards(JwtAuthGuard)
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
  @ApiResponse({ status: 201, description: 'Presigned URL generated successfully' })
  async generatePresignedUrl(@Body() body: { key: string; contentType: string }) {
    const url = await this.storageService.generatePresignedUrl(
      body.key,
      body.contentType,
    );
    return { url };
  }
}

