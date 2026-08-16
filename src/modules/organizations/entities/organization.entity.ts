import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { OrganizationMember } from './organization.member.entity';
import { Project } from '../../project/entities/project.entity';
import { User } from '../../users/entities/user.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ length: 255 })
  name!: string;

  @Column({ length: 150 })
  organizationCode!: string;

  @OneToOne(() => User, user => user.id)
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @OneToMany(() => OrganizationMember, member => member.organization)
  members!: OrganizationMember[];

  @OneToMany(
    () => Project,
    project => project.organization,
  )
  projects!: Project[];
}