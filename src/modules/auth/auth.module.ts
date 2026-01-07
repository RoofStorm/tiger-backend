import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { UsersModule } from '../users/users.module';
import { PointsModule } from '../points/points.module';
import { ReferralModule } from '../referral/referral.module';
import { NextAuthMiddleware } from './nextauth.middleware';
import { OptionalNextAuthGuard } from './guards/optional-nextauth.guard';
import { RedisModule } from '../../common/redis/redis.module';
import { AnonymousConversionService } from '../../common/services/anonymous-conversion.service';

@Module({
  imports: [
    UsersModule,
    PointsModule,
    ReferralModule,
    RedisModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    FacebookStrategy,
    NextAuthMiddleware,
    OptionalNextAuthGuard,
    AnonymousConversionService,
  ],
  controllers: [AuthController],
  exports: [AuthService, NextAuthMiddleware, OptionalNextAuthGuard],
})
export class AuthModule {}
