import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AnonymousConversionService {
  private readonly logger = new Logger(AnonymousConversionService.name);
  private readonly CONVERSION_KEY_PREFIX = 'anon_convert:';
  private readonly CONVERSION_SET_KEY = 'anonymous_to_user_conversions';
  private readonly CONVERSION_TTL = 60 * 60 * 24 * 90; // 90 days

  constructor(private readonly redisService: RedisService) {}

  /**
   * Track conversion from anonymous user to logged-in user
   * @param anonymousId The anonymous_id from cookie
   * @param userId The logged-in user ID
   */
  async trackConversion(anonymousId: string, userId: string): Promise<void> {
    if (!anonymousId || !userId) {
      return; // Skip if missing data
    }

    try {
      const redis = this.redisService.getClient();
      
      // Store mapping: anonymousId -> userId (with TTL)
      const mappingKey = `${this.CONVERSION_KEY_PREFIX}${anonymousId}`;
      await redis.setex(mappingKey, this.CONVERSION_TTL, userId);

      // Store in sorted set for time-based queries (score = timestamp)
      await redis.zadd(
        this.CONVERSION_SET_KEY,
        Date.now(),
        `${anonymousId}:${userId}`,
      );

      // Also store reverse mapping: userId -> anonymousId (for analytics)
      const reverseKey = `user_anon:${userId}`;
      await redis.setex(reverseKey, this.CONVERSION_TTL, anonymousId);

      this.logger.debug(
        `Tracked conversion: anonymousId=${anonymousId} -> userId=${userId}`,
      );
    } catch (error) {
      // Don't block login if Redis fails
      this.logger.error('Error tracking anonymous conversion:', error);
    }
  }

  /**
   * Get userId from anonymousId (if converted)
   */
  async getUserIdFromAnonymousId(anonymousId: string): Promise<string | null> {
    try {
      const key = `${this.CONVERSION_KEY_PREFIX}${anonymousId}`;
      return await this.redisService.get(key);
    } catch (error) {
      this.logger.error('Error getting userId from anonymousId:', error);
      return null;
    }
  }

  /**
   * Get anonymousId from userId (if converted)
   */
  async getAnonymousIdFromUserId(userId: string): Promise<string | null> {
    try {
      const key = `user_anon:${userId}`;
      return await this.redisService.get(key);
    } catch (error) {
      this.logger.error('Error getting anonymousId from userId:', error);
      return null;
    }
  }

  /**
   * Get conversion count within time range
   */
  async getConversionCount(
    startTime: number,
    endTime: number,
  ): Promise<number> {
    try {
      const redis = this.redisService.getClient();
      const conversions = await redis.zrangebyscore(
        this.CONVERSION_SET_KEY,
        startTime,
        endTime,
      );
      return conversions.length;
    } catch (error) {
      this.logger.error('Error getting conversion count:', error);
      return 0;
    }
  }

  /**
   * Check if anonymousId has been converted to a logged-in user
   */
  async isConverted(anonymousId: string): Promise<boolean> {
    try {
      const userId = await this.getUserIdFromAnonymousId(anonymousId);
      return userId !== null;
    } catch (error) {
      return false;
    }
  }
}

