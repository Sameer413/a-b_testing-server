import { Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { Project } from "./project.entity";
import { ApiKey } from "../../api_keys/entities/api.key.entity";
import { BaseEntity } from "../../../database/entities/base.entity";

@Entity("environments")
@Unique(['name', 'project'])
export class Environment extends BaseEntity {

    @Column({ type: 'varchar', length: 50 })
    name!: string;

    @Column({ type: 'boolean', default: false })
    isDefault!: boolean;

    @ManyToOne(
        () => Project,
        project => project.environments,
        { onDelete: 'CASCADE' },
    )
    project!: Project;

    @OneToMany(
        () => ApiKey,
        key => key.environment,
    )
    apiKeys!: ApiKey[];
}