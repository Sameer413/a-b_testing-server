import { BaseEntity } from "../../../database/entities/base.entity";
import { User } from "../../users/entities/user.entity";
import { Column, Entity, ManyToOne } from "typeorm";
import { Organization } from "./organization.entity";
import { Role } from "../../../common/enums/role.enum";

@Entity("organization_members")
export class OrganizationMember extends BaseEntity {
    @ManyToOne(() => User, user => user.organizations)
    user!: User;

    @ManyToOne(
        () => Organization,
        (organization) => organization.members,
    )
    organization!: Organization;

    @Column({ type: 'enum', enum: Role, default: Role.VIEWER })
    role!: Role;
}