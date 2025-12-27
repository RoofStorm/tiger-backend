import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsNotEmpty,
  IsUrl,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ 
    example: 'johndoe', 
    description: 'Username (unique). If not provided, will be generated from email.',
    required: false 
  })
  @ValidateIf((o) => !o.email || o.username)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới',
  })
  username?: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ 
    example: 'user@example.com', 
    required: false, 
    description: 'Email (optional, but required if username not provided)' 
  })
  @ValidateIf((o) => !o.username || o.email)
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'ABC123', required: false })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'johndoe', description: 'Username for local login' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới',
  })
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refreshToken: string;
}

export class OAuthDto {
  @ApiProperty({
    example: '4224389047824628',
    description: 'Facebook/Google User ID',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({
    example: 'trannhuanhvu099@gmail.com',
    description: 'Email (có thể là email tạm nếu không có)',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Vũ Trần', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'https://...', required: false })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldPassword123' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ example: 'newPassword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
