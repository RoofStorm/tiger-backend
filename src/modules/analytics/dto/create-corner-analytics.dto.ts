import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateCornerAnalyticsDto {
  @ApiProperty({ example: 'corner1', description: 'Corner identifier as string' })
  @IsString()
  @IsNotEmpty()
  corner: string;

  @ApiProperty({ example: 120, minimum: 1 })
  @IsNumber()
  @Min(1)
  durationSec: number;
}

