import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface QueuedAnalyticsEvent {
  userId: string | null;
  sessionId: string;
  isAnonymous: boolean;
  page: string;
  zone: string | null;
  component: string | null;
  action: string;
  value: number | null;
  metadata: Record<string, any> | null;
}

@Injectable()
export class AnalyticsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsQueueService.name);
  private readonly queue: QueuedAnalyticsEvent[] = [];
  private readonly BATCH_SIZE = 200; // Bulk insert 200 records at a time
  private readonly FLUSH_INTERVAL = 5000; // Flush every 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    // Start periodic flush
    this.startFlushTimer();
  }

  /**
   * Add events to queue (non-blocking)
   * Returns immediately after adding to queue
   */
  enqueue(events: QueuedAnalyticsEvent[]): void {
    this.queue.push(...events);
    this.logger.debug(`Enqueued ${events.length} events. Queue size: ${this.queue.length}`);

    // Auto-flush if queue reaches batch size
    if (this.queue.length >= this.BATCH_SIZE) {
      this.logger.debug('Queue reached batch size, triggering flush');
      this.flush();
    }
  }

  /**
   * Get batch of events from queue
   */
  dequeue(batchSize: number = this.BATCH_SIZE): QueuedAnalyticsEvent[] {
    if (this.queue.length === 0) {
      return [];
    }

    const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
    return batch;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Flush all events from queue (returns batch for processing)
   */
  flush(): QueuedAnalyticsEvent[] {
    if (this.queue.length === 0) {
      return [];
    }

    const batch = this.dequeue(this.BATCH_SIZE);
    this.logger.debug(`Flushed ${batch.length} events from queue`);
    return batch;
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.logger.debug(`Periodic flush: ${this.queue.length} events in queue`);
        // Trigger flush (worker will pick up)
        this.flush();
      }
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    this.stopFlushTimer();
    // Flush remaining events
    if (this.queue.length > 0) {
      this.logger.warn(`Flushing ${this.queue.length} remaining events on shutdown`);
    }
  }
}

