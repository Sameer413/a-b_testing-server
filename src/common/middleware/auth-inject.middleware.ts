import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';

/**
 * Auth Injection Middleware
 *
 * Reads the JWT access token from either:
 *   1. Authorization: Bearer <token> header
 *   2. access_token HTTP-only cookie
 *
 * If a valid token is found, it decodes it and attaches the payload to
 * `req.user`. This runs BEFORE guards so that downstream guards always
 * have a populated user object without needing to do extraction themselves.
 *
 * This middleware never throws — invalid tokens are silently ignored so
 * that public routes are not disrupted. Guards are responsible for
 * enforcing authentication requirements.
 */
@Injectable()
export class AuthInjectMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    use(req: Request, _res: Response, next: NextFunction): void {
        const token = this.extractToken(req);

        if (token) {
            try {
                const payload = this.jwtService.verify(token, {
                    secret: this.configService.get<string>('jwt.accessSecret'),
                });
                (req as any).user = payload;
            } catch {
                // Invalid token — guard will reject if route requires auth
            }
        }

        next();
    }

    private extractToken(req: Request): string | null {
        // 1. Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }

        // 2. Check cookie
        const cookieToken = (req as any).cookies?.access_token as string | undefined;
        if (cookieToken) {
            return cookieToken;
        }

        return null;
    }
}
