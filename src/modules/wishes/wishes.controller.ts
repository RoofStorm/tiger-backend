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
import { CreateWishDto } from './dto/create-wish.dto';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';

@ApiTags('Wishes')
@Controller('api/wishes')
@UseGuards(NextAuthGuard)
@ApiBearerAuth()
export class WishesController {
  constructor(private readonly wishesService: WishesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wish' })
  @ApiResponse({
    status: 201,
    description: 'Wish created successfully',
  })
  async createWish(@Body() createWishDto: CreateWishDto, @Request() req) {
    return this.wishesService.createWish(createWishDto, req.user.id);
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
}
