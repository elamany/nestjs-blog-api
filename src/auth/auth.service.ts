import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '@/users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '@/users/dto/create-user.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

export interface TokenMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(createUserDto: CreateUserDto): Promise<{ message: string }> {
    await this.usersService.create(createUserDto);
    this.logger.log(`New user account created: ${createUserDto.email}`);
    return { message: 'User registered successfully. Please log in.' };
  }

  async login(
    loginDto: LoginDto,
    metadata?: TokenMetadata,
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.generateTokens(user.id, user.email, user.role, metadata);
  }

    async logout(userId: number, refreshToken: string): Promise<void> {
        if (!refreshToken) {
            throw new BadRequestException('Refresh token is required in the request body');
        }
        const hashedToken = await bcrypt.hash(refreshToken, 10);
        const tokenRecord = await this.refreshTokenRepository.findOne({
            where: { userId, token: hashedToken, isRevoked: false },
        });

        if (tokenRecord) {
            tokenRecord.isRevoked = true;
            await this.refreshTokenRepository.save(tokenRecord);
            this.logger.log(`User ${userId} logged out successfully`);
        } else {
            this.logger.warn(`Logout attempt with invalid or already revoked refresh token for user ${userId}`);
        }
    }

  private async generateTokens(
    userId: number,
    email: string,
    role: string,
    metadata?: TokenMetadata,
  ): Promise<AuthResponseDto> {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });

    const rawRefreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const tokenEntity = this.refreshTokenRepository.create({
      userId,
      token: hashedRefreshToken,
      expiresAt,
      isRevoked: false,
      ipAddress: metadata?.ipAddress || null,
      userAgent: metadata?.userAgent || null,
      deviceName: metadata?.deviceName || null,
    });

    await this.refreshTokenRepository.save(tokenEntity);

    const user = await this.usersService.findById(userId);

    const cleanUser = {
      id: user!.id,
      firstName: user!.firstName,
      lastName: user!.lastName,
      email: user!.email,
      role: user!.role,
    };

    this.logger.log(
      `New session created for user ${userId} from ${metadata?.ipAddress || 'unknown IP'}`,
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: cleanUser,
    };
  }
}
