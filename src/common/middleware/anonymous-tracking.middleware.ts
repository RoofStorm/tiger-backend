import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AnonymousTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AnonymousTrackingMiddleware.name);
  private readonly ANONYMOUS_COOKIE_NAME = 'anonymous_id';
  private readonly COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 180; // 180 days (6 months)
  private readonly REDIS_TTL = 60 * 30; // 30 minutes
  private readonly REDIS_KEY_PREFIX = 'anon:';
  private readonly COUNTER_KEY = 'unique_anonymous_users';

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Skip if user is already authenticated
      const user = (req as any).user;
      if (user?.id) {
        return next();
      }

      // Get or create anonymous_id from cookie
      let anonymousId = req.cookies?.[this.ANONYMOUS_COOKIE_NAME];

      if (!anonymousId) {
        // Generate new UUID for anonymous user
        anonymousId = uuidv4();

        const isProd = process.env.NODE_ENV === 'production';
        
        // Set cookie
        res.cookie(this.ANONYMOUS_COOKIE_NAME, anonymousId, {
          httpOnly: true,
          sameSite: 'none',
          maxAge: this.COOKIE_MAX_AGE,
          domain: isProd ? '.tiger-corporation-vietnam.vn' : 'localhost',
          secure: isProd,
        });

        this.logger.debug(`Generated new anonymous_id: ${anonymousId}`);
      }

      // Track in Redis if not already tracked in current window
      const redisKey = `${this.REDIS_KEY_PREFIX}${anonymousId}`;
      const exists = await this.redisService.exists(redisKey);

      if (!exists) {
        // Mark as active with TTL and store timestamp
        const timestamp = Date.now().toString();
        await this.redisService.set(redisKey, timestamp, this.REDIS_TTL);
        
        // Increment unique anonymous users counter
        await this.redisService.increment(this.COUNTER_KEY);
        
        // Store in sorted set for time-based queries (score = timestamp)
        const redis = this.redisService.getClient();
        await redis.zadd('anonymous_users_timestamps', Date.now(), anonymousId);
        
        this.logger.debug(`Tracked new anonymous user: ${anonymousId}`);
      } else {
        // Refresh TTL to keep user active
        const timestamp = Date.now().toString();
        await this.redisService.set(redisKey, timestamp, this.REDIS_TTL);
      }

      // Attach anonymousId to request for potential use in analytics
      (req as any).anonymousId = anonymousId;

      next();
    } catch (error) {
      // Don't block request if Redis fails
      this.logger.error('Error in anonymous tracking middleware:', error);
      next();
    }
  }
}

