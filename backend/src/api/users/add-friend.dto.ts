import { IsString, Length } from 'class-validator';

export class AddFriendDto {
  @IsString()
  @Length(3, 20, { message: 'ユーザー名は3〜20文字で入力してください。' })
  friendUserName: string;
}
