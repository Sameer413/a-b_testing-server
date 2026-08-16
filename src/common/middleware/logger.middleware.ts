import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('Request');

    use(req: Request, _res: Response, next: NextFunction): void {
        const { method, originalUrl, ip } = req;
        const userAgent = req.get('user-agent') ?? '';

        this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent}`);
        next();
    }
}
