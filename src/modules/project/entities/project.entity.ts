import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Environment } from './environment.entity';
import { FeatureFlag } from '../../feature_flag/entities/feature.flag.entity';
import { ApiKey } from '../../api_keys/entities/api.key.entity';

@Entity()
export class Project extends BaseEntity {
  @Column({ unique: true, name: 'project_id' })
  projectId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @ManyToOne(() => Organization, (org) => org.projects)
  organization!: Organization;

  @OneToMany(() => Environment, (env) => env.project, { cascade: true })
  environments!: Environment[];

  @OneToMany(() => FeatureFlag, (flag) => flag.project)
  featureFlags!: FeatureFlag[];
}
