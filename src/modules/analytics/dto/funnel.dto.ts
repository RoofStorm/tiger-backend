import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FunnelQueryDto {
  @ApiProperty({
    example: '2025-01-01',
    description: 'Start date (ISO format: YYYY-MM-DD). Required.',
  })
  @IsDateString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({
    example: '2025-01-31',
    description: 'End date (ISO format: YYYY-MM-DD). Required.',
  })
  @IsDateString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    example: 'challenge',
    description: 'Page identifier. Required for Funnel Analytics - primary filter. Note: Page is only required for funnel, other analytics endpoints may not require it.',
  })
  @IsString()
  @IsNotEmpty()
  page: string;

  @ApiProperty({
    example: 'zone_b1',
    description: 'Zone identifier. Optional - contextual filter (only enabled when page is selected). Must belong to the selected page.',
    required: false,
  })
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiProperty({
    example: 'image_upload',
    description: 'Flow identifier. Optional - for specific flow tracking within page/zone.',
    required: false,
  })
  @IsString()
  @IsOptional()
  flow?: string;
}

export class FunnelStepDto {
  @ApiProperty({ example: 'view', description: 'Step action name' })
  step: string;

  @ApiProperty({ example: 1200, description: 'Number of users who reached this step' })
  users: number;

  @ApiProperty({ 
    example: 100, 
    description: 'Percentage of users relative to previous step (for funnel chart visualization)' 
  })
  pct_from_prev: number;

  @ApiProperty({ 
    example: 100, 
    description: 'Percentage of users relative to first step (for conversion KPI)' 
  })
  pct_from_start: number;

  @ApiProperty({ 
    example: 'button', 
    description: 'Most common component for this step (optional)',
    required: false 
  })
  component?: string;

  @ApiProperty({ 
    example: 45.5, 
    description: 'For "click" step: count of clicks for the component. For other steps: average value (e.g., duration in seconds for view actions). Optional.',
    required: false 
  })
  value?: number;

  @ApiProperty({ 
    example: { imageId: '123', label: 'tham_gia_ngay' }, 
    description: 'Metadata associated with this step (most common metadata if multiple exist)',
    required: false 
  })
  metadata?: Record<string, any>;
}

export class DropOffDto {
  @ApiProperty({ example: 'start', description: 'From step' })
  from: string;

  @ApiProperty({ example: 'submit', description: 'To step' })
  to: string;

  @ApiProperty({ example: 0.22, description: 'Drop-off rate (0-1)' })
  rate: number;
}

export class FunnelContextDto {
  @ApiProperty({ example: 'challenge' })
  page: string;

  @ApiProperty({ example: 'zone_b1', required: false })
  zone?: string;

  @ApiProperty({ example: 'image_upload', required: false })
  flow?: string;

  @ApiProperty({ 
    example: 1200, 
    description: 'Total unique users in the first step (view step) - helps with debugging and caption rendering' 
  })
  total_users: number;
}

export class FunnelResponseDto {
  @ApiProperty({ type: FunnelContextDto, description: 'Filter context' })
  context: FunnelContextDto;

  @ApiProperty({ type: [FunnelStepDto], description: 'Funnel steps in order' })
  steps: FunnelStepDto[];

  @ApiProperty({ 
    example: 0.5333, 
    description: 'Overall conversion rate = complete / view (first step to last step). This represents the end-to-end conversion rate.' 
  })
  conversion_rate: number;

  @ApiProperty({ 
    type: [DropOffDto], 
    description: 'Drop-off analysis between steps',
    required: false 
  })
  drop_off?: DropOffDto[];
}

