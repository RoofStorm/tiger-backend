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
import { NextAuthMiddleware } from './modules/auth/nextauth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(NextAuthMiddleware).forRoutes('*'); // Apply to all routes
  }
}
