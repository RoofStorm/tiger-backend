import { Module } from '@nestjs/common';
import { MoodCardsController } from './mood-cards.controller';
import { MoodCardsService } from './mood-cards.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ActionsModule } from '../actions/actions.module';

@Module({
  imports: [PrismaModule, ActionsModule],
  controllers: [MoodCardsController],
  providers: [MoodCardsService],
  exports: [MoodCardsService],
})
export class MoodCardsModule {}
