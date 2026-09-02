import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { Logger } from '@nestjs/common';
import { CreateUserDto } from './create-user.dto';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private UserRepository: Repository<User>,
        private jwtService: JwtService
      ) {}
    
    // async signIn(username: string, password: string): Promise<{ access_token: string }> {
    //     const user = await this.UserRepository.findOne();
    //     if (user?.password !== password)
    //         throw new UnauthorizedException();
    //     const payload = { sub: user.userId, name: user.name };
    //     return {
    //         access_token: this.jwtService.signAsync(payload)
    //     };
    // }
    
    async signIn(createUserDto: CreateUserDto): Promise<{ access_token: string, userId: number, userName: string }> {
        try {
                const result = await this.UserRepository.findOneBy({
                    userName: createUserDto.userName,
                    emailAddress: createUserDto.emailAddress
                })
                if (!result)
                    throw new UnauthorizedException('パスワードが一致しない');
                const passwordMatches = await bcrypt.compare(createUserDto.password, result.password);
                if (!passwordMatches)
                    throw new UnauthorizedException('パスワードが一致しない');
                const payload = { sub: result.userId, name: result.userName}
                return {
                   access_token: await this.jwtService.signAsync(payload),
                   userId: result.userId,
                   userName: result.userName
                };
        } catch(e) {
            this.logger.log(e.message);
            throw new UnauthorizedException('ログインに失敗しました');
        }
    }

    async signUp(createUserDto: CreateUserDto): Promise<{ access_token: string, userId: number, userName: string }> {
        const existing = await this.UserRepository.findOneBy([
            { userName: createUserDto.userName },
            { emailAddress: createUserDto.emailAddress },
        ]);
        if (existing) {
            const reason = existing.userName === createUserDto.userName
                ? 'このユーザー名は既に使われています。'
                : 'このメールアドレスは既に使われています。';
            throw new ConflictException(reason);
        }
        try {
            const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_SALT_ROUNDS);
            const result = await this.UserRepository.save({
                userName: createUserDto.userName,
                emailAddress: createUserDto.emailAddress,
                password: hashedPassword,
            })
            const payload = { sub: result.userId, name: result.userName}
            return {
               access_token: await this.jwtService.signAsync(payload),
               userId: result.userId,
               userName: result.userName
            };
        } catch(e) {
            this.logger.log(e.message);
            throw new ConflictException('このユーザー名またはメールアドレスは既に使われています。');
        }
    }

    async findUsers(userIds: number[]): Promise<string[]> {
        try {
                const users = await this.UserRepository.find({
                    where: {
                        userId: In(userIds)
                    },
                })
                this.logger.log(users);
                if (!users)
                    throw new Error('存在しない');

                // userIdsの順序通りにソート
                const userMap = new Map(users.map(user => [user.userId, user.userName]));
                const sortedUserNames = userIds.map(id => userMap.get(id)).filter((name): name is string => name !== undefined);

                this.logger.log(`findUsers: userIds=${JSON.stringify(userIds)} -> userNames=${JSON.stringify(sortedUserNames)}`);
                return sortedUserNames;
        } catch(e) {
            this.logger.log(e.message);
            return [];
        }
    }

    private readonly logger = new Logger('AuthService');
}
