import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async updatePoints(userId: string, points: number): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: points,
        },
      },
    });
  }

  async getPointsLogs(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointLog.count({
        where: { userId },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  sanitizeUser(user: User) {
    const { passwordHash, refreshToken, ...sanitized } = user;
    return sanitized;
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const user = await this.findByUsername(username);
    return !user; // Returns true if username is available (user not found)
  }
}
