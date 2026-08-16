import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organization } from "./entities/organization.entity";
import { OrganizationMember } from "./entities/organization.member.entity";
import { User } from "../users/entities/user.entity";
import { CreateOrganizationDto } from "./dto/organization.dto";
import { Role } from "../../common/enums/role.enum";

@Injectable()
export class OrganizationsService {
    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private readonly organizationMemberRepository: Repository<OrganizationMember>,
    ) { }

    private generateRandomAlphanumeric(length: number): string {
        let result = '';
        const characters =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    private async generateOrganizationCode(name: string): Promise<string> {
        const base = name.substring(0, 3).toUpperCase();
        let uniqueCode = base + this.generateRandomAlphanumeric(4);

        while (await this.organizationRepository.findOne({ where: { organizationCode: uniqueCode } as any })) {
            uniqueCode = base + this.generateRandomAlphanumeric(4);
        }

        return uniqueCode;
    }

    async createOrganization(dto: CreateOrganizationDto, user: User) {
        const organizationCode = await this.generateOrganizationCode(dto.name);

        const organization = this.organizationRepository.create({
            name: dto.name,
            organizationCode: organizationCode,
            owner: user
        });
        const savedOrganization = await this.organizationRepository.save(organization);

        // Auto-create an OrganizationMember with OWNER role for the creating user
        await this.addMemberToOrganization(savedOrganization, user, Role.OWNER);

        return savedOrganization;
    }

    async getOrganizationById(id: string): Promise<Organization | null> {
        return await this.organizationRepository.findOne({ where: { id: id } });
    }

    async getMemberRole(organizationId: string, userId: string): Promise<Role | null> {
        const member = await this.organizationMemberRepository.findOne({
            where: {
                organization: { id: organizationId },
                user: { id: userId },
            },
        });
        return member?.role ?? null;
    }

    // Organization Member
    async addMemberToOrganization(organization: Organization, user: User, role: Role) {
        const organizationMember = this.organizationMemberRepository.create({
            organization: organization,
            user: user,
            role: role,
        });
        return await this.organizationMemberRepository.save(organizationMember);
    }

}
