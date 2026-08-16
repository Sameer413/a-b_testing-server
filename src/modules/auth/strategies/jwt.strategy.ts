import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
    sub: string;
    email: string;
    roles: string[];
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            /**
             * Extracts the JWT from:
             *  1. Authorization: Bearer <token> header
             *  2. access_token HTTP-only cookie
             *
             * The first extractor to return a non-null value wins.
             */
            jwtFromRequest: ExtractJwt.fromExtractors([
                // Bearer header
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                // HTTP-only cookie
                (req: Request): string | null => {
                    return (req?.cookies?.access_token as string) ?? null;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.accessSecret') ?? '',
        });
    }

    async validate(payload: JwtPayload) {
        // Attach full user record to request (excluding sensitive fields via @Exclude)
        return this.usersService.findById(payload.sub);
    }
}
