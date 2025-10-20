import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PointsModule } from '../points/points.module';
import { GuardsModule } from '../../common/guards/guards.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [PrismaModule, PointsModule, GuardsModule, LimitsModule],
  providers: [ReferralService],
  controllers: [ReferralController],
  exports: [ReferralService],
})
export class ReferralModule {}
