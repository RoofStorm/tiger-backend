import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnalyticsEventDto {
  @ApiProperty({
    example: 'challenge',
    description: 'Page identifier (welcome, emoji, challenge, nhip-bep, doi-qua, profile)',
  })
  @IsString()
  @IsNotEmpty()
  page: string;

  @ApiProperty({
    example: 'zoneB2',
    description: 'Zone in page (overview, zoneA, zoneB, zoneB1, zoneB2)',
    required: false,
  })
  @IsString()
  @IsOptional()
  zone?: string;

  @ApiProperty({
    example: 'button',
    description: 'Component type (button, card, image, showcase, upload, form)',
    required: false,
  })
  @IsString()
  @IsOptional()
  component?: string;

  @ApiProperty({
    example: 'click',
    description: 'Action type (page_view, zone_view, view, click, submit, start, complete, view_start, view_end). Note: page_view and zone_view should include value (duration in seconds)',
  })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({
    example: 45,
    description: 'Value (duration in seconds for page_view/zone_view, count, step index). Required for page_view and zone_view actions.',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiProperty({
    example: { imageId: '123', label: 'tham_gia_ngay' },
    description: 'Additional metadata',
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    example: 1766899229,
    description: 'Client timestamp (Unix timestamp in seconds). Server will use its own timestamp for consistency.',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  ts?: number;
}

export class CreateAnalyticsEventsBatchDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Session ID (required for anonymous tracking)',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({
    type: [CreateAnalyticsEventDto],
    description: 'Array of analytics events',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnalyticsEventDto)
  events: CreateAnalyticsEventDto[];
}

