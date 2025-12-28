import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AnalyticsSummaryQueryDto {
  @ApiProperty({
    example: 'challenge',
    description: 'Page identifier',
    required: false,
  })
  @IsString()
  @IsOptional()
  page?: string;

  @ApiProperty({
    example: 'zoneB2',
    description: 'Zone identifier',
    required: false,
  })
  @IsString()
  @IsOptional()
  zone?: string;
}

export class AnalyticsSummaryResponseDto {
  @ApiProperty({ example: 'challenge' })
  page: string;

  @ApiProperty({ example: 'zoneB2', required: false })
  zone?: string;

  @ApiProperty({ example: 1250, description: 'Total events' })
  totalEvents: number;

  @ApiProperty({ example: 45.5, description: 'Average time in seconds' })
  avgTime: number;

  @ApiProperty({ example: 320, description: 'Total clicks' })
  totalClicks: number;

  @ApiProperty({ example: 150, description: 'Unique sessions' })
  uniqueSessions: number;

  @ApiProperty({ example: 0.75, description: 'Completion rate (0-1)' })
  completionRate?: number;
}

