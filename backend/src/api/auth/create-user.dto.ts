import { IsEmail, IsString, Length } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @Length(3, 20, { message: 'ユーザー名は3〜20文字で入力してください。' })
    userName: string;

    @IsEmail({}, { message: 'メールアドレスの形式が正しくありません。' })
    emailAddress: string;

    @IsString()
    @Length(8, 72, { message: 'パスワードは8〜72文字で入力してください。' })
    password: string;
}
