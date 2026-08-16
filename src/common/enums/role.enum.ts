export enum Role {
    OWNER = 'owner',
    ADMIN = 'admin',
    DEVELOPER = 'developer',
    VIEWER = 'viewer',
}


// | Role          | Permissions                                                                                                                   |
// | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
// | **Owner**     | Full access. Delete organization, billing, invite/remove members, manage all projects and environments.                       |
// | **Admin**     | Manage projects, feature flags, environments, API keys, members (except Owners), experiments.                                 |
// | **Developer** | Create/edit feature flags, variants, experiments, SDK keys (optional), view analytics. Cannot manage organization or billing. |
// | **Viewer**    | Read-only access to projects, flags, experiments, and analytics.                                                              |
