import { Entity, PrimaryGeneratedColumn,Column, CreateDateColumn,ManyToOne, JoinColumn,Index,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';

@Entity('refresh_tokens')
@Index(['userId'])
@Index(['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;
 
  @Column()
  token: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceName: string | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  @Index() 
  isRevoked: boolean;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}