import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './entities/post.entity';
import { PostImage } from './entities/post-image.entity';
import { R2Service } from '@/common/services/r2.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, PostImage])],
  controllers: [PostsController],
  providers: [PostsService,R2Service],
  exports: [PostsService],
})
export class PostsModule {}