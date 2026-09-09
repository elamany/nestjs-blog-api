import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PostStatus } from '../enums/post-status.enum';

export class CreatePostDto {
  @ApiProperty({ 
    example: 'My First Blog Post', 
    description: 'Title of the post' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ 
    example: 'This is the content of my post...', 
    description: 'Post content (HTML or Markdown)' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ 
    enum: PostStatus, 
    default: PostStatus.DRAFT, 
    required: false,
    description: 'Post status'
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}