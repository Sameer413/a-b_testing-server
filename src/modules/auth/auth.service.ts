import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { UsersService } from '../users/users.service';
import { RegisterDto, TokenResponseDto } from './dto/auth.dto';
import { User } from '../users/entities/user.entity';

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class AuthService {
    private readonly COOKIE_OPTS_BASE = {
        httpOnly: true,
        path: '/',
    };

    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ─── Registration ────────────────────────────────────────────────────────────

    async register(dto: RegisterDto): Promise<User> {
        return this.usersService.create(dto);
    }

    // ─── Login ───────────────────────────────────────────────────────────────────

    async login(user: User, res: Response): Promise<TokenResponseDto> {
        const tokens = await this.generateTokens(user);
        await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);
        this.setCookies(res, tokens);

        const expiresIn = this.parseExpirationToSeconds(
            this.configService.get<string>('jwt.accessExpiration') ?? '15m',
        );

        return {
            accessToken: tokens.accessToken,
            expiresIn,
            tokenType: 'Bearer',
        };
    }

    // ─── Validate credentials (used by LocalStrategy / login route) ───────────

    async validateCredentials(email: string, password: string): Promise<User> {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            throw new UnauthorizedException('Invalid email or password');
        }

        return user;
    }

    // ─── Refresh ─────────────────────────────────────────────────────────────────

    async refresh(user: User, res: Response): Promise<TokenResponseDto> {
        const tokens = await this.generateTokens(user);
        await this.usersService.updateRefreshToken(user.id, tokens.refreshToken);
        this.setCookies(res, tokens);

        const expiresIn = this.parseExpirationToSeconds(
            this.configService.get<string>('jwt.accessExpiration') ?? '15m',
        );

        return {
            accessToken: tokens.accessToken,
            expiresIn,
            tokenType: 'Bearer',
        };
    }

    // ─── Logout ──────────────────────────────────────────────────────────────────

    async logout(userId: string, res: Response): Promise<void> {
        await this.usersService.updateRefreshToken(userId, null);
        this.clearCookies(res);
    }

    // ─── Update Profile ──────────────────────────────────────────────────────────

    // async updateProfile(userId: string, dto: Partial<RegisterDto>): Promise<User> {
    //     return this.usersService.updateProfile(userId, dto);
    // }

    // ─── Update Password ─────────────────────────────────────────────────────────

    // async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    //     return this.usersService.updatePassword(userId, currentPassword, newPassword);
    // }

    // ─── Token Helpers ────────────────────────────────────────────────────────────

    private async generateTokens(user: User): Promise<TokenPair> {
        const payload = {
            sub: user.id,
            email: user.email,
            // roles: user.roles,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.accessSecret'),
                expiresIn: (this.configService.get<string>('jwt.accessExpiration') ?? '15m') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: (this.configService.get<string>('jwt.refreshExpiration') ?? '7d') as any,
            }),
        ]);

        return { accessToken, refreshToken };
    }

    private setCookies(res: Response, tokens: TokenPair): void {
        const isSecure = this.configService.get<boolean>('cookie.secure') ?? false;
        const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('cookie.sameSite') ?? 'lax';

        const accessMaxAge = this.parseExpirationToMs(
            this.configService.get<string>('jwt.accessExpiration') ?? '15m',
        );
        const refreshMaxAge = this.parseExpirationToMs(
            this.configService.get<string>('jwt.refreshExpiration') ?? '7d',
        );

        res.cookie('access_token', tokens.accessToken, {
            ...this.COOKIE_OPTS_BASE,
            secure: isSecure,
            sameSite,
            maxAge: accessMaxAge,
        });

        res.cookie('refresh_token', tokens.refreshToken, {
            ...this.COOKIE_OPTS_BASE,
            secure: isSecure,
            sameSite,
            maxAge: refreshMaxAge,
        });
    }

    private clearCookies(res: Response): void {
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
    }

    /** Convert duration strings like '15m', '7d', '1h' to milliseconds */
    private parseExpirationToMs(expiration: string): number {
        return this.parseExpirationToSeconds(expiration) * 1000;
    }

    private parseExpirationToSeconds(expiration: string): number {
        const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        const match = expiration.match(/^(\d+)([smhd])$/);
        if (!match) return 900; // default 15 minutes
        return parseInt(match[1], 10) * (units[match[2]] ?? 1);
    }
}
