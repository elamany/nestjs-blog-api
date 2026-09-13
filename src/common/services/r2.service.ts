import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrl = this.configService.getOrThrow<string>('R2_PUBLIC_URL');

    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto'
      endpoint: this.configService.getOrThrow<string>('R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<{ url: string; key: string }> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`Successfully uploaded file to R2: ${key}`);
      return { url, key };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to upload file to R2: ${errorMessage}`);
      throw new Error('File upload failed');
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete file from R2:: ${errorMessage}`);
      // Don't throw here, we still want to clean up the database even if R2 fails
    }
  }
}