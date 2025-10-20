import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ShareService } from './share.service';
import { ActionsController, UserActionsController } from './actions.controller';
import { PostsModule } from '../posts/posts.module';
import { PointsModule } from '../points/points.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [PostsModule, PointsModule, PrismaModule, LimitsModule],
  providers: [ActionsService, ShareService],
  controllers: [ActionsController, UserActionsController],
  exports: [ActionsService, ShareService],
})
export class ActionsModule {}
