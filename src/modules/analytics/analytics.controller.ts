import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
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
import { FunnelQueryDto } from './dto/funnel.dto';
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
   */
  @Get('summary')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analytics summary by page/zone (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
   * Get funnel/conversion metrics
   */
  @Get('funnel')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get funnel/conversion metrics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Funnel data retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getFunnel(@Query() query: FunnelQueryDto, @Request() req) {
    // Verify admin
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can view analytics');
    }

    return this.analyticsService.getFunnel(query);
  }

  /**
   * Get user analytics history
   */
  @Get('user')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user analytics history' })
  @ApiResponse({
    status: 200,
    description: 'User analytics retrieved successfully',
  })
  async getUserAnalytics(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.analyticsService.getUserAnalytics(req.user.id, page, limit);
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
