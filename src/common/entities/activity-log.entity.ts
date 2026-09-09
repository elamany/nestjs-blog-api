import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

export enum ActivityAction {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  CREATE_POST = 'CREATE_POST',
  UPDATE_POST = 'UPDATE_POST',
  DELETE_POST = 'DELETE_POST',
  READ = 'READ',
}

@Entity('activity_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ActivityAction,
  })
  action: ActivityAction;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ length: 50, nullable: true })
  resourceType?: string; // e.g., "post", "user"

  @Column({ nullable: true })
  resourceId?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ nullable: true })
  userId?: number;

  @CreateDateColumn()
  createdAt: Date;
}