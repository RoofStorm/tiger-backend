import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async onModuleInit() {
    try {
      await this.redis.ping();
      this.logger.log('Redis connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Set a key with TTL (time to live in seconds)
   */
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
  }

  /**
   * Increment a counter
   */
  async increment(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  /**
   * Get a value
   */
  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  /**
   * Get counter value
   */
  async getCounter(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Get count from sorted set within time range
   * Returns count of unique members added between startTime and endTime
   */
  async countInTimeRange(
    key: string,
    startTime: number,
    endTime: number,
  ): Promise<number> {
    const members = await this.redis.zrangebyscore(
      key,
      startTime,
      endTime,
    );
    return members.length;
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.redis;
  }
}

