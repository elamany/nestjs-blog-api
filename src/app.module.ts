import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ActivityLogModule } from './common/activity-log.module';
//import { ActivityLogInterceptor } from './common/interceptors/activity-log.interceptor';
import { AdminModule } from './admin/admin.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: seconds(60),
        limit: 60,
      },
    ]),

    UsersModule,
    AuthModule,
    ActivityLogModule,
    AdminModule, 
    PostsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    /*{
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },*/
  ],
})
export class AppModule {}