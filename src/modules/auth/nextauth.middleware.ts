import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class NextAuthMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      console.log(
        `🔍 NextAuth middleware processing: ${req.method} ${req.url}`,
      );

      // For NextAuth, we'll use the user ID from the Authorization header
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log(`🔍 Processing token: ${token.substring(0, 20)}...`);

        try {
          // Decode JWT token to get user ID
          const decoded = jwt.decode(token) as any;
          if (!decoded || !decoded.sub) {
            console.log(`❌ Invalid JWT token`);
            req.user = null;
            next();
            return;
          }

          const userId = decoded.sub; // Extract userId from 'sub' claim
          console.log(`🔍 Extracted user ID: ${userId}`);

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

          console.log(`🔍 User found:`, user);

          if (user && user.status === 'ACTIVE') {
            // Add user to request object
            req.user = user;
            console.log(`✅ User authenticated: ${user.email}`);
          } else {
            // Set user to null if not found or inactive
            req.user = null;
            console.log(`❌ User not found or inactive`);
          }
        } catch (error) {
          console.error('❌ NextAuth middleware error:', error);
          req.user = null;
        }
      } else {
        console.log(`❌ No valid auth header found`);
        req.user = null;
      }

      next();
    } catch (error) {
      console.error('❌ NextAuth middleware fatal error:', error);
      req.user = null;
      next();
    }
  }
}
