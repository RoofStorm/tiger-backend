import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import { AnalyticsQueueService } from './analytics-queue.service';
import { AnalyticsWorkerService } from './analytics-worker.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    AnalyticsService,
    AnalyticsAggregationService,
    AnalyticsQueueService,
    AnalyticsWorkerService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    AnalyticsAggregationService,
    AnalyticsQueueService,
    AnalyticsWorkerService,
  ],
})
export class AnalyticsModule {}

