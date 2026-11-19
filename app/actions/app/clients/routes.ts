import { put, route, resources } from 'remix/routes';

/**
 * The CRUD-shaped leaves come from the framework's resource builder, restricted to the leaves
 * this app has today. `/new` is static, so it wins over the `:clientId` parameter. Lifecycle
 * transitions are not CRUD leaves and stay explicit; archive and restore are idempotent state
 * changes, submitted as PUT through the method-override middleware.
 */
export const clientRoutes = route({
  ...resources('/', {
    only: ['index', 'new', 'show', 'edit', 'create', 'update'],
    param: 'clientId',
  }),
  lifecycle: route('/:clientId', {
    archive: put('/archive'),
    restore: put('/restore'),
  }),
});
