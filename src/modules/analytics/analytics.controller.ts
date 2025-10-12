import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CreateCornerAnalyticsDto } from './dto/create-corner-analytics.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('corners')
  @ApiOperation({ summary: 'Record corner analytics' })
  @ApiResponse({ status: 201, description: 'Analytics recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async createCornerAnalytics(
    @Body() body: { events: CreateCornerAnalyticsDto[] },
    @Request() req,
  ) {
    // Optional authentication - if user is logged in, record with userId
    const userId = req.user?.id;
    return this.analyticsService.createCornerAnalyticsBatch(
      body.events,
      userId,
    );
  }

  @Get('corner/:corner/summary')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get corner analytics summary (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics summary retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerSummary(@Param('corner') corner: number, @Request() req) {
    return this.analyticsService.getCornerSummary(corner, req.user.id);
  }

  @Get('corners')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all corner analytics data (Admin only)' })
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
  @ApiOperation({ summary: 'Get all corners analytics stats (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics stats retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerStats(@Request() req) {
    return this.analyticsService.getCornerStats(req.user.id);
  }

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
}
