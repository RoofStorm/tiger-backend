import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisService } from './redis.service';

const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: (configService: ConfigService) => {
    const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    return new Redis(redisUrl);
  },
  inject: [ConfigService],
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisProvider, RedisService],
  exports: [RedisService],
})
export class RedisModule {}

