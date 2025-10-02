import { Module } from '@nestjs/common';
import { RedeemService } from './redeem.service';
import { RedeemController } from './redeem.controller';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PointsModule],
  providers: [RedeemService],
  controllers: [RedeemController],
  exports: [RedeemService],
})
export class RedeemModule {}

