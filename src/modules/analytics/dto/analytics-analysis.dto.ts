import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsAnalysisQueryDto {
  @ApiProperty({
    example: '2025-01-01',
    description: 'Start date (ISO format: YYYY-MM-DD). Required.',
  })
  @IsDateString()
  @IsString()
  from: string;

  @ApiProperty({
    example: '2025-01-31',
    description: 'End date (ISO format: YYYY-MM-DD). Required.',
  })
  @IsDateString()
  @IsString()
  to: string;

  @ApiProperty({
    example: 'challenge',
    description: 'Page identifier. Optional filter.',
    required: false,
  })
  @IsString()
  @IsOptional()
  page?: string;

  @ApiProperty({
    example: 'zoneB1',
    description: 'Zone identifier. Optional filter (only works when page is provided).',
    required: false,
  })
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiProperty({
    example: 'click',
    description: 'Action type. Optional filter.',
    required: false,
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiProperty({
    example: 100,
    description: 'Maximum number of rows to return. Default: 100, Max: 1000.',
    required: false,
    default: 100,
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    example: 'eyJkYXRlIjoiMjAyNS0wMS0xMCIsInBhZ2UiOiJjaGFsbGVuZ2UiLCJ6b25lIjpudWxsLCJhY3Rpb24iOiJjbGljayIsImNvbXBvbmVudCI6InVwbG9hZF9idXR0b24ifQ==',
    description: 'Cursor for pagination. Use the cursor from previous response to get next page.',
    required: false,
  })
  @IsString()
  @IsOptional()
  cursor?: string;
}

export class AnalyticsAnalysisRowDto {
  @ApiProperty({ example: '2025-01-10', description: 'Date (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ example: '2025-01-10T10:00:00.000Z', description: 'Full timestamp of the event' })
  timestamp: string;

  @ApiProperty({ example: 'challenge', description: 'Page identifier' })
  page: string;

  @ApiProperty({ example: 'zoneB1', description: 'Zone identifier (null for page-level)', required: false })
  zone?: string | null;

  @ApiProperty({ example: 'view', description: 'Action type: view, click, duration' })
  action: string;

  @ApiProperty({ example: 'upload_button', description: 'Component identifier (null if not applicable)', required: false })
  component?: string | null;

  @ApiProperty({ example: 120, description: 'Value: count for views/clicks, average for duration' })
  value: number;

  @ApiProperty({ example: 'views', description: 'Unit: views, clicks, or seconds' })
  unit: string;

  @ApiProperty({ 
    example: { type: 'page_view', description: 'Page view event' }, 
    description: 'Metadata describing the behavior',
    required: false 
  })
  metadata?: Record<string, any>;
}

export class AnalyticsAnalysisResponseDto {
  @ApiProperty({
    example: ['date', 'page', 'zone', 'action', 'component', 'value', 'unit', 'metadata'],
    description: 'Column names for the table',
    type: [String],
  })
  columns: string[];

  @ApiProperty({
    type: [AnalyticsAnalysisRowDto],
    description: 'Table rows - each row represents one meaningful behavior',
  })
  rows: AnalyticsAnalysisRowDto[];

  @ApiProperty({
    example: 'eyJkYXRlIjoiMjAyNS0wMS0xMCIsInBhZ2UiOiJjaGFsbGVuZ2UiLCJ6b25lIjpudWxsLCJhY3Rpb24iOiJjbGljayIsImNvbXBvbmVudCI6InVwbG9hZF9idXR0b24ifQ==',
    description: 'Cursor for next page. Use this cursor in next request to get more results. Null if no more results.',
    required: false,
  })
  nextCursor?: string | null;

  @ApiProperty({
    example: 100,
    description: 'Number of rows returned in this response',
  })
  count: number;

  @ApiProperty({
    example: true,
    description: 'Whether there are more results available',
  })
  hasMore: boolean;
}

