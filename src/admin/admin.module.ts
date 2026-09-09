import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ActivityLogModule } from '@/common/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [AdminController],
})
export class AdminModule {}