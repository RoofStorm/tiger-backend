import { Module } from '@nestjs/common';
import { WishesService } from './wishes.service';
import { WishService } from './wish.service';
import { WishesController } from './wishes.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PointsModule } from '../points/points.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [PrismaModule, PointsModule, LimitsModule],
  controllers: [WishesController],
  providers: [WishesService, WishService],
  exports: [WishesService, WishService],
})
export class WishesModule {}
