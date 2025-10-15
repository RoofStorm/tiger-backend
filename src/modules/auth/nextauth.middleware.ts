import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NextAuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // For NextAuth, we'll use the user ID from the Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const userId = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        // Verify user exists and is active
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        });

        if (user && user.status === 'ACTIVE') {
          // Add user to request object
          req.user = user;
        } else {
          // Set user to null if not found or inactive
          req.user = null;
        }
      } catch (error) {
        console.error('NextAuth middleware error:', error);
      }
    }

    next();
  }
}
