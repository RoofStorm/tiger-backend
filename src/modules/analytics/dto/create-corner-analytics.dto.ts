import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';

export class CreateCornerAnalyticsDto {
  @ApiProperty({ example: 2, minimum: 0, maximum: 4 })
  @IsNumber()
  @Min(0)
  @Max(4)
  corner: number;

  @ApiProperty({ example: 120, minimum: 1 })
  @IsNumber()
  @Min(1)
  durationSec: number;
}

