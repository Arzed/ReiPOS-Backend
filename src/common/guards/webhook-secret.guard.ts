import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedSecret = request.headers['x-webhook-secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (!expectedSecret) {
      throw new UnauthorizedException('FATAL: WEBHOOK_SECRET environment variable is not defined.');
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing x-webhook-secret header.');
    }
    return true;
  }
}
