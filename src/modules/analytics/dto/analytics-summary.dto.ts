import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class AnalyticsSummaryQueryDto {
  @ApiProperty({
    example: '2025-01-01',
    description: 'Start date (ISO format: YYYY-MM-DD). Optional - defaults to 30 days ago if not provided.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({
    example: '2025-01-31',
    description: 'End date (ISO format: YYYY-MM-DD). Optional - defaults to today if not provided.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  to?: string;

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

  @ApiProperty({
    example: { from: '2025-01-01', to: '2025-01-31' },
    description: 'Date range for the summary',
  })
  dateRange: {
    from: string;
    to: string;
  };

  @ApiProperty({ example: 1250, description: 'Total views' })
  totalViews: number;

  @ApiProperty({ example: 320, description: 'Total clicks' })
  totalClicks: number;

  @ApiProperty({ example: 12500.5, description: 'Total duration in seconds (sum of all durations)' })
  totalDurations: number;

  @ApiProperty({ example: 45.5, description: 'Average duration in seconds' })
  avgDuration: number;

  @ApiProperty({ example: 150, description: 'Unique sessions' })
  uniqueSessions: number;
}

