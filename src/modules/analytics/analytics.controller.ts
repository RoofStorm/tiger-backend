import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import {
  CreateAnalyticsEventsBatchDto,
  CreateAnalyticsEventDto,
} from './dto/create-analytics-event.dto';
import { AnalyticsSummaryQueryDto } from './dto/analytics-summary.dto';
import { AnalyticsAnalysisQueryDto } from './dto/analytics-analysis.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Public endpoint for ingesting analytics events (batch)
   * No authentication required - uses sessionId for anonymous tracking
   */
  @Post('events')
  @ApiOperation({ summary: 'Record analytics events (Public, batch)' })
  @ApiResponse({
    status: 200,
    description: 'Events recorded successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async ingestEvents(
    @Body() body: CreateAnalyticsEventsBatchDto,
    @Request() req,
  ) {
    // Optional authentication - if user is logged in, record with userId
    const userId = req.user?.id;
    return this.analyticsService.ingestEvents(
      body.events,
      body.sessionId,
      userId,
    );
  }

  /**
   * Get analytics summary by page/zone
   * Uses aggregate table for performance
   * Supports optional date range filter (from/to), defaults to last 30 days
   */
  @Get('summary')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get analytics summary by page/zone (Admin only)',
    description:
      'Returns aggregated analytics summary. Supports optional date range (from/to), defaults to last 30 days if not provided. Max date range: 90 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range',
  })
  async getSummary(
    @Query() query: AnalyticsSummaryQueryDto,
    @Request() req,
  ) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    return this.analyticsService.getSummary(query);
  }

  /**
   * Get raw analytics data in table format
   * Raw but readable - each row represents one meaningful behavior
   * Marketing can read and process this data directly (like Excel)
   * 
   * Principles:
   * - 1 row = 1 meaningful behavior
   * - No inferred percentages or funnel logic
   * - Readable like Excel
   * - No need to understand internal event schema
   */
  @Get('analysis')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get raw analytics data in table format (Admin only)',
    description:
      'Returns raw analytics data in table format for reporting. Each row represents one meaningful behavior. ' +
      'Marketing can read and process this data directly. Supports filtering by date range, page, zone, and action. ' +
      'Max date range: 90 days. Supports pagination with limit and cursor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Raw analytics data retrieved successfully in table format',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range',
  })
  async getAnalysis(
    @Query() query: AnalyticsAnalysisQueryDto,
    @Request() req,
  ) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    return this.analyticsService.getAnalysis(query);
  }

  /**
   * Get all available actions, pages, zones, and components
   * Useful for admin to see what data is available in the system
   */
  @Get('available-data')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all available analytics data (Admin only)',
    description:
      'Returns list of all pages, zones, actions, and components available in the system (last 30 days)',
  })
  @ApiResponse({
    status: 200,
    description: 'Available data retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAvailableData(@Request() req) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    return this.analyticsService.getAvailableData();
  }

  // Legacy endpoints (deprecated, kept for backward compatibility)
  @Post('corners')
  @ApiOperation({ summary: '[DEPRECATED] Record corner analytics' })
  @ApiResponse({ status: 201, description: 'Analytics recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async createCornerAnalytics(
    @Body() body: { events: any[] },
    @Request() req,
  ) {
    const userId = req.user?.id;
    return this.analyticsService.createCornerAnalyticsBatch(
      body.events,
      userId,
    );
  }

  @Get('corner/:corner/summary')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[DEPRECATED] Get corner analytics summary' })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerSummary(@Query('corner') corner: string, @Request() req) {
    return this.analyticsService.getCornerSummary(corner, req.user.id);
  }

  @Get('corners')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[DEPRECATED] Get all corner analytics data' })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllCornerAnalytics(@Request() req) {
    return this.analyticsService.getAllCornerAnalytics(req.user.id);
  }

  @Get('corner/stats')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[DEPRECATED] Get all corners analytics stats' })
  @ApiResponse({
    status: 200,
    description: 'Analytics stats retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerStats(@Request() req) {
    return this.analyticsService.getCornerStats(req.user.id);
  }
}
