import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { AuthModule } from '@/auth/auth.module';
import { RefreshToken } from '@/auth/entities/refresh-token.entity';
import { ActivityLog } from '@/common/entities/activity-log.entity'; 
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, ActivityLog]),

    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}