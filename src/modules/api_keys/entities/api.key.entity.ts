import { BaseEntity } from '../../../database/entities/base.entity';
import { Column, Entity, ManyToOne } from 'typeorm';
import { Environment } from '../../project/entities/environment.entity';

@Entity('api_keys')
export class ApiKey extends BaseEntity {
  @Column({ unique: true })
  key!: string;

  /** Human-readable label, e.g. "Mobile SDK key" */
  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string;

  @Column({ default: true })
  active!: boolean;

  /** If set, the key is rejected after this date */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @ManyToOne(() => Environment, (env) => env.apiKeys, { onDelete: 'CASCADE' })
  environment!: Environment;
}
