import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Post } from './post.entity';

@Entity('post_images')
@Index(['postId', 'displayOrder']) 
export class PostImage {
  @PrimaryGeneratedColumn()
  id: number;

  // The public URL shown to the user
  @Column({ length: 500 })
  url: string; 

  @Column({ length: 255 })
  key: string; 

  @Column({ length: 255, nullable: true })
  altText?: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column()
  postId: number;

  @ManyToOne(() => Post, (post) => post.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post: Post;
}