import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  Logger, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { PostImage } from './entities/post-image.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { PostStatus } from './enums/post-status.enum';
import { ActivityLogService, LogMetadata } from '@/common/services/activity-log.service';
import { ActivityAction } from '@/common/entities/activity-log.entity';
import { R2Service } from '@/common/services/r2.service';
import { ImageProcessorService } from '@/common/services/image-processor.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostImage)
    private readonly postImagesRepository: Repository<PostImage>,
    private readonly activityLogService: ActivityLogService,
    private readonly r2Service: R2Service,
    private readonly imageProcessorService: ImageProcessorService,
  ) {}

  // CREATE POST
  async createPost(
    userId: number,
    createPostDto: CreatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    let coverImageUrl: string | undefined = undefined;
    const newImageRecordsData: any[] = [];

    // Handle Cover Image
    if (files?.coverImage && files.coverImage.length > 0) {
      const coverFile = files.coverImage[0];
      if (coverFile.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Cover image must be smaller than 5MB');
      }
      const processed = await this.imageProcessorService.processImage(coverFile);
      const { url } = await this.r2Service.uploadBuffer(
        processed.buffer,
        processed.originalName,
        `posts/cover`,
        processed.mimeType,
      );
      coverImageUrl = url;
    }

    // Handle multiple Images
    if (files?.images && files.images.length > 0) {
      if (files.images.length > 10) {
        throw new BadRequestException('A post can have a maximum of 10 images');
      }

      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        if (imageFile.size > 5 * 1024 * 1024) {
          throw new BadRequestException(`Image '${imageFile.originalname}' must be smaller than 5MB`);
        }

        const processed = await this.imageProcessorService.processImage(imageFile);
        const { url, key } = await this.r2Service.uploadBuffer(
          processed.buffer,
          processed.originalName,
          `posts/images`,
          processed.mimeType,
        );

        newImageRecordsData.push({
          url,
          key,
          altText: `Image ${i + 1}`,
          displayOrder: i,
        });
      }
    }

    // EXECUTE DATABASE TRANSACTION
    const savedPost = await this.postsRepository.manager.transaction(async (transactionalEntityManager) => {
      const txPostRepo = transactionalEntityManager.getRepository(Post);
      const txImageRepo = transactionalEntityManager.getRepository(PostImage);

      const post = txPostRepo.create({
        ...createPostDto,
        authorId: userId,
        coverImage: coverImageUrl,
      });
      const newPost = await txPostRepo.save(post);

      if (newImageRecordsData.length > 0) {
        const imagesToSave = newImageRecordsData.map(imgData => ({
          ...imgData,
          postId: newPost.id,
        }));
        await txImageRepo.save(imagesToSave);
      }

      return newPost;
    });

    await this.activityLogService.saveLog({
      userId,
      action: ActivityAction.CREATE_POST,
      description: `Created post: ${savedPost.title}`,
      resourceType: 'Post',
      resourceId: savedPost.id,
      metadata,
    });

    return this.postsRepository.findOne({
      where: { id: savedPost.id },
      relations: { images: true, author: true },
    });
  }

  async updatePost(
    id: number,
    userId: number,
    updatePostDto: UpdatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: { images: true }, 
    });

    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId) {
      throw new ForbiddenException('You have no permission to edit this post');
    }

    let keepIds: number[] = [];
    if (updatePostDto.keepImageIds) {
      if (typeof updatePostDto.keepImageIds === 'string') {
        try {
          keepIds = JSON.parse(updatePostDto.keepImageIds);
        } catch {
          keepIds = [];
        }
      } else if (Array.isArray(updatePostDto.keepImageIds)) {
        keepIds = updatePostDto.keepImageIds;
      }
    }

    const oldCoverUrl = post.coverImage;
    let newCoverUrl = oldCoverUrl;

    if (files?.coverImage && files.coverImage.length > 0) {
      const coverFile = files.coverImage[0];
      if (coverFile.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Cover image must be smaller than 5MB');
      }

      const processed = await this.imageProcessorService.processImage(coverFile);
      const uploadResult = await this.r2Service.uploadBuffer(
        processed.buffer,
        processed.originalName,
        `posts/${post.id}/cover`,
        processed.mimeType,
      );
      newCoverUrl = uploadResult.url;
    }

    const newImageRecordsData: any[] = [];
    if (files?.images && files.images.length > 0) {
      const currentImageCount = (post.images || []).filter(img => keepIds.includes(img.id)).length;
      
      if (currentImageCount + files.images.length > 10) {
        throw new BadRequestException('A post can have a maximum of 10 images');
      }

      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        if (imageFile.size > 5 * 1024 * 1024) {
          throw new BadRequestException(`Image '${imageFile.originalname}' must be smaller than 5MB`);
        }

        const processed = await this.imageProcessorService.processImage(imageFile);
        const { url, key } = await this.r2Service.uploadBuffer(
          processed.buffer,
          processed.originalName,
          `posts/${post.id}/images`,
          processed.mimeType,
        );

        newImageRecordsData.push({
          url,
          key,
          altText: `Image ${currentImageCount + i + 1}`,
          displayOrder: currentImageCount + i,
          postId: post.id,
        });
      }
    }

    await this.postsRepository.manager.transaction(async (transactionalEntityManager) => {
      const txPostRepo = transactionalEntityManager.getRepository(Post);
      const txImageRepo = transactionalEntityManager.getRepository(PostImage);

      const updateData: any = {
        title: updatePostDto.title,
        content: updatePostDto.content,
        status: updatePostDto.status,
      };

      if (newCoverUrl !== oldCoverUrl) {
        updateData.coverImage = newCoverUrl;
      }

      await txPostRepo.update(post.id, updateData);

      // Delete old images from DB
      const imagesToDelete = (post.images || []).filter(img => !keepIds.includes(img.id));
      
      if (imagesToDelete.length > 0) {
        await txImageRepo.delete(imagesToDelete.map(img => img.id));
      }

      // Insert new images into DB
      if (newImageRecordsData.length > 0) {
        await txImageRepo.save(newImageRecordsData);
      }
    });

    if (newCoverUrl !== oldCoverUrl && oldCoverUrl) {
      const oldKey = this.extractKeyFromUrl(oldCoverUrl);
      if (oldKey) {
        await this.r2Service.deleteFile(oldKey).catch((err) => 
          this.logger.warn(`Failed to delete old cover image from R2: ${err.message}`)
        );
      }
    }

    const imagesToDelete = (post.images || []).filter(img => !keepIds.includes(img.id));
    for (const img of imagesToDelete) {
      await this.r2Service.deleteFile(img.key).catch((err) => 
        this.logger.warn(`Failed to delete old gallery image ${img.key} from R2: ${err.message}`)
      );
    }

    await this.activityLogService.saveLog({
      userId,
      action: ActivityAction.UPDATE_POST,
      description: `Updated post: ${post.title}`,
      resourceType: 'Post',
      resourceId: post.id,
      metadata,
    });

    return this.postsRepository.findOne({
      where: { id },
      relations: { images: true, author: true },
    });
  }

  // DELETE POST
  async removePost(id: number, userId: number, metadata?: LogMetadata) {
    const post = await this.findPostForUser(id, userId);

    await this.postsRepository.softRemove(post);

    await this.activityLogService.saveLog({
      userId,
      action: ActivityAction.DELETE_POST,
      description: `Moved post to trash: ${post.title}`,
      resourceType: 'Post',
      resourceId: id,
      metadata,
    });

    return { message: 'Post moved to trash successfully' };
  }

  async findAll(query: QueryPostDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .select([
        'post.id',
        'post.title',
        'post.content',
        'post.coverImage',
        'post.status',
        'post.createdAt',
        'post.updatedAt',
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.role',
      ])
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere('post.deletedAt IS NULL')
      .andWhere('author.isActive = :isActive', { isActive: true });

    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', { search: `%${query.search}%` });
    }

    queryBuilder.orderBy('post.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findMyPosts(userId: number, query: QueryPostDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .where('post.authorId = :userId', { userId })
      .andWhere('post.deletedAt IS NULL');

    if (query.status) {
      queryBuilder.andWhere('post.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', { search: `%${query.search}%` });
    }

    queryBuilder.orderBy('post.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findAllForAdmin(query: QueryPostDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .addSelect([
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.email',
        'author.role',
      ]);

    if (query.status) {
      queryBuilder.andWhere('post.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', { search: `%${query.search}%` });
    }

    queryBuilder.orderBy('post.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  //SINGLE POST
  async findOne(id: number, userId?: number, isAdmin?: boolean) {
    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .withDeleted()
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.images', 'images')
      .select([
        'post.id',
        'post.authorId',  
        'post.title',
        'post.content',
        'post.coverImage',
        'post.status',
        'post.createdAt',
        'post.deletedAt', 
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.role',
        'author.isActive', 
        'images.id',
        'images.url',
        'images.altText',
        'images.displayOrder',
      ])
      .where('post.id = :id', { id });

    const post = await queryBuilder.getOne();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (!post.author.isActive && !isAdmin) {
      throw new ForbiddenException('You do not have permission to view this post');
    }

    if (post.status === PostStatus.PUBLISHED && !post.deletedAt) {
      return this.cleanPostResponse(post);
    }

    if (post.deletedAt) {
      if (!isAdmin) {
        throw new ForbiddenException('You do not have permission to view this post');
      }
      return this.cleanPostResponse(post);
    }

    if (post.status === PostStatus.DRAFT || post.status === PostStatus.ARCHIVED) {
      if (!userId || (post.authorId !== userId && !isAdmin)) {
        throw new ForbiddenException('You do not have permission to view this post');
      }
      return this.cleanPostResponse(post);
    }

    return this.cleanPostResponse(post);
  }

  private cleanPostResponse(post: any) {
    const clean = { ...post };
    delete clean.deletedAt;
    delete clean.authorId;
    
    if (clean.author) {
      delete clean.author.isActive;   
      delete clean.author.createdAt;
      delete clean.author.updatedAt;
      delete clean.author.deletedAt;
    }

    return clean;
  }

  private async findPostForUser(id: number, userId: number): Promise<Post> {
    const post = await this.postsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit or delete your own posts');
    }

    return post;
  }

  private extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }
}