import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // Set timezone to Vietnam (UTC+7) for all database operations
    // This ensures all NOW() and CURRENT_TIMESTAMP functions use Vietnam timezone
    await this.$executeRaw`SET timezone = 'Asia/Ho_Chi_Minh'`;
  }
}

