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
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { RankingService } from './ranking.service';
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
  private readonly logger = new Logger(AnalyticsController.name);
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly rankingService: RankingService,
  ) {}

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
    const user = (req as any).user;
    const userId = user?.id;
    
    // Debug logging to help troubleshoot
    if (userId) {
      this.logger.debug(`[Analytics] Ingesting ${body.events.length} events for logged-in user: ${userId}`);
    } else {
      this.logger.debug(`[Analytics] Ingesting ${body.events.length} events for anonymous user (sessionId: ${body.sessionId})`);
    }
    
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

  @Get('export-excel')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Export analytics data to Excel with 2 sheets (Admin only)',
    description:
      'Exports analytics data to Excel file with 2 sheets: Summary (aggregated metrics) and Analysis (raw events). ' +
      'Supports filtering by date range, page, zone, and action. Max date range: 90 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded successfully',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range',
  })
  async exportAnalyticsToExcel(
    @Query() query: AnalyticsSummaryQueryDto,
    @Request() req,
    @Res() res: Response,
  ) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can export analytics');
    }

    return this.analyticsService.exportAnalyticsToExcel(query, res);
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

  @Get('monthly-rankings')
  @ApiOperation({ summary: 'Get monthly rankings history' })
  @ApiResponse({
    status: 200,
    description: 'Monthly rankings retrieved successfully',
  })
  async getMonthlyRankings(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.analyticsService.getMonthlyRankings(page, limit);
  }

  @Post('monthly-ranking/trigger')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger monthly ranking calculation manually (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly ranking triggered successfully',
  })
  async triggerMonthlyRanking(
    @Body() body: { year: number; month: number },
    @Request() req,
  ) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can trigger ranking');
    }

    return this.rankingService.triggerManualRanking(body.year, body.month);
  }
}
