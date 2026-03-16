/**
 * @kanban/database
 *
 * Public API for the WatermelonDB abstraction layer.
 *
 * Consumers import from here — never from internal paths.
 * This barrel export controls what leaks out of the package.
 */

// Database factory
export { createDatabaseProvider } from './DatabaseProvider';
export type { DatabaseProvider } from './DatabaseProvider';

// Models (needed by React context consumers and service layer)
export { AttachmentModel } from './models/AttachmentModel';
export { CardModel } from './models/CardModel';
export { CardTagModel } from './models/CardTagModel';
export { ProjectModel } from './models/ProjectModel';
export { SwimlaneModel } from './models/SwimlaneModel';
export { TagModel } from './models/TagModel';
export { UserConfigModel } from './models/UserConfigModel';
export { UserModel } from './models/UserModel';

// Repositories (exposed so services can type-hint against them)
export { AttachmentRepository } from './repositories/AttachmentRepository';
export { CardRepository } from './repositories/CardRepository';
export { ProjectRepository } from './repositories/ProjectRepository';
export { SwimlaneRepository } from './repositories/SwimlaneRepository';
export { UserRepository } from './repositories/UserRepository';

// Schema (needed by adapter packages)
export { schema } from './schema';
export { migrations } from './schema/migrations';

// React context — wires DatabaseProvider into the component tree
export { DatabaseContext, DatabaseContextProvider, useDatabase } from './context/DatabaseContext';

// Reactive hooks
export { useObservableQuery, useObservableRecord } from './hooks/useObservableQuery';
