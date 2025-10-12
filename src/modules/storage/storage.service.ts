import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class StorageService {
  private s3: AWS.S3;
  private cloudinaryConfigured = false;

  constructor(private configService: ConfigService) {
    // Initialize S3
    this.s3 = new AWS.S3({
      endpoint: this.configService.get('S3_ENDPOINT'),
      region: this.configService.get('S3_REGION'),
      accessKeyId: this.configService.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('S3_SECRET_ACCESS_KEY'),
      s3ForcePathStyle: true,
    });

    // Initialize Cloudinary
    const cloudinaryUrl = this.configService.get('CLOUDINARY_URL');
    if (cloudinaryUrl) {
      cloudinary.config(cloudinaryUrl);
      this.cloudinaryConfigured = true;
    }
  }

  async uploadToS3(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<string> {
    const bucket = this.configService.get('S3_BUCKET');
    const key = `${folder}/${Date.now()}-${file.originalname}`;

    const params = {
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    const result = await this.s3.upload(params).promise();
    return result.Location;
  }

  async uploadToCloudinary(
    file: Express.Multer.File,
    folder = 'tiger',
  ): Promise<string> {
    if (!this.cloudinaryConfigured) {
      throw new Error('Cloudinary not configured');
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result.secure_url);
            }
          },
        )
        .end(file.buffer);
    });
  }

  async generatePresignedUrl(
    key: string,
    contentType: string,
  ): Promise<{
    signedUrl: string;
    publicUrl: string;
    fields: Record<string, string>;
  }> {
    const bucket = this.configService.get('S3_BUCKET');
    const endpoint = this.configService.get('S3_ENDPOINT');

    const params = {
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Expires: 3600, // 1 hour
    };

    const signedUrl = await this.s3.getSignedUrlPromise('putObject', params);

    // Generate public URL for MinIO
    const publicUrl = `${endpoint}/${bucket}/${key}`;

    // For MinIO, we need to return the signed URL and fields separately
    return {
      signedUrl,
      publicUrl,
      fields: {}, // MinIO doesn't use fields like S3
    };
  }

  async deleteFromS3(key: string): Promise<void> {
    const bucket = this.configService.get('S3_BUCKET');

    await this.s3
      .deleteObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
  }

  async deleteFromCloudinary(publicId: string): Promise<void> {
    if (!this.cloudinaryConfigured) {
      throw new Error('Cloudinary not configured');
    }

    await cloudinary.uploader.destroy(publicId);
  }
}
