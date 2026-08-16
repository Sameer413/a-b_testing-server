import { Column, Entity, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../database/entities/base.entity';
// import { Role } from '../../../common/enums/role.enum';
import { OrganizationMember } from '../../organizations/entities/organization.member.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  username!: string;

  @Column({ unique: true, length: 255 })
  email!: string;

  @Column({ length: 100 })
  firstName!: string;

  @Column({ length: 100 })
  lastName!: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Exclude()
  @Column()
  password!: string;

  // @Column({ type: 'simple-array', default: Role.VIEWER })
  // roles!: Role[];

  @Column({ default: true })
  isActive!: boolean;

  @Exclude()
  @Column({ nullable: true, type: 'text' })
  hashedRefreshToken!: string | null;

  @OneToMany(() => OrganizationMember, member => member.user)
  organizations!: OrganizationMember[];
}
