import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class NextAuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      this.logger.debug(
        `🔍 NextAuth middleware processing: ${req.method} ${req.url}`,
      );

      // For NextAuth, we'll use the user ID from the Authorization header
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        this.logger.debug(`🔍 Processing token: ${token.substring(0, 20)}...`);

        try {
          // Decode JWT token to get user ID
          const decoded = jwt.decode(token) as any;
          if (!decoded || !decoded.sub) {
            this.logger.debug(`❌ Invalid JWT token`);
            req.user = null;
            next();
            return;
          }

          const userId = decoded.sub; // Extract userId from 'sub' claim
          this.logger.debug(`🔍 Extracted user ID: ${userId}`);

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

          this.logger.debug(`🔍 User found:`, user);

          if (user && user.status === 'ACTIVE') {
            // Add user to request object
            req.user = user;
            this.logger.debug(`✅ User authenticated: ${user.email}`);
          } else {
            // Set user to null if not found or inactive
            req.user = null;
            this.logger.debug(`❌ User not found or inactive`);
          }
        } catch (error) {
          this.logger.error('❌ NextAuth middleware error:', error);
          req.user = null;
        }
      } else {
        this.logger.debug(`❌ No valid auth header found`);
        req.user = null;
      }

      next();
    } catch (error) {
      this.logger.error('❌ NextAuth middleware fatal error:', error);
      req.user = null;
      next();
    }
  }
}
