import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService, TokenMetadata } from './auth.service';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { LogoutDto } from './dto/logout.dto';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<{ message: string }> {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get tokens' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const metadata = this.extractMetadata(req);
    return this.authService.login(loginDto, metadata);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 400, description: 'Missing refresh token' })
  @ApiResponse({ status: 401, description: 'Invalid token or unauthorized' })
  async logout(
    @Req() req: Request & { user: { id: number; email: string; role: string } },
    @Body() logoutDto: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(req.user.id, logoutDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll(
    @Req() req: Request & { user: { id: number; email: string; role: string } },
  ): Promise<{ message: string }> {
    await this.authService.logoutAll(req.user.id);
    return { message: 'Logged out from all devices successfully' };
  }

  private extractMetadata(req: Request): TokenMetadata {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    let deviceName = 'Unknown Device';
    if (userAgent.includes('Windows')) deviceName = 'Windows PC';
    else if (userAgent.includes('Mac')) deviceName = 'Mac';
    else if (userAgent.includes('Linux')) deviceName = 'Linux';
    else if (userAgent.includes('iPhone')) deviceName = 'iPhone';
    else if (userAgent.includes('Android')) deviceName = 'Android Device';

    return {
      ipAddress: ip.replace('::ffff:', ''),
      userAgent,
      deviceName,
    };
  }
}
