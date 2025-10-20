import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserLimitService } from '../limits/user-limit.service';
import { POINTS, REFERRAL_LIMITS } from '../../constants/points';
import { LimitType } from '@prisma/client';

@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private userLimitService: UserLimitService,
  ) {}

  // Generate unique referral code with better format
  async generateReferralCode(): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const prefix = 'TIGER'; // Brand prefix for easy identification
    let result = '';

    // Try to generate unique code (max 20 attempts)
    for (let i = 0; i < 20; i++) {
      result = prefix;
      // Add 6 random characters
      for (let j = 0; j < 6; j++) {
        result += characters.charAt(
          Math.floor(Math.random() * characters.length),
        );
      }

      // Check if code already exists
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: result },
      });

      if (!existing) {
        return result;
      }
    }

    // Fallback: use timestamp + random with prefix
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  // Create or get referral code for user
  async getOrCreateReferralCode(userId: string): Promise<string> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate new referral code
    const referralCode = await this.generateReferralCode();

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode },
    });

    return referralCode;
  }

  // Process referral when new user signs up
  async processReferral(
    newUserId: string,
    referralCode: string,
  ): Promise<{ success: boolean; message: string; pointsAwarded: boolean }> {
    try {
      // Find referrer by code
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode },
      });

      if (!referrer) {
        return {
          success: false,
          message: 'Referral code not found',
          pointsAwarded: false,
        };
      }

      // Check if user is trying to refer themselves
      if (referrer.id === newUserId) {
        return {
          success: false,
          message: 'Cannot refer yourself',
          pointsAwarded: false,
        };
      }

      // Check if user was already referred
      const existingUser = await this.prisma.user.findUnique({
        where: { id: newUserId },
        select: { referredBy: true },
      });

      if (existingUser?.referredBy) {
        return {
          success: false,
          message: 'User already referred by someone else',
          pointsAwarded: false,
        };
      }

      // Always link the new user to referrer (no limit on referrals)
      await this.prisma.user.update({
        where: { id: newUserId },
        data: { referredBy: referrer.id },
      });

      // Award points to referrer using UserLimitService
      const pointsAwarded = await this.userLimitService.awardBonus(
        referrer.id,
        LimitType.REFERRAL_WEEKLY,
        'Referral bonus',
        `Referred user: ${newUserId}`,
      );

      if (pointsAwarded) {
        console.log(
          `✅ Referral processed: ${referrer.email} referred ${newUserId} (+${POINTS.REFERRAL_BONUS} points)`,
        );
      } else {
        console.log(
          `✅ Referral processed: ${referrer.email} referred ${newUserId} (no points - weekly limit reached)`,
        );
      }

      return {
        success: true,
        message: pointsAwarded
          ? `Referral processed successfully (+${POINTS.REFERRAL_BONUS} points)`
          : 'Referral processed successfully (no points - weekly limit reached)',
        pointsAwarded,
      };
    } catch (error) {
      console.error('❌ Error processing referral:', error);
      return {
        success: false,
        message: 'Error processing referral',
        pointsAwarded: false,
      };
    }
  }

  // Get referral stats for user
  async getReferralStats(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referrals: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        pointLogs: {
          where: {
            reason: 'Referral bonus',
          },
          select: {
            points: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Auto-generate referral code if user doesn't have one
    if (!user.referralCode) {
      console.log(`🔄 Auto-generating referral code for user: ${userId}`);
      try {
        const referralCode = await this.generateReferralCode();
        console.log(`🔧 Generated code: ${referralCode}`);

        // Update user with new referral code
        await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode },
        });
        console.log(`💾 Updated user in database`);

        // Update user object for return
        user.referralCode = referralCode;
        console.log(`✅ Referral code generated: ${referralCode}`);
      } catch (error) {
        console.error(`❌ Error generating referral code:`, error);
      }
    }

    const totalReferrals = user.referrals.length;
    const totalEarned = user.pointLogs.reduce(
      (sum, log) => sum + log.points,
      0,
    );

    // Get current week's referral count using UserLimitService
    const limitStats = await this.userLimitService.getLimitStats(
      userId,
      LimitType.REFERRAL_WEEKLY,
    );
    const weeklyPointsAwarded = limitStats.currentCount;
    const weeklyPointsLimit = limitStats.maxCount;
    const canEarnMorePoints = limitStats.canEarnMorePoints;

    const referralLink = this.generateReferralLink(user.referralCode);
    console.log(
      `🔗 Generated referral link: ${referralLink} for code: ${user.referralCode}`,
    );

    return {
      referralCode: user.referralCode,
      referralLink,
      totalReferrals,
      totalEarned,
      referrals: user.referrals,
      weeklyStats: {
        pointsAwarded: weeklyPointsAwarded,
        pointsLimit: weeklyPointsLimit,
        canEarnMorePoints,
        weekStart: limitStats.period,
        // Calculate total referrals this week (including those without points)
        totalReferralsThisWeek: user.referrals.filter((referral) => {
          const referralDate = new Date(referral.createdAt);
          const weekStart = new Date(limitStats.period);
          return referralDate >= weekStart;
        }).length,
      },
    };
  }

  // Generate referral link
  generateReferralLink(referralCode: string): string {
    const baseUrl =
      process.env.NEXT_PUBLIC_PUBLIC_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    return `${baseUrl}/auth/register?ref=${referralCode}`;
  }
}
