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
}
