import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { UsersService } from './users.service';
import { AddFriendDto } from './add-friend.dto';

@UseGuards(AuthGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/:userId')
  getProfile(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.getProfile(userId, req.userId);
  }

  @Get('users/:userId/history')
  getHistory(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.getHistory(userId);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.usersService.getLeaderboard();
  }

  @Get('friends')
  getFriends(@Req() req: AuthenticatedRequest) {
    return this.usersService.getFriends(req.userId);
  }

  @Get('friends/requests')
  getPendingRequests(@Req() req: AuthenticatedRequest) {
    return this.usersService.getPendingRequests(req.userId);
  }

  @Post('friends')
  sendFriendRequest(
    @Body() body: AddFriendDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.sendFriendRequest(req.userId, body.friendUserName);
  }

  @Post('friends/:otherUserId/accept')
  acceptFriendRequest(
    @Param('otherUserId', ParseIntPipe) otherUserId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.acceptFriendRequest(req.userId, otherUserId);
  }

  @Delete('friends/:otherUserId')
  removeFriend(
    @Param('otherUserId', ParseIntPipe) otherUserId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.removeFriend(req.userId, otherUserId);
  }
}
