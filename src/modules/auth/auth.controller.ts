import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  OAuthDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import { NextAuthGuard } from './guards/nextauth.guard';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Get('check-username')
  @ApiOperation({ summary: 'Check if username is available (public endpoint)' })
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'Username to check',
    example: 'johndoe',
  })
  @ApiResponse({
    status: 200,
    description: 'Username availability checked',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Username có thể sử dụng' },
      },
    },
  })
  async checkUsernameAvailability(@Query('username') username: string) {
    if (!username || username.trim().length === 0) {
      return {
        available: false,
        message: 'Username không được để trống',
      };
    }

    if (username.length < 3) {
      return {
        available: false,
        message: 'Username phải có ít nhất 3 ký tự',
      };
    }

    if (username.length > 30) {
      return {
        available: false,
        message: 'Username không được quá 30 ký tự',
      };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return {
        available: false,
        message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới',
      };
    }

    const isAvailable = await this.usersService.checkUsernameAvailability(
      username,
    );

    return {
      available: isAvailable,
      message: isAvailable
        ? 'Username có thể sử dụng'
        : 'Username đã được sử dụng',
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Get('me')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@Req() req: Request) {
    return this.authService.getCurrentUser((req as any).user.id);
  }

  @Get('session')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session information' })
  @ApiResponse({
    status: 200,
    description: 'Session information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
        expires: { type: 'string', format: 'date-time' },
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        pointsAwarded: { type: 'boolean' },
        pointsMessage: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSession(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    return this.authService.getSession((req as any).user.id, accessToken);
  }

  @Post('change-password')
  @UseGuards(NextAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for LOCAL login accounts' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Đổi mật khẩu thành công' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      (req as any).user.id,
      changePasswordDto,
    );
  }

  // Facebook OAuth
  @Get('oauth/facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook' })
  async facebookAuth() {
    // Passport will handle the redirect
  }

  @Get('callback/facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async facebookCallback(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    if (!user) {
      return res.redirect(
        `${this.configService.get('CORS_ORIGIN') || 'http://localhost:3000'}/auth/error?error=AccessDenied`,
      );
    }

    // Lấy tokens từ user object (đã được lưu trong strategy)
    let tokens = (user as any)._tokens;
    
    // Nếu không có tokens, generate lại (fallback)
    if (!tokens) {
      tokens = await this.authService.generateTokensForUser(user.id);
    }

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    
    return res.redirect(redirectUrl);
  }

  // Google OAuth
  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google' })
  async googleAuth() {
    // Passport will handle the redirect
  }

  @Get('callback/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    if (!user) {
      return res.redirect(
        `${this.configService.get('CORS_ORIGIN') || 'http://localhost:3000'}/auth/error?error=AccessDenied`,
      );
    }

    // Lấy tokens từ user object (đã được lưu trong strategy)
    let tokens = (user as any)._tokens;
    
    // Nếu không có tokens, generate lại (fallback)
    if (!tokens) {
      tokens = await this.authService.generateTokensForUser(user.id);
    }

    // Redirect to frontend with tokens
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;
    
    return res.redirect(redirectUrl);
  }

  // OAuth Error Handler
  @Get('error')
  @ApiOperation({ summary: 'OAuth error handler' })
  @ApiResponse({ status: 200, description: 'Error information' })
  async oauthError(@Query('error') error: string, @Res() res: Response) {
    const frontendUrl = this.configService.get('CORS_ORIGIN') || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/auth/error?error=${error || 'UnknownError'}`);
  }

  // POST OAuth endpoints (for direct OAuth login from frontend)
  @Post('oauth/facebook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Facebook OAuth login via POST' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'uuid' },
                email: { type: 'string', example: 'user@example.com' },
                name: { type: 'string', example: 'John Doe' },
                avatarUrl: { type: 'string', example: 'https://...' },
                role: { type: 'string', example: 'USER' },
              },
            },
            accessToken: { type: 'string', example: 'jwt_token_here' },
            refreshToken: { type: 'string', example: 'refresh_token_here' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async facebookOAuthPost(@Body() oauthDto: OAuthDto) {
    try {
      const result = await this.authService.oauthLoginFromRequest(
        oauthDto,
        'facebook',
      );

      return {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google OAuth login via POST' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'uuid' },
                email: { type: 'string', example: 'user@example.com' },
                name: { type: 'string', example: 'John Doe' },
                avatarUrl: { type: 'string', example: 'https://...' },
                role: { type: 'string', example: 'USER' },
              },
            },
            accessToken: { type: 'string', example: 'jwt_token_here' },
            refreshToken: { type: 'string', example: 'refresh_token_here' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async googleOAuthPost(@Body() oauthDto: OAuthDto) {
    try {
      const result = await this.authService.oauthLoginFromRequest(
        oauthDto,
        'google',
      );

      return {
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}
