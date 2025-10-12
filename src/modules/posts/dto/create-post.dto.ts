import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsUrl } from 'class-validator';
import { PostType } from '@prisma/client';

export class CreatePostDto {
  @ApiProperty({ enum: PostType, example: PostType.IMAGE, required: false })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiProperty({ example: 'Feeling great today! 🐅', required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
