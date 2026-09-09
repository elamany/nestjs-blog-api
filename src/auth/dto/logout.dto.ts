import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({ 
    description: 'The refresh token to be revoked',
    example: 'eyJhbGciOiJIUzI1NiIsInR.....ox890'})
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @MinLength(20, { message: 'Refresh token is too short' })
  refreshToken: string;
}