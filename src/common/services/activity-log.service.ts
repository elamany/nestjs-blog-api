import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from '../entities/activity-log.entity';

export interface CreateActivityLogDto {
  userId?: number;
  action: ActivityAction;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: number;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async create(data: CreateActivityLogDto): Promise<void> {
    try {
      const log = this.activityLogRepository.create(data);
      await this.activityLogRepository.save(log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save activity log: ${errorMessage}`);
    }
  }

  // For users to see their own logs
  async findMyLogs(
    userId: number,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: ActivityLog[]; total: number; page: number; totalPages: number }> {
    const [data, total] = await this.activityLogRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // For admins to see ALL logs with optional filters
  async findAll(
    page: number = 1,
    limit: number = 50,
    userId?: number,
    action?: string,
  ): Promise<{ data: ActivityLog[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.activityLogRepository.createQueryBuilder('log');

    // Apply filters if provided
    if (userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId });
    }

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    queryBuilder
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}