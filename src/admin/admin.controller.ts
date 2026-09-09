import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivityLogService } from '@/common/services/activity-log.service';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { UserRole } from '@/users/enums/user-role.enum';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('activity-logs')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all activity logs (admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'userId', required: false, example: 1 })
  @ApiQuery({ name: 'action', required: false, example: 'LOGIN' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden (admin only)' })
  async getAllActivityLogs(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('userId') userId?: number,
    @Query('action') action?: string,
  ) {
    return this.activityLogService.findAll(page, limit, userId, action);
  }
}