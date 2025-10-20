import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostService } from './post.service';
import { PostsController } from './posts.controller';
import { PointsModule } from '../points/points.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LimitsModule } from '../limits/limits.module';

@Module({
  imports: [PointsModule, PrismaModule, LimitsModule],
  providers: [PostsService, PostService],
  controllers: [PostsController],
  exports: [PostsService, PostService],
})
export class PostsModule {}
