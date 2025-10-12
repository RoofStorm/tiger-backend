import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GrantPointsDto } from './dto/grant-points.dto';

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  async awardPoints(
    userId: string,
    points: number,
    reason: string,
    referralUrl?: string,
  ) {
    // Check daily limits based on reason
    await this.checkDailyLimits(userId, reason);

    // Create point log
    const pointLog = await this.prisma.pointLog.create({
      data: {
        userId,
        points,
        reason,
        referralUrl,
      },
    });

    // Update user points
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: points,
        },
      },
    });

    return pointLog;
  }

  async grantPoints(grantPointsDto: GrantPointsDto, adminId: string) {
    const { userId, points, reason, note } = grantPointsDto;

    // Verify admin
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || admin.role !== 'ADMIN') {
      throw new BadRequestException('Only admins can grant points');
    }

    return this.awardPoints(userId, points, reason, undefined);
  }

  async getPointsHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointLog.count({
        where: { userId },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        points: true,
        _count: {
          select: {
            pointLogs: true,
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      currentPoints: user.points,
      totalEarned: await this.getTotalEarnedPoints(userId),
      totalSpent: await this.getTotalSpentPoints(userId),
      totalActions: user._count.pointLogs,
    };
  }

  private async checkDailyLimits(userId: string, reason: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLogs = await this.prisma.pointLog.findMany({
      where: {
        userId,
        reason,
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Business rules for daily limits
    const limits = {
      'Daily login bonus': 1,
      'Share post': 1,
      'Like post': 10, // Allow up to 10 likes per day
      'Unlike post': 10, // Allow up to 10 unlikes per day
      'Create post': 5, // Allow up to 5 posts per day
      'Challenge keep rhythm': 1, // Weekly limit handled separately
      'Challenge confession': 1, // Weekly limit handled separately
      'Invite friend': 2, // Weekly limit handled separately
    };

    const limit = limits[reason];
    if (limit && todayLogs.length >= limit) {
      throw new BadRequestException(`Daily limit reached for ${reason}`);
    }

    // Check weekly limits
    if (reason.includes('Challenge') || reason === 'Invite friend') {
      await this.checkWeeklyLimits(userId, reason);
    }
  }

  private async checkWeeklyLimits(userId: string, reason: string) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekLogs = await this.prisma.pointLog.findMany({
      where: {
        userId,
        reason,
        createdAt: {
          gte: weekAgo,
        },
      },
    });

    const weeklyLimits = {
      'Challenge keep rhythm': 1,
      'Challenge confession': 1,
      'Invite friend': 2,
    };

    const limit = weeklyLimits[reason];
    if (limit && weekLogs.length >= limit) {
      throw new BadRequestException(`Weekly limit reached for ${reason}`);
    }
  }

  private async getTotalEarnedPoints(userId: string): Promise<number> {
    const result = await this.prisma.pointLog.aggregate({
      where: {
        userId,
        points: {
          gt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    return result._sum.points || 0;
  }

  private async getTotalSpentPoints(userId: string): Promise<number> {
    const result = await this.prisma.pointLog.aggregate({
      where: {
        userId,
        points: {
          lt: 0,
        },
      },
      _sum: {
        points: true,
      },
    });

    return Math.abs(result._sum.points || 0);
  }
}
