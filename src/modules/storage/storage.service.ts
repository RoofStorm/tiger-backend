import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class StorageService {
  private s3: AWS.S3;
  private cloudinaryConfigured = false;

  constructor(private configService: ConfigService) {
    // Initialize S3 with MinIO-compatible configuration
    const endpoint = this.configService.get('S3_ENDPOINT');
    const region = this.configService.get('S3_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY');

    // Debug logging in constructor (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔧 StorageService Constructor - Env Vars:', {
        endpoint,
        region,
        hasAccessKeyId: !!accessKeyId,
        hasSecretKey: !!secretAccessKey,
        accessKeyIdFromConfig: this.configService.get('S3_ACCESS_KEY_ID'),
        secretKeyFromConfig: this.configService.get('S3_SECRET_ACCESS_KEY'),
      });
    }
    
    this.s3 = new AWS.S3({
      endpoint: endpoint,
      region: region,
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      sslEnabled: false,
      s3ForcePathStyle: true, // Required for MinIO
      signatureVersion: 'v4', // MinIO requires v4 signature
      signatureCache: false, // Disable signature cache to avoid stale signatures
    });

    // Initialize Cloudinary
    const cloudinaryUrl = this.configService.get('CLOUDINARY_URL');
    if (cloudinaryUrl) {
      cloudinary.config(cloudinaryUrl);
      this.cloudinaryConfigured = true;
    }
  }

  /**
   * Test S3/MinIO connection and credentials
   */

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    config?: {
      endpoint: string;
      bucket: string;
      region: string;
      accessKeyId: string;
      hasSecretKey: boolean;
    };
  }> {
    try {
      const endpoint = this.configService.get('S3_ENDPOINT');
      const bucket = this.configService.get('S3_BUCKET');
      const region = this.configService.get('S3_REGION') || 'us-east-1';
      const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY');
      // Enhanced debug logging
      console.log('🔍 Storage Config Check:', {
        endpoint,
        bucket,
        region,
        hasAccessKeyId: !!accessKeyId,
        hasSecretKey: !!secretAccessKey,
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        accessKeyIdLength: accessKeyId?.length || 0,
        secretKeyLength: secretAccessKey?.length || 0,
        // Debug: Check all possible sources
        debug: {
          fromConfigService_S3_ACCESS_KEY_ID: this.configService.get('S3_ACCESS_KEY_ID'),
          fromConfigService_S3_SECRET_ACCESS_KEY: this.configService.get('S3_SECRET_ACCESS_KEY'),
          fromConfigService_S3_ENDPOINT: this.configService.get('S3_ENDPOINT'),
        },
      });

      // Check if credentials are configured
      if (!accessKeyId || !secretAccessKey) {
        return {
          success: false,
          message: 'S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is not configured',
          config: {
            endpoint: endpoint || 'not set',
            bucket: bucket || 'not set',
            region,
            accessKeyId: accessKeyId || 'not set',
            hasSecretKey: !!secretAccessKey,
          },
        };
      }

      // Try to list buckets to verify credentials
      await this.s3.listBuckets().promise();

      // Check if bucket exists
      try {
        await this.s3.headBucket({ Bucket: bucket }).promise();
      } catch (error) {
        return {
          success: false,
          message: `Bucket "${bucket}" does not exist or is not accessible. Please create it in MinIO console.`,
          config: {
            endpoint: endpoint || 'not set',
            bucket,
            region,
            accessKeyId,
            hasSecretKey: true,
          },
        };
      }

      return {
        success: true,
        message: 'Connection successful',
        config: {
          endpoint: endpoint || 'not set',
          bucket,
          region,
          accessKeyId,
          hasSecretKey: true,
        },
      };
    } catch (error: any) {
      const endpoint = this.configService.get('S3_ENDPOINT');
      const bucket = this.configService.get('S3_BUCKET');
      const region = this.configService.get('S3_REGION') || 'us-east-1';
      const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY');

      return {
        success: false,
        message: `Connection failed: ${error.message || error.code || 'Unknown error'}. Check your credentials and endpoint.`,
        config: {
          endpoint: endpoint || 'not set',
          bucket: bucket || 'not set',
          region,
          accessKeyId: accessKeyId || 'not set',
          hasSecretKey: !!secretAccessKey,
        },
      };
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

    try {
      const result = await this.s3.upload(params).promise();
      return result.Location;
    } catch (error: any) {
      // Enhanced error logging for debugging
      const endpoint = this.configService.get('S3_ENDPOINT');
      const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID');
      
      console.error('S3 Upload Error:', {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        endpoint,
        bucket,
        accessKeyId: accessKeyId ? `${accessKeyId.substring(0, 4)}...` : 'not set',
        hasSecretKey: !!this.configService.get('S3_SECRET_ACCESS_KEY'),
      });

      // Provide more helpful error messages
      if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
        throw new Error(
          `S3 credentials are invalid. Please check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY. ` +
          `Endpoint: ${endpoint}, AccessKeyId: ${accessKeyId ? 'configured' : 'not set'}`
        );
      }
      
      if (error.code === 'NoSuchBucket') {
        throw new Error(
          `Bucket "${bucket}" does not exist. Please create it in MinIO console.`
        );
      }

      throw error;
    }
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

    let signedUrl = await this.s3.getSignedUrlPromise('putObject', params);

    // Fix MinIO signed URL: Replace AWS endpoint with MinIO endpoint
    if (endpoint) {
      try {
        const url = new URL(endpoint);
        const minioHost = url.host;
        signedUrl = signedUrl.replace(/s3[.-]?[a-z0-9-]*\.amazonaws\.com/, minioHost);
        signedUrl = signedUrl.replace(/amazonaws\.com/, minioHost);
      } catch (error) {
        // If endpoint is not a valid URL, try to extract host manually
        const minioHost = endpoint.replace(/^https?:\/\//, '').split('/')[0];
        signedUrl = signedUrl.replace(/s3[.-]?[a-z0-9-]*\.amazonaws\.com/, minioHost);
        signedUrl = signedUrl.replace(/amazonaws\.com/, minioHost);
      }
    }

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

  async getVideoUrl(filename: string): Promise<string> {
    const bucket = this.configService.get('S3_BUCKET');
    const endpoint = this.configService.get('S3_ENDPOINT');

    // Return direct MinIO URL for video
    return `${endpoint}/${bucket}/tiger-videos/${filename}`;
  }

  async getVideoStream(filename: string): Promise<any> {
    const bucket = this.configService.get('S3_BUCKET');

    const params = {
      Bucket: bucket,
      Key: `tiger-videos/${filename}`,
    };

    try {
      // Check if object exists first
      await this.s3.headObject(params).promise();

      // Return stream
      return this.s3.getObject(params).createReadStream();
    } catch (error) {
      throw new Error(`Video not found: ${filename}`);
    }
  }

  async getSignedVideoUrl(
    filename: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const bucket = this.configService.get('S3_BUCKET');
    const endpoint = this.configService.get('S3_ENDPOINT');

    const params = {
      Bucket: bucket,
      Key: `tiger-videos/${filename}`,
      Expires: expirySeconds, // URL hết hạn sau 1 giờ
      ResponseContentDisposition: 'inline', // Hiển thị inline thay vì download
      ResponseContentType: 'video/mp4', // Set content type cho video
    };

    try {
      // Tạo signed URL từ MinIO (S3-compatible)
      let signedUrl = await this.s3.getSignedUrlPromise('getObject', params);

      // Fix MinIO signed URL: Replace AWS endpoint with MinIO endpoint
      // AWS SDK returns URL with s3.amazonaws.com, we need to replace it with MinIO endpoint
      if (endpoint) {
        try {
          const url = new URL(endpoint);
          const minioHost = url.host;
          signedUrl = signedUrl.replace(/s3[.-]?[a-z0-9-]*\.amazonaws\.com/, minioHost);
          signedUrl = signedUrl.replace(/amazonaws\.com/, minioHost);
        } catch (error) {
          // If endpoint is not a valid URL, try to extract host manually
          const minioHost = endpoint.replace(/^https?:\/\//, '').split('/')[0];
          signedUrl = signedUrl.replace(/s3[.-]?[a-z0-9-]*\.amazonaws\.com/, minioHost);
          signedUrl = signedUrl.replace(/amazonaws\.com/, minioHost);
        }
      }

      return signedUrl;
    } catch (error) {
      throw new Error(`Failed to generate signed URL for: ${filename}`);
    }
  }
}
