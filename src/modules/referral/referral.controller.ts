import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('referral')
@Controller('referral')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('test')
  @ApiOperation({ summary: 'Test endpoint' })
  async test() {
    return {
      success: true,
      message: 'Referral API is working!',
    };
  }

  @Get('code')
  @ApiOperation({ summary: 'Get or create referral code for user' })
  @ApiResponse({
    status: 200,
    description: 'Referral code retrieved successfully',
  })
  async getReferralCode(@Request() req) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          data: null,
        };
      }

      const referralCode =
        await this.referralService.getOrCreateReferralCode(userId);
      const referralLink =
        this.referralService.generateReferralLink(referralCode);

      return {
        success: true,
        data: {
          referralCode,
          referralLink,
        },
      };
    } catch (error) {
      console.error('Error in getReferralCode:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get referral statistics for user' })
  @ApiResponse({
    status: 200,
    description: 'Referral statistics retrieved successfully',
  })
  async getReferralStats(@Request() req) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
          data: null,
        };
      }

      const stats = await this.referralService.getReferralStats(userId);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Error in getReferralStats:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  @Post('process')
  @ApiOperation({ summary: 'Process referral for new user' })
  @ApiResponse({
    status: 200,
    description: 'Referral processed successfully',
  })
  async processReferral(
    @Body() body: { userId: string; referralCode: string },
  ) {
    try {
      const { userId, referralCode } = body;
      const result = await this.referralService.processReferral(
        userId,
        referralCode,
      );

      return {
        success: result.success,
        message: result.message,
        pointsAwarded: result.pointsAwarded,
      };
    } catch (error) {
      console.error('Error in processReferral:', error);
      return {
        success: false,
        message: 'Error processing referral',
        pointsAwarded: false,
      };
    }
  }
}
