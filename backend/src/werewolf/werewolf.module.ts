import { Module } from '@nestjs/common';
import { WerewolfGateway } from './werewolf.gateway';
import { WerewolfService } from './werewolf.service';
import { AuthModule } from '../api/auth/auth.module';
import { UsersModule } from '../api/users/users.module';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [WerewolfGateway, WerewolfService],
})
export class WerewolfModule {}
