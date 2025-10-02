import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class GrantPointsDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  points: number;

  @ApiProperty({ example: 'Admin bonus' })
  @IsString()
  reason: string;

  @ApiProperty({ example: 'Special reward for participation', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

