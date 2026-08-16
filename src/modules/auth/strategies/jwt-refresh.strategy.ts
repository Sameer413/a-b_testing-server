import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(
        private readonly configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        super({
            /**
             * Refresh token extracted from the HTTP-only `refresh_token` cookie.
             * Cookie-based only – no Authorization header fallback.
             */
            jwtFromRequest: ExtractJwt.fromExtractors([
                (req: Request): string | null => {
                    const token = req?.cookies?.refresh_token;
                    return typeof token === 'string' && token.length > 0 ? token : null;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('jwt.refreshSecret') ?? '',
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtPayload) {
        // Read the raw refresh token directly from the cookie
        const refreshToken = req.cookies?.refresh_token as string | undefined;

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token cookie not found');
        }

        const isValid = await this.usersService.validateRefreshToken(payload.sub, refreshToken);
        if (!isValid) {
            throw new UnauthorizedException('Refresh token is invalid or has been revoked');
        }

        return this.usersService.findById(payload.sub);
    }
}
