import { EnvironmentType } from "../../../common/enums/environment.type.enum";
import { Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { Project } from "./project.entity";
import { ApiKey } from "../../api_keys/entities/api.key.entity";
import { BaseEntity } from "../../../database/entities/base.entity";

@Entity("environments")
export class Environment extends BaseEntity {

    @Column({
        type: "enum",
        enum: EnvironmentType,
    })
    name!: EnvironmentType;

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