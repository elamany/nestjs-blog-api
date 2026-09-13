import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Post } from './entities/post.entity';
import { PostImage } from './entities/post-image.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostDto } from './dto/query-post.dto';
import { PostStatus } from './enums/post-status.enum';
import { ActivityLogService, LogMetadata,} from '@/common/services/activity-log.service';
import { ActivityAction } from '@/common/entities/activity-log.entity';
import { R2Service } from '@/common/services/r2.service';

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
  ) {}

  async createPost(
    userId: number,
    createPostDto: CreatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    const post = this.postsRepository.create({
      ...createPostDto,
      authorId: userId,
    });

    const savedPost = await this.postsRepository.save(post);

    // Handle cover image upload
    if (files?.coverImage && files.coverImage.length > 0) {
      const coverFile = files.coverImage[0];
      const { url } = await this.r2Service.uploadFile(coverFile, `posts/${savedPost.id}/cover`);
      savedPost.coverImage = url;
      await this.postsRepository.save(savedPost);
    }

    //  Handle multiple images upload
    if (files?.images && files.images.length > 0) {
      const imageRecords: PostImage[] = [];
      
      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        const { url, key } = await this.r2Service.uploadFile(
          imageFile,
          `posts/${savedPost.id}/images`,
        );

        const imageRecord = this.postImagesRepository.create({
          url,
          key,
          altText: `Image ${i + 1}`,
          displayOrder: i,
          postId: savedPost.id,
        });

        imageRecords.push(imageRecord);
      }

      await this.postImagesRepository.save(imageRecords);
    }

    // Log the activity
    await this.activityLogService.saveLog({
      userId,
      action: ActivityAction.CREATE_POST,
      description: `Created post: ${savedPost.title}`,
      resourceType: 'Post',
      resourceId: savedPost.id,
      metadata,
    });

    return savedPost;
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

    // Search by title
    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', { search: `%${query.search}%` });
    }

    queryBuilder
      .orderBy('post.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findMyPosts(userId: number, query: QueryPostDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .where('post.authorId = :userId', { userId })
      .andWhere('post.deletedAt IS NULL'); // Exclude soft-deleted

    // status filter
    if (query.status) {
      queryBuilder.andWhere('post.status = :status', { status: query.status });
    }

    //  search
    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    queryBuilder.orderBy('post.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
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

    //  filters
    if (query.status) {
      queryBuilder.andWhere('post.status = :status', { status: query.status });
    }

    if (query.search) {
      queryBuilder.andWhere('post.title ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    queryBuilder.orderBy('post.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // SINGLE POST
  async findOne(id: number, userId?: number, isAdmin?: boolean) {
    const queryBuilder = this.postsRepository
      .createQueryBuilder('post')
      .withDeleted() // Required to find soft-deleted posts for permission checks
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

    //If author is inactive, ONLY admin can see the post
    if (!post.author.isActive && !isAdmin) {
      throw new ForbiddenException('You do not have permission to view this post');
    }

    // If published and NOT deleted → anyone (with active author) can see
    if (post.status === PostStatus.PUBLISHED && !post.deletedAt) {
      return this.cleanPostResponse(post);
    }

    // If soft-deleted  only admin can see
    if (post.deletedAt) {
      if (!isAdmin) {
        throw new ForbiddenException('You do not have permission to view this post');
      }
      return this.cleanPostResponse(post);
    }

    //  If draft/archived  only author or admin can see
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
    // Remove fields used only for backend logic
    delete clean.deletedAt;
    delete clean.authorId;
    
    // Ensure author object is also clean
    if (clean.author) {
      delete clean.author.isActive;   
      delete clean.author.createdAt;
      delete clean.author.updatedAt;
      delete clean.author.deletedAt;
    }

    return clean;
  }

  async updatePost(
    id: number,
    userId: number,
    updatePostDto: UpdatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    const post = await this.findPostForUser(id, userId);

    // Update text fields
    Object.assign(post, updatePostDto);

    // Handle new cover image (replaces old one)
    if (files?.coverImage && files.coverImage.length > 0) {
      // TODO: Delete old cover image from R2 if it exists
      const coverFile = files.coverImage[0];
      const { url } = await this.r2Service.uploadFile(coverFile, `posts/${post.id}/cover`);
      post.coverImage = url;
    }

    const updatedPost = await this.postsRepository.save(post);

    // Handle new images (appends to existing ones)
    if (files?.images && files.images.length > 0) {
      const existingImages = await this.postImagesRepository.find({
        where: { postId: post.id },
      });

      const imageRecords: PostImage[] = [];

      for (let i = 0; i < files.images.length; i++) {
        const imageFile = files.images[i];
        const { url, key } = await this.r2Service.uploadFile(
          imageFile,
          `posts/${post.id}/images`,
        );

        const imageRecord = this.postImagesRepository.create({
          url,
          key,
          altText: `Image ${existingImages.length + i + 1}`,
          displayOrder: existingImages.length + i,
          postId: post.id,
        });

        imageRecords.push(imageRecord);
      }

      await this.postImagesRepository.save(imageRecords);
    }

    await this.activityLogService.saveLog({
      userId,
      action: ActivityAction.UPDATE_POST,
      description: `Updated post: ${updatedPost.title}`,
      resourceType: 'Post',
      resourceId: updatedPost.id,
      metadata,
    });

    return updatedPost;
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

  // HELPER: Enforce ownership for edit/delete
  private async findPostForUser(id: number, userId: number): Promise<Post> {
    const post = await this.postsRepository.findOne({ where: { id } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only edit or delete your own posts',
      );
    }

    return post;
  }
}
