import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/activity-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my own activity logs' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivityLogs(
    @Req() req: Request & { user: { id: number } },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.usersService.getMyActivityLogs(req.user.id, page, limit);
  }
}