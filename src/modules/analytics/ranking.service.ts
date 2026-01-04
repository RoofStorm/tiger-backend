import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RewardCategory, RewardType, NotificationType } from '@prisma/client';

@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Run at 23:59 on the last day of every month
   */
  @Cron('59 23 * * *') // Run daily at 23:59, then check if it's the last day of the month
  async handleMonthlyRanking() {
    const now = new Date();
    const isLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();

    if (!isLastDay) {
      return;
    }

    this.logger.log('Starting monthly post ranking process...');

    try {
      await this.processMonthlyRanking();
      this.logger.log('Monthly post ranking process completed successfully.');
    } catch (error) {
      this.logger.error('Error processing monthly ranking:', error);
    }
  }

  async processMonthlyRanking() {
    const now = new Date();
    // Use UTC for consistent monthly boundaries
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Step 1: Identify users who have ever won
    const winners = await this.prisma.monthlyPostRanking.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    const winnerBlacklist = winners.map((w) => w.userId);

    // Step 2: Get Top posts from distinct users
    const candidatePosts = await this.prisma.post.findMany({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        userId: {
          notIn: winnerBlacklist,
        },
        likeCount: {
          gt: 0, // Must have at least one like
        },
      },
      orderBy: {
        likeCount: 'desc',
      },
      take: 20, // Take more to filter distinct users in memory
    });

    const topPosts = [];
    const seenUserIds = new Set();

    for (const post of candidatePosts) {
      if (!seenUserIds.has(post.userId)) {
        seenUserIds.add(post.userId);
        topPosts.push(post);
      }
      if (topPosts.length === 2) break;
    }

    if (topPosts.length === 0) {
      this.logger.warn('No eligible posts found for this month.');
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < topPosts.length; i++) {
        const post = topPosts[i];
        const rank = i + 1;

        // Step 3: Idempotent record in MonthlyPostRanking
        await tx.monthlyPostRanking.upsert({
          where: {
            month_rank: {
              month: startOfMonth,
              rank: rank,
            },
          },
          update: {
            userId: post.userId,
            postId: post.id,
            likeCount: post.likeCount,
          },
          create: {
            month: startOfMonth,
            rank: rank,
            userId: post.userId,
            postId: post.id,
            likeCount: post.likeCount,
          },
        });

        // Step 4: Identify fixed reward ID based on rank
        const rewardId = rank === 1 ? 'voucher-1000k' : 'voucher-500k';

        // Step 5: Create Notification (Idempotent)
        const monthStr = `${now.getUTCMonth() + 1}/${now.getUTCFullYear()}`;
        
        const notifications = await tx.notification.findMany({
          where: {
            userId: post.userId,
            type: NotificationType.MONTHLY_RANK_WIN,
          },
        });

        const alreadyNotified = notifications.some((n) => {
          const meta = n.metadata as any;
          return meta?.month === startOfMonth.toISOString();
        });

        if (!alreadyNotified) {
          await tx.notification.create({
            data: {
              userId: post.userId,
              type: NotificationType.MONTHLY_RANK_WIN,
              title: '🎉 Chúc mừng bạn đã thắng giải tháng!',
              message: `Bạn đạt Top ${rank} bài viết nhiều like nhất tháng ${monthStr}. Phần thưởng của bạn đã sẵn sàng để đổi!`,
              metadata: {
                rewardId: rewardId,
                rank,
                month: startOfMonth.toISOString(),
              },
            },
          });
        }
      }
    });
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualRanking(year: number, month: number) {
    const targetMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    this.logger.log(`Manually triggering ranking for ${month}/${year} (UTC)`);

    const winners = await this.prisma.monthlyPostRanking.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    const winnerBlacklist = winners.map((w) => w.userId);

    const candidatePosts = await this.prisma.post.findMany({
      where: {
        createdAt: {
          gte: targetMonth,
          lte: endOfMonth,
        },
        userId: {
          notIn: winnerBlacklist,
        },
        likeCount: {
          gt: 0,
        },
      },
      orderBy: {
        likeCount: 'desc',
      },
      take: 20,
    });

    const topPosts = [];
    const seenUserIds = new Set();
    for (const post of candidatePosts) {
      if (!seenUserIds.has(post.userId)) {
        seenUserIds.add(post.userId);
        topPosts.push(post);
      }
      if (topPosts.length === 2) break;
    }

    const results = [];
    for (let i = 0; i < topPosts.length; i++) {
      const post = topPosts[i];
      const rank = i + 1;

      const ranking = await this.prisma.monthlyPostRanking.upsert({
        where: {
          month_rank: {
            month: targetMonth,
            rank: rank,
          },
        },
        create: {
          month: targetMonth,
          rank: rank,
          userId: post.userId,
          postId: post.id,
          likeCount: post.likeCount,
        },
        update: {
          userId: post.userId,
          postId: post.id,
          likeCount: post.likeCount,
        },
      });

      // Fixed reward ID based on rank
      const rewardId = rank === 1 ? 'voucher-1000k' : 'voucher-500k';

      // Create Notification (Idempotent)
      const monthStr = `${month}/${year}`;
      const notifications = await this.prisma.notification.findMany({
        where: {
          userId: post.userId,
          type: NotificationType.MONTHLY_RANK_WIN,
        },
      });

      const alreadyNotified = notifications.some((n) => {
        const meta = n.metadata as any;
        return meta?.month === targetMonth.toISOString();
      });

      if (!alreadyNotified) {
        await this.prisma.notification.create({
          data: {
            userId: post.userId,
            type: NotificationType.MONTHLY_RANK_WIN,
            title: '🎉 Chúc mừng bạn đã thắng giải tháng!',
            message: `Bạn đạt Top ${rank} bài viết nhiều like nhất tháng ${monthStr}. Phần thưởng của bạn đã sẵn sàng để đổi!`,
            metadata: {
              rewardId: rewardId,
              rank,
              month: targetMonth.toISOString(),
            },
          },
        });
      }

      results.push(ranking);
    }

    return results;
  }
}

