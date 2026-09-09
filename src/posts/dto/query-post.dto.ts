import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../enums/post-status.enum';

export class QueryPostDto {
  @ApiProperty({ required: false, description: 'Search by title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: PostStatus, required: false, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiProperty({ default: 1, description: 'Page number' })
  @IsOptional()
  @IsNumberString()
  page?: string = '1';

  @ApiProperty({ default: 10, description: 'Items per page' })
  @IsOptional()
  @IsNumberString()
  limit?: string = '10';
}