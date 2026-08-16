import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { Environment } from '../../project/entities/environment.entity';

@Entity('api_keys')
export class ApiKey extends BaseEntity {
  @Column({ unique: true })
  key!: string;

  @Column({ default: true })
  active!: boolean;

  @ManyToOne(() => Environment, (env) => env.apiKeys, { onDelete: 'CASCADE' })
  environment!: Environment;
}
