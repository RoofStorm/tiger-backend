import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class NextAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('🔍 NextAuthGuard.canActivate called');
    console.log('🔍 Request URL:', request.url);
    console.log('🔍 Request user:', user);
    console.log('🔍 Authorization header:', request.headers.authorization);

    if (!user) {
      console.log('❌ NextAuthGuard: User not found in request');
      throw new UnauthorizedException('User not authenticated');
    }

    console.log('✅ NextAuthGuard: User authenticated successfully');
    return true;
  }
}
