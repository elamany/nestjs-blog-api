import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { ActivityLogService, LogMetadata } from '../services/activity-log.service';
import { ActivityAction } from '../entities/activity-log.entity';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const ipAddress = (ip || request.socket.remoteAddress || 'unknown').replace('::ffff:', '');
    
    // Returns `number` if logged in, or `undefined` if not
    const userId = (request as any).user?.id;

    const { action, resourceType, resourceId, description } = this.parseRequestInfo(method, url);

    const metadata: LogMetadata = { ipAddress, userAgent };

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.activityLogService.saveLog({
          userId,
          action,
          description: `${description} - Success (${statusCode}, ${responseTime}ms)`,
          resourceType,
          resourceId,
          metadata,
        });
      }),
      catchError((error) => {
        const responseTime = Date.now() - startTime;
        const statusCode = error.status || error.statusCode || 500;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.activityLogService.saveLog({
          userId,
          action,
          description: `${description} - Failed (${statusCode}): ${errorMessage}`,
          resourceType,
          resourceId,
          metadata, 
        });

        return throwError(() => error);
      }),
    );
  }

  private parseRequestInfo(method: string, url: string) {
    let action: ActivityAction = ActivityAction.READ;
    let resourceType = 'UNKNOWN';
    let resourceId: number | undefined = undefined;
    let description = `${method} ${url}`;

    const urlParts = url.split('/').filter(Boolean);

    if (url.includes('/auth/login')) {
      action = ActivityAction.LOGIN;
      resourceType = 'User';
      description = 'User login attempt';
    } else if (url.includes('/auth/logout')) {
      action = ActivityAction.LOGOUT;
      resourceType = 'User';
      description = 'User logout';
    } else if (url.includes('/auth/register')) {
      action = ActivityAction.REGISTER;
      resourceType = 'User';
      description = 'New user registration';
    } else if (urlParts.length > 0) {
      resourceType = this.capitalizeFirst(urlParts[0]);
      
      if (urlParts.length > 1 && !isNaN(Number(urlParts[1]))) {
        resourceId = Number(urlParts[1]);
      }

      if (method === 'POST') action = ActivityAction.CREATE_POST;
      else if (method === 'PUT' || method === 'PATCH') action = ActivityAction.UPDATE_POST;
      else if (method === 'DELETE') action = ActivityAction.DELETE_POST;
    }

    return { action, resourceType, resourceId, description };
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}