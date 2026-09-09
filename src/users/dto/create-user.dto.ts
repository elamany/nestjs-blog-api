import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Abebe', description: 'User first name' })
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Kebede', description: 'User last name' })
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: 'you@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ 
    description: 'Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)' 
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/, {
    message: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number',
  })
  password: string;
}