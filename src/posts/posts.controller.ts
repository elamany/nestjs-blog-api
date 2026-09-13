import {
  Controller,
  Get,
  Post as PostMethod,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { Public } from '@/auth/decorators/public.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { UserRole } from '@/users/enums/user-role.enum';
import { LogMetadata } from '@/common/services/activity-log.service';
import { Multer } from 'multer';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @PostMethod()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'My First Post' },
        content: { type: 'string', example: 'Hello World!' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] },
        coverImage: { type: 'string', format: 'binary', description: 'Main post thumbnail' },
        images: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Additional post images (max 10)' 
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ])
  )
  async create(
    @Req() req: Request & { user: { id: number; role: UserRole } },
    @Body() createPostDto: CreatePostDto,
    @UploadedFiles() files: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    const metadata = this.extractMetadata(req);
    
    return this.postsService.createPost(req.user.id, createPostDto, metadata, files);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all published posts (public feed)' })
  findAll(@Query() query: QueryPostDto) {
    return this.postsService.findAll(query);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my own posts (all statuses)' })
  findMyPosts(
    @Req() req: Request & { user: { id: number } },
    @Query() query: QueryPostDto,
  ) {
    return this.postsService.findMyPosts(req.user.id, query);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all posts including soft-deleted (admin only)' })
  findAllForAdmin(@Query() query: QueryPostDto) {
    return this.postsService.findAllForAdmin(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single post by ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: { id: number; role: UserRole } },
  ) {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === UserRole.ADMIN;
    
    return this.postsService.findOne(id, userId, isAdmin);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a post (only post owner edit)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] },
        coverImage: { type: 'string', format: 'binary' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ])
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFiles() files: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    const metadata = this.extractMetadata(req);
    return this.postsService.updatePost(id, req.user.id, updatePostDto, metadata, files);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post (soft delete, must be owner)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    const metadata = this.extractMetadata(req);
    return this.postsService.removePost(id, req.user.id, metadata);
  }

  private extractMetadata(req: Request): LogMetadata {
    return {
      ipAddress: (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', ''),
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  }
}