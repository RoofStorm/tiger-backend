import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NextAuthGuard } from '../auth/guards/nextauth.guard';
import { OptionalNextAuthGuard } from '../auth/guards/optional-nextauth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { POST_LIMITS } from '../../constants/points';

@ApiTags('Posts')
@Controller('api/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postService: PostService,
  ) {}

  @Get()
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all posts' })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  async findAll(
    @Query('type') type?: string,
    @Query('highlighted') highlighted?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    const validTypes = ['EMOJI_CARD', 'CONFESSION', 'IMAGE', 'VIDEO', 'CLIP'];
    const postType =
      type && validTypes.includes(type) ? (type as any) : undefined;

    return this.postsService.findAll(
      {
        type: postType,
        highlighted:
          highlighted === 'true'
            ? true
            : highlighted === 'false'
              ? false
              : undefined,
        page,
        limit,
      },
      req?.user?.id,
    );
  }

  @Get('highlighted')
  @UseGuards(OptionalNextAuthGuard)
  @ApiOperation({ summary: 'Get highlighted posts (public, optional auth)' })
  @ApiResponse({
    status: 200,
    description: 'Highlighted posts retrieved successfully',
  })
  async getHighlightedPosts(@Request() req?: any) {
    return this.postsService.findAll(
      {
        highlighted: true,
        page: 1,
        limit: 20,
      },
      req?.user?.id, // Optional: include user ID if authenticated
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post by ID (public)' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Get(':id/authenticated')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get post by ID (authenticated)' })
  @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async findOneAuthenticated(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Post()
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createPostDto: CreatePostDto, @Request() req) {
    const post = await this.postsService.create(createPostDto, req.user.id);

    // Award points for post creation (first post per week)
    const pointsAwarded = await this.postService.awardPostCreationBonus(
      req.user.id,
      post.id,
    );

    return {
      ...post,
      pointsAwarded,
      pointsMessage: pointsAwarded
        ? `Chúc mừng! Bạn đã nhận được ${POST_LIMITS.WEEKLY_POST_POINTS} điểm cho bài viết.`
        : 'Bài viết đã được tạo thành công.',
    };
  }

  @Delete(':id')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.postsService.remove(id, req.user.id);
  }

  @Get('creation-stats')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get post creation stats for user' })
  @ApiResponse({
    status: 200,
    description: 'Post creation stats retrieved successfully',
  })
  async getCreationStats(@Request() req) {
    const stats = await this.postService.getPostCreationStats(req.user.id);
    return {
      success: true,
      data: stats,
    };
  }
}
