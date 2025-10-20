import { Module } from '@nestjs/common';
import { UserLimitService } from './user-limit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PrismaModule, PointsModule],
  providers: [UserLimitService],
  exports: [UserLimitService],
})
export class LimitsModule {}
