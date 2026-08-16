import { Body, ClassSerializerInterceptor, Controller, HttpCode, HttpStatus, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { ResponseService } from "../../common/services/response-service";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { CreateOrganizationDto } from "./dto/organization.dto";

@UseInterceptors(ClassSerializerInterceptor)
@Controller('organizations')
export class OrganizationsController {
    constructor(
        private readonly responseService: ResponseService,
        private readonly organizationsService: OrganizationsService
    ) { }

    @UseGuards(JwtAuthGuard)
    // @UseGuards(RolesGuard)
    // @Roles(Role.OWNER)
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: User) {
        const organization = await this.organizationsService.createOrganization(dto, user);
        return this.responseService.success(organization, 'Organization created successfully');
    }


    // Organization Member
    // @UseGuards(JwtAuthGuard)
    // @UseGuards(RolesGuard)
    // @Roles(Role.OWNER)
    // @HttpCode(HttpStatus.CREATED)
    // @Post('member')
    // async createOrgMember() {

    // }

}