import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WishesService } from './wishes.service';
import { WishService } from './wish.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { WISH_LIMITS } from '../../constants/points';

@ApiTags('Wishes')
@Controller('api/wishes')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class WishesController {
  constructor(
    private readonly wishesService: WishesService,
    private readonly wishService: WishService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wish' })
  @ApiResponse({
    status: 201,
    description: 'Wish created successfully',
  })
  async createWish(@Body() createWishDto: CreateWishDto, @Request() req) {
    const wish = await this.wishesService.createWish(
      createWishDto,
      req.user.id,
    );

    // Award points for wish creation (first wish per week)
    const pointsAwarded = await this.wishService.awardWishCreationBonus(
      req.user.id,
      wish.id,
    );

    return {
      ...wish,
      pointsAwarded,
      pointsMessage: pointsAwarded
        ? `Chúc mừng! Bạn đã nhận được ${WISH_LIMITS.WEEKLY_WISH_POINTS} điểm cho lời chúc đầu tiên trong tuần.`
        : 'Lời chúc đã được tạo thành công. Bạn đã nhận điểm cho lời chúc đầu tiên trong tuần này.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all wishes (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Wishes retrieved successfully',
  })
  async getAllWishes(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('isHighlighted') isHighlighted?: boolean,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    return this.wishesService.getAllWishes(pageNum, limitNum, isHighlighted);
  }

  @Get('highlighted')
  @ApiOperation({ summary: 'Get highlighted wishes' })
  @ApiResponse({
    status: 200,
    description: 'Highlighted wishes retrieved successfully',
  })
  async getHighlightedWishes() {
    return this.wishesService.getHighlightedWishes();
  }

  @Get('user')
  @ApiOperation({ summary: 'Get user wishes' })
  @ApiResponse({
    status: 200,
    description: 'User wishes retrieved successfully',
  })
  async getUserWishes(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const pageNum = parseInt(page.toString(), 10);
    const limitNum = parseInt(limit.toString(), 10);
    return this.wishesService.getUserWishes(req.user.id, pageNum, limitNum);
  }

  @Post(':id/toggle-highlight')
  @ApiOperation({ summary: 'Toggle wish highlight (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Wish highlight toggled successfully',
  })
  async toggleHighlight(@Param('id') id: string, @Request() req) {
    return this.wishesService.toggleHighlight(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a wish' })
  @ApiResponse({
    status: 200,
    description: 'Wish deleted successfully',
  })
  async deleteWish(@Param('id') id: string, @Request() req) {
    return this.wishesService.deleteWish(id, req.user.id);
  }

  @Get('creation-stats')
  @ApiOperation({ summary: 'Get wish creation stats for user' })
  @ApiResponse({
    status: 200,
    description: 'Wish creation stats retrieved successfully',
  })
  async getCreationStats(@Request() req) {
    const stats = await this.wishService.getWishCreationStats(req.user.id);
    return {
      success: true,
      data: stats,
    };
  }
}
