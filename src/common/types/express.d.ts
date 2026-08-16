import { Project } from '../../modules/project/entities/project.entity';

declare global {
    namespace Express {
        interface Request {
            /**
             * Resolved project entity attached by ProjectMemberGuard.
             * Available on any route protected by @ProjectAuth() / ProjectMemberGuard.
             */
            project?: Project;
        }
    }
}
