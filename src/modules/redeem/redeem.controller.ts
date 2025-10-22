import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RedeemService } from './redeem.service';
import { CreateRedeemDto } from './dto/create-redeem.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { RedeemStatus } from '@prisma/client';

@ApiTags('Redeem')
@Controller('api/redeems')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class RedeemController {
  constructor(private readonly redeemService: RedeemService) {}

  @Get()
  @ApiOperation({ summary: 'Get user redeem history' })
  @ApiResponse({
    status: 200,
    description: 'Redeem history retrieved successfully',
  })
  async getUserRedeems(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    console.log('🔍 RedeemController.getUserRedeems called');
    console.log('🔍 Request user:', req.user);
    console.log('🔍 User ID:', req.user?.id);

    if (!req.user) {
      console.log('❌ No user found in request');
      throw new Error('User not authenticated');
    }

    return this.redeemService.getUserRedeems(req.user.id, page, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new redeem request' })
  @ApiResponse({
    status: 201,
    description: 'Redeem request created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid gift code or insufficient points',
  })
  async createRedeem(@Body() createRedeemDto: CreateRedeemDto, @Request() req) {
    return this.redeemService.createRedeem(createRedeemDto, req.user.id);
  }

  @Get('admin')
  @ApiOperation({ summary: 'Get all redeems (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'All redeems retrieved successfully',
  })
  async getAllRedeems(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: RedeemStatus,
  ) {
    return this.redeemService.getAllRedeems(page, limit, status, req.user?.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update redeem status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Redeem status updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateRedeemStatus(
    @Param('id') redeemId: string,
    @Body() body: { status: RedeemStatus; rejectionReason?: string },
    @Request() req,
  ) {
    return this.redeemService.updateRedeemStatus(
      redeemId,
      body.status,
      req.user.id,
      body.rejectionReason,
    );
  }
}
