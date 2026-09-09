import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from '../entities/activity-log.entity';

export interface LogMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface LogParams {
  userId?: number;
  action: ActivityAction;
  description: string;
  resourceType?: string;
  resourceId?: number;
  metadata?: LogMetadata;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  // SINGLE ENTRY POINT for all logging across the app
  async saveLog(params: LogParams): Promise<void> {
    try {
      const log = this.activityLogRepository.create({
        userId: params.userId,
        action: params.action,
        description: params.description,
        ipAddress: params.metadata?.ipAddress,
        userAgent: params.metadata?.userAgent,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      });
      await this.activityLogRepository.save(log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save activity log: ${errorMessage}`);
    }
  }

  // for users to view their own logs
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

  // for admin to view all logs with optional filters
   async findAll(
    page: number = 1,
    limit: number = 50,
    userId?: number,
    action?: string,
  ): Promise<{ data: ActivityLog[]; total: number; page: number; totalPages: number }> {
    const queryBuilder = this.activityLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email', 'user.role']);

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