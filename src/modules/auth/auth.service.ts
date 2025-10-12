import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PointsService } from '../points/points.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { LoginMethod, UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private pointsService: PointsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        loginMethod: LoginMethod.LOCAL,
        status: UserStatus.ACTIVE,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    // Award daily login bonus points
    try {
      console.log('Attempting to award daily login bonus to user:', user.id);
      await this.pointsService.awardPoints(user.id, 50, 'Daily login bonus');
      console.log('Daily login bonus awarded successfully');
    } catch (error) {
      // Ignore error if daily limit already reached
      console.log('Daily login bonus already awarded today:', error.message);
    }

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (isPasswordValid && user.status === UserStatus.ACTIVE) {
        return this.usersService.sanitizeUser(user);
      }
    }

    return null;
  }

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user && user.status === UserStatus.ACTIVE) {
      return this.usersService.sanitizeUser(user);
    }

    return null;
  }

  async oauthLogin(profile: any, provider: 'google' | 'facebook') {
    const { id, emails, displayName, photos } = profile;
    const email = emails?.[0]?.value;

    if (!email) {
      throw new BadRequestException('Email not provided by OAuth provider');
    }

    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update existing user with OAuth info if needed
      if (!user.providerId || user.loginMethod === LoginMethod.LOCAL) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            providerId: id,
            loginMethod:
              provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
            avatarUrl: photos?.[0]?.value,
            name: displayName || user.name,
          },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name: displayName,
          avatarUrl: photos?.[0]?.value,
          loginMethod:
            provider === 'google' ? LoginMethod.GOOGLE : LoginMethod.FACEBOOK,
          providerId: id,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    return {
      ...tokens,
      user: this.usersService.sanitizeUser(user),
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.usersService.sanitizeUser(user);
  }

  async logout(userId: string) {
    // Invalidate refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId };
    const refreshSecret = this.configService.get('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    // Store refresh token in database
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }
}
