import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);

  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.getOrThrow<string>('R2_BUCKET_NAME');

    this.publicUrl =
      this.configService.getOrThrow<string>('R2_PUBLIC_URL');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>(
          'R2_ACCESS_KEY_ID',
        ),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
      forcePathStyle: true,
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    folder: string,
    mimeType: string,
  ): Promise<{ url: string; key: string }> {
    const extension = extname(filename);
    const uniqueName = `${randomUUID()}${extension}`;
    const key = `${folder}/${uniqueName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    try {
      await this.s3Client.send(command);

      const url = `${this.publicUrl}/${key}`;

      this.logger.log(`Successfully uploaded image to R2: ${key}`);

      return { url, key };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to upload image to R2: ${errorMessage}`,
      );

      throw new Error('Image upload failed');
    }
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Client.send(command);

      this.logger.log(`Successfully deleted file from R2: ${key}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to delete file from R2: ${errorMessage}`,
      );

      // Don't throw here. We still want to clean up the database
      // even if R2 deletion fails.
    }
  }
}