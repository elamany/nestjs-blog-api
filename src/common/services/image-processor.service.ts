import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageOptions {
  maxWidth?: number;        // Default: 1920px
  quality?: number;         // Default: 80 (WebP quality)
  format?: 'webp' | 'jpeg' | 'png'; // Default: 'webp'
  stripMetadata?: boolean;  // Default: true (removes EXIF/GPS data)
}

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  private readonly DEFAULT_OPTIONS: Required<ImageOptions> = {
    maxWidth: 1920,
    quality: 80,
    format: 'webp',
    stripMetadata: true,
  };

  async processImage(
    file: Express.Multer.File,
    options: ImageOptions = {},
  ): Promise<ProcessedImage> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    // Max file size check (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Image must be smaller than 10MB');
    }

    try {
      let pipeline = sharp(file.buffer);

      // Strip EXIF/metadata 
      if (opts.stripMetadata) {
        pipeline = pipeline.rotate(); // Auto-rotate based on EXIF orientation
        pipeline = pipeline.withMetadata(); // We'll strip below
      }

      // Resize (maintain aspect ratio, don't upscale)
      pipeline = pipeline.resize({
        width: opts.maxWidth,
        height: opts.maxWidth, // Used as max dimension
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to target format with compression
      let mimeType = 'image/webp';
      let extension = 'webp';

      switch (opts.format) {
        case 'webp':
          pipeline = pipeline.webp({ quality: opts.quality });
          mimeType = 'image/webp';
          extension = 'webp';
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: opts.quality, mozjpeg: true });
          mimeType = 'image/jpeg';
          extension = 'jpg';
          break;
        case 'png':
          pipeline = pipeline.png({ quality: opts.quality });
          mimeType = 'image/png';
          extension = 'png';
          break;
      }

      // Strip all metadata (EXIF, ICC profiles, XMP, IPTC)
      if (opts.stripMetadata) {
        pipeline = pipeline.withMetadata({});
      }

      // 7. Process the image
      const buffer = await pipeline.toBuffer();
      const metadata = await sharp(buffer).metadata();

      const originalName = file.originalname.split('.')[0];
      const newName = `${originalName}.${extension}`;

      const sizeReduction = ((file.size - buffer.length) / file.size) * 100;
      this.logger.log(
        `Image processed: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB) → ` +
        `${newName} (${(buffer.length / 1024).toFixed(1)}KB) [${sizeReduction.toFixed(1)}% smaller]`
      );

      return {
        buffer,
        originalName: newName,
        mimeType,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: buffer.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process image: ${errorMessage}`);
      throw new BadRequestException('Failed to process image');
    }
  }

  // Generate a thumbnail version (for post previews)
  async generateThumbnail(
    file: Express.Multer.File,
    size: number = 400,
  ): Promise<ProcessedImage> {
    return this.processImage(file, {
      maxWidth: size,
      quality: 75,
      format: 'webp',
    });
  }
}