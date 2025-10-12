import { Module } from '@nestjs/common';
import { MoodCardsController } from './mood-cards.controller';
import { MoodCardsService } from './mood-cards.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MoodCardsController],
  providers: [MoodCardsService],
  exports: [MoodCardsService],
})
export class MoodCardsModule {}
