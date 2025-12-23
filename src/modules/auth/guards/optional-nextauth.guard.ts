import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';

@Injectable()
export class OptionalNextAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // This guard doesn't throw error, just allows the request to proceed
    // The controller will check req.user to determine if user is authenticated
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If user exists, authentication is successful
    // If user doesn't exist, still allow request but controller will handle it
    return true;
  }
}

