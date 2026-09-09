import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { PostStatus } from '../enums/post-status.enum';
import { PostImage } from './post-image.entity';

@Entity('posts')
@Index(['title']) 
@Index(['status']) 
@Index(['authorId']) 
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  content: string; 

  @Column({ length: 500, nullable: true })
  coverImage: string; 

  @Column({
    type: 'enum',
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;

  @Column()
  authorId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @OneToMany(() => PostImage, (image) => image.post, {
    cascade: true, 
    onDelete: 'CASCADE',
  })
  images: PostImage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}