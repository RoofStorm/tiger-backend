import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { ReferralService } from '../referral/referral.service';

@ApiTags('Users')
@Controller('api/users')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly referralService: ReferralService,
  ) {}

  @Get(':id/points/logs')
  @ApiOperation({ summary: 'Get user points logs' })
  @ApiResponse({
    status: 200,
    description: 'Points logs retrieved successfully',
  })
  async getPointsLogs(
    @Param('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getPointsLogs(userId, page, limit);
  }

  @Get('referral/code')
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
          error: 'Người dùng chưa đăng nhập',
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
      this.logger.error('Error in getReferralCode:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  @Get('referral/stats')
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
          error: 'Người dùng chưa đăng nhập',
          data: null,
        };
      }

      const stats = await this.referralService.getReferralStats(userId);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error in getReferralStats:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
}
