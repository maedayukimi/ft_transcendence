import { Controller, HttpCode, Post, Body , Res} from '@nestjs/common';
import type { Response } from 'express';
import { CreateUserDto } from './create-user.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    @HttpCode(200)
    async handleSignIn(
        @Body() createUserDto: CreateUserDto,
        @Res({ passthrough: true }) response: Response
    ) {
        const result = await this.authService.signIn(createUserDto);

        // httpOnly Cookieにトークンをセット
        response.cookie('token', result.access_token, {
            httpOnly: true,    // JavaScriptからアクセス不可（XSS対策）
            secure: true,      // nginxがTLS終端するため常にHTTPS経由
            sameSite: 'lax',   // CSRF対策
            maxAge: 60 * 60 * 1000  // 1時間
        });

        return {
            success: true,
            userId: result.userId,
            userName: result.userName,
            message: 'ログイン成功'
        };
    }

    @Post('signup')
    @HttpCode(201)
    async handleSignUpUser(
        @Body() createUserDto: CreateUserDto,
        @Res({ passthrough: true }) response: Response
    ) {
        const result = await this.authService.signUp(createUserDto);
          // httpOnly Cookieにトークンをセット
          response.cookie('token', result.access_token, {
            httpOnly: true,    // JavaScriptからアクセス不可（XSS対策）
            secure: true,      // nginxがTLS終端するため常にHTTPS経由
            sameSite: 'lax',   // CSRF対策
            maxAge: 60 * 60 * 1000  // 1時間
        });
        return {
            success: true,
            userId: result.userId,
            userName: result.userName,
            message: 'セットアップ成功'
        };
    }

    @Post('logout')
    @HttpCode(200)
    async handleLogout(
        @Res({ passthrough: true }) response: Response
    ) {
        response.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
        });
        return { success: true };
    }
}
