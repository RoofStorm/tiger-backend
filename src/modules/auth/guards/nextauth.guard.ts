import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class NextAuthGuard implements CanActivate {
  private readonly logger = new Logger(NextAuthGuard.name);
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    this.logger.debug('🔍 NextAuthGuard.canActivate called');
    this.logger.debug('🔍 Request URL:', request.url);
    this.logger.debug('🔍 Request user:', user);
    this.logger.debug('🔍 Authorization header:', request.headers.authorization);

    if (!user) {
      this.logger.debug('❌ NextAuthGuard: User not found in request');
      throw new UnauthorizedException('User not authenticated');
    }

    this.logger.debug('✅ NextAuthGuard: User authenticated successfully');
    return true;
  }
}
