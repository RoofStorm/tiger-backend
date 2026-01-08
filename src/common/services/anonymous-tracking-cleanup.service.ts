import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AnonymousTrackingCleanupService {
  private readonly logger = new Logger(AnonymousTrackingCleanupService.name);
  private readonly ANONYMOUS_TIMESTAMPS_KEY = 'anonymous_users_timestamps';
  private readonly CONVERSION_SET_KEY = 'anonymous_to_user_conversions';
  private readonly RETENTION_DAYS = 30; // Giữ 30 ngày gần nhất

  constructor(private readonly redisService: RedisService) {}

  /**
   * Cleanup old anonymous user timestamps from sorted set
   * Chạy mỗi ngày lúc 3:00 AM (sau analytics cleanup lúc 2 AM)
   * Chỉ giữ 30 ngày gần nhất
   */
  @Cron('0 3 * * *') // Daily at 3:00 AM
  async cleanupAnonymousTimestamps() {
    this.logger.log('Starting cleanup of old anonymous user timestamps...');

    try {
      const now = Date.now();
      const cutoffTime = now - this.RETENTION_DAYS * 24 * 60 * 60 * 1000; // 30 days ago in milliseconds

      // Remove old entries from sorted set (score < cutoffTime)
      const removedCount = await this.redisService.removeFromSortedSetByScore(
        this.ANONYMOUS_TIMESTAMPS_KEY,
        0, // min score (oldest)
        cutoffTime - 1, // max score (just before cutoff)
      );

      this.logger.log(
        `Cleanup completed: ${removedCount} old anonymous user timestamps removed (kept last ${this.RETENTION_DAYS} days)`,
      );
    } catch (error) {
      this.logger.error('Error during anonymous timestamps cleanup:', error);
    }
  }

  /**
   * Cleanup old conversion records from sorted set
   * Chạy cùng lúc với cleanup timestamps
   * Chỉ giữ 90 ngày gần nhất (phù hợp với CONVERSION_TTL)
   */
  @Cron('0 3 * * *') // Daily at 3:00 AM
  async cleanupConversionTimestamps() {
    this.logger.log('Starting cleanup of old conversion timestamps...');

    try {
      const now = Date.now();
      const cutoffTime = now - 90 * 24 * 60 * 60 * 1000; // 90 days ago in milliseconds

      // Remove old entries from sorted set (score < cutoffTime)
      const removedCount = await this.redisService.removeFromSortedSetByScore(
        this.CONVERSION_SET_KEY,
        0, // min score (oldest)
        cutoffTime - 1, // max score (just before cutoff)
      );

      this.logger.log(
        `Cleanup completed: ${removedCount} old conversion timestamps removed (kept last 90 days)`,
      );
    } catch (error) {
      this.logger.error('Error during conversion timestamps cleanup:', error);
    }
  }

  /**
   * Manual cleanup method (có thể gọi từ admin API nếu cần)
   */
  async cleanupManually(retentionDays: number = this.RETENTION_DAYS): Promise<{
    anonymousTimestampsRemoved: number;
    conversionTimestampsRemoved: number;
  }> {
    this.logger.log(`Manual cleanup started with retention: ${retentionDays} days`);

    try {
      const now = Date.now();
      const cutoffTime = now - retentionDays * 24 * 60 * 60 * 1000;

      const [anonymousRemoved, conversionRemoved] = await Promise.all([
        this.redisService.removeFromSortedSetByScore(
          this.ANONYMOUS_TIMESTAMPS_KEY,
          0,
          cutoffTime - 1,
        ),
        this.redisService.removeFromSortedSetByScore(
          this.CONVERSION_SET_KEY,
          0,
          cutoffTime - 1,
        ),
      ]);

      this.logger.log(
        `Manual cleanup completed: ${anonymousRemoved} anonymous timestamps, ${conversionRemoved} conversion timestamps removed`,
      );

      return {
        anonymousTimestampsRemoved: anonymousRemoved,
        conversionTimestampsRemoved: conversionRemoved,
      };
    } catch (error) {
      this.logger.error('Error during manual cleanup:', error);
      throw error;
    }
  }
}

