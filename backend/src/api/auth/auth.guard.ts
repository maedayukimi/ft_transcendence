import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.token;
    if (!token) {
      throw new UnauthorizedException('ログインが必要です。');
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('認証に失敗しました。再ログインしてください。');
    }
  }
}
