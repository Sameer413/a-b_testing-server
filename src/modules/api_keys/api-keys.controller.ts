import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import type { Request } from 'express';
import { ProjectAuth } from "src/common/decorators/project-auth.decorator";
import { Role } from "src/common/enums/role.enum";
import { GenerateApiKeyDto } from "./dto/generate-api-key.dto";
import { ApiKeysService } from "./api-keys.service";
import { ResponseService } from "src/common/services/response-service";


@Controller('projects/api-keys')
export class ApiKeysController {
    constructor(
        private readonly apiKeysService: ApiKeysService,
        private readonly responseService: ResponseService,
    ) { }
    // Generate a new API key for an environment
    @ProjectAuth(Role.OWNER, Role.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @Post(':projectId/generate')
    async generate(
        @Body() dto: GenerateApiKeyDto,
        @Req() req: Request,
    ) {
        const result = await this.apiKeysService.generateApiKey(dto, req.project!);
        return this.responseService.success(result, 'API key generated — store it securely, it will not be shown again');
    }
    // List all keys for project (masked)
    @ProjectAuth(Role.OWNER, Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @Get(':projectId/list')
    async list(@Req() req: Request) {
        const keys = await this.apiKeysService.listApiKeys(req.project!);
        return this.responseService.success(keys, 'API keys fetched successfully');
    }
    // Revoke a specific key
    @ProjectAuth(Role.OWNER, Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @Delete(':keyId/revoke')
    async revoke(
        @Param('keyId') keyId: string,
        @Req() req: Request,
    ) {
        const result = await this.apiKeysService.revokeApiKey(keyId, req.project!);
        return this.responseService.success(result, 'API key revoked');
    }
}