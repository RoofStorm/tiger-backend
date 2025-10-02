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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CreateCornerAnalyticsDto } from './dto/create-corner-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('corner')
  @ApiOperation({ summary: 'Record corner analytics' })
  @ApiResponse({ status: 201, description: 'Analytics recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async createCornerAnalytics(
    @Body() createCornerAnalyticsDto: CreateCornerAnalyticsDto,
    @Request() req,
  ) {
    // Optional authentication - if user is logged in, record with userId
    const userId = req.user?.id;
    return this.analyticsService.createCornerAnalytics(
      createCornerAnalyticsDto,
      userId,
    );
  }

  @Get('corner/:corner/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get corner analytics summary (Admin only)' })
  @ApiResponse({ status: 200, description: 'Analytics summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerSummary(@Param('corner') corner: number, @Request() req) {
    return this.analyticsService.getCornerSummary(corner, req.user.id);
  }

  @Get('corner/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all corners analytics stats (Admin only)' })
  @ApiResponse({ status: 200, description: 'Analytics stats retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCornerStats(@Request() req) {
    return this.analyticsService.getCornerStats(req.user.id);
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user analytics history' })
  @ApiResponse({ status: 200, description: 'User analytics retrieved successfully' })
  async getUserAnalytics(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.analyticsService.getUserAnalytics(req.user.id, page, limit);
  }
}

