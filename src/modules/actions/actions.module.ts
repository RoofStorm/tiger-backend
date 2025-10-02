import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { PostsModule } from '../posts/posts.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PostsModule, PointsModule],
  providers: [ActionsService],
  controllers: [ActionsController],
  exports: [ActionsService],
})
export class ActionsModule {}

