import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { ActionsModule } from './modules/actions/actions.module';
import { PointsModule } from './modules/points/points.module';
import { RedeemModule } from './modules/redeem/redeem.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StorageModule } from './modules/storage/storage.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { WishesModule } from './modules/wishes/wishes.module';
import { MoodCardsModule } from './modules/mood-cards/mood-cards.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReferralModule } from './modules/referral/referral.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GuardsModule } from './common/guards/guards.module';
import { RedisModule } from './common/redis/redis.module';
import { NextAuthMiddleware } from './modules/auth/nextauth.middleware';
import { AnonymousTrackingMiddleware } from './common/middleware/anonymous-tracking.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load from .env file if exists (for local development)
      envFilePath: ['.env.local', '.env'],
      // Don't ignore env file, but also load from process.env (for production)
      ignoreEnvFile: false,
      // Disable expandVariables to avoid parsing issues with quoted values
      expandVariables: false,
      // Validate that required env vars are present
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL) || 60,
        limit: parseInt(process.env.THROTTLE_LIMIT) || 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    ActionsModule,
    PointsModule,
    RedeemModule,
    AnalyticsModule,
    StorageModule,
    RewardsModule,
    WishesModule,
    MoodCardsModule,
    AdminModule,
    ReferralModule,
    NotificationsModule,
    GuardsModule,
    RedisModule,
  ],
  providers: [AnonymousTrackingMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply anonymous tracking first (before auth)
    consumer
      .apply(AnonymousTrackingMiddleware)
      .forRoutes('*');
    // Then apply auth middleware
    consumer
      .apply(NextAuthMiddleware)
      .forRoutes('*');
  }
}
