import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token (15 min validity)' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token (7 days validity)' })
  refreshToken: string;

  @ApiProperty({ description: 'User information (without password)' })
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}