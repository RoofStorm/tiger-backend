import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MoodCardsService } from './mood-cards.service';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { ShareService } from '../actions/share.service';
import { SHARE_LIMITS } from '../../constants/points';

@ApiTags('Mood Cards')
@Controller('api/mood-cards')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class MoodCardsController {
  constructor(
    private readonly moodCardsService: MoodCardsService,
    private readonly shareService: ShareService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all mood cards' })
  @ApiResponse({
    status: 200,
    description: 'Mood cards retrieved successfully',
  })
  async getAllMoodCards(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('userId') userId?: string,
  ) {
    return this.moodCardsService.getAllMoodCards(page, limit, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mood card by ID' })
  @ApiResponse({ status: 200, description: 'Mood card retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Mood card not found' })
  async getMoodCardById(@Param('id') id: string) {
    return this.moodCardsService.getMoodCardById(id);
  }

  @Post()
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new mood card' })
  @ApiResponse({ status: 201, description: 'Mood card created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createMoodCard(@Body() createMoodCardDto: any, @Request() req) {
    return this.moodCardsService.createMoodCard(createMoodCardDto, req.user.id);
  }

  @Post(':id/share')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Share a mood card. Share to Facebook to earn 50 points once per week.',
  })
  @ApiResponse({ status: 201, description: 'Mood card shared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async shareMoodCard(
    @Param('id') id: string,
    @Body() body: { platform?: string },
    @Request() req,
  ) {
    // Award points for sharing to Facebook (first share per week)
    const pointsAwarded = await this.shareService.awardShareBonus(
      req.user.id,
      id,
      'mood-card',
      body?.platform,
    );

    return {
      success: true,
      pointsAwarded,
      pointsMessage: pointsAwarded
        ? `Chúc mừng! Bạn đã nhận được ${SHARE_LIMITS.WEEKLY_SHARE_POINTS} điểm cho việc chia sẻ lên Facebook.`
        : body?.platform === 'facebook'
          ? 'Mood card đã được chia sẻ thành công.'
          : 'Mood card đã được chia sẻ thành công. Hãy chia sẻ lên Facebook để nhận điểm.',
    };
  }
}
