import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class FunnelQueryDto {
  @ApiProperty({
    example: 'challenge',
    description: 'Page identifier',
  })
  @IsString()
  @IsNotEmpty()
  page: string;

  @ApiProperty({
    example: 'zoneB1',
    description: 'Zone identifier',
    required: false,
  })
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiProperty({
    example: ['start', 'upload', 'submit', 'complete'],
    description: 'Array of step actions in order',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  steps: string[];
}

export class FunnelStepDto {
  @ApiProperty({ example: 'start' })
  step: string;

  @ApiProperty({ example: 1000, description: 'Number of users who reached this step' })
  count: number;

  @ApiProperty({ example: 100, description: 'Percentage of users who reached this step' })
  percentage: number;
}

export class FunnelResponseDto {
  @ApiProperty({ example: 'challenge' })
  page: string;

  @ApiProperty({ example: 'zoneB1', required: false })
  zone?: string;

  @ApiProperty({ type: [FunnelStepDto] })
  steps: FunnelStepDto[];

  @ApiProperty({ example: 0.65, description: 'Overall conversion rate' })
  conversionRate: number;
}

