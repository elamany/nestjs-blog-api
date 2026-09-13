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

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(PostImage)
    private readonly postImagesRepository: Repository<PostImage>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async createPost(
    userId: number,
    createPostDto: CreatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] }
  ) {
    const post = this.postsRepository.create({
      ...createPostDto,
      authorId: userId,
    });

    const savedPost = await this.postsRepository.save(post);

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
      .addSelect(['author.id', 'author.firstName', 'author.lastName'])
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .andWhere('post.deletedAt IS NULL'); // Exclude soft-deleted

    // Search by title
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
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: {
        author: true,
        images: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Visibility rules:
    //  If published → anyone can see
    if (post.status === PostStatus.PUBLISHED && !post.deletedAt) {
      return post;
    }

    // If soft-deleted → only admin can see
    if (post.deletedAt) {
      if (!isAdmin) {
        throw new ForbiddenException(
          'You do not have permission to view this post',
        );
      }
      return post;
    }

    //  If draft/archived → only author or admin can see
    if (
      post.status === PostStatus.DRAFT ||
      post.status === PostStatus.ARCHIVED
    ) {
      if (!userId || (post.authorId !== userId && !isAdmin)) {
        throw new ForbiddenException(
          'You do not have permission to view this post',
        );
      }
      return post;
    }

    return post;
  }

  async updatePost(
    id: number,
    userId: number,
    updatePostDto: UpdatePostDto,
    metadata?: LogMetadata,
    files?: { coverImage?: Express.Multer.File[]; images?: Express.Multer.File[] }
  ) {
    const post = await this.findPostForUser(id, userId);

    Object.assign(post, updatePostDto);
    const updatedPost = await this.postsRepository.save(post);

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
