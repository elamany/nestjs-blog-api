import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';
import { IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @ApiProperty({ 
    required: false, 
    description: 'JSON string of image IDs to keep, e.g., "[10, 12]"' 
  })
  @IsOptional()
  keepImageIds?: number[];

  // Transform string to array
  transformKeepImageIds() {
    if (typeof this.keepImageIds === 'string') {
      try {
        return JSON.parse(this.keepImageIds);
      } catch {
        return [];
      }
    }
    return this.keepImageIds || [];
  }
}