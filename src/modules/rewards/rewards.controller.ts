import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { RewardsService } from './rewards.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Rewards')
@Controller('api/rewards')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all rewards' })
  @ApiResponse({ status: 200, description: 'Rewards retrieved successfully' })
  async getAllRewards(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.rewardsService.getAllRewards(page, limit, isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reward by ID' })
  @ApiResponse({ status: 200, description: 'Reward retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async getRewardById(@Param('id') id: string) {
    return this.rewardsService.getRewardById(id);
  }

  @Post()
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new reward (Admin only)' })
  @ApiResponse({ status: 201, description: 'Reward created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createReward(@Body() createRewardDto: any, @Request() req) {
    return this.rewardsService.createReward(createRewardDto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a reward (Admin only)' })
  @ApiResponse({ status: 200, description: 'Reward updated successfully' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateReward(
    @Param('id') id: string,
    @Body() updateRewardDto: any,
    @Request() req,
  ) {
    return this.rewardsService.updateReward(id, updateRewardDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soft delete a reward (Admin only)' })
  @ApiResponse({ status: 200, description: 'Reward soft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Reward is already inactive' })
  async deleteReward(@Param('id') id: string, @Request() req) {
    return this.rewardsService.deleteReward(id, req.user.id);
  }
}
