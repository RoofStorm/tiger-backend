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
import { PointsService } from './points.service';
import { GrantPointsDto } from './dto/grant-points.dto';
import { ProductCardClickDto } from './dto/product-card-click.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Points')
@Controller('api/points')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get user points history' })
  @ApiResponse({
    status: 200,
    description: 'Points history retrieved successfully',
  })
  async getPointsHistory(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.pointsService.getPointsHistory(req.user.id, page, limit);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get user points summary' })
  @ApiResponse({
    status: 200,
    description: 'Points summary retrieved successfully',
  })
  async getPointsSummary(@Request() req) {
    return this.pointsService.getUserPoints(req.user.id);
  }

  @Post('grant')
  @ApiOperation({ summary: 'Grant points to user (Admin only)' })
  @ApiResponse({ status: 201, description: 'Points granted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async grantPoints(@Body() grantPointsDto: GrantPointsDto, @Request() req) {
    return this.pointsService.grantPoints(grantPointsDto, req.user.id);
  }

  @Post('product-card-click')
  @ApiOperation({
    summary: 'Process product card clicks and award points',
    description:
      'Awards 10 points per click, maximum 8 clicks per user (lifetime). Accepts batch clicks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Product card clicks processed successfully',
    schema: {
      example: {
        awardedClicks: 5,
        totalPoints: 50,
        remainingClicks: 3,
        currentTotalClicks: 5,
        maxClicks: 8,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async processProductCardClicks(
    @Body() productCardClickDto: ProductCardClickDto,
    @Request() req,
  ) {
    return this.pointsService.processProductCardClicks(
      req.user.id,
      productCardClickDto.clickCount,
    );
  }
}
