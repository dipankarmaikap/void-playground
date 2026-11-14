import { form, get, route } from 'remix/routes';

/**
 * Leaves are explicit because this app has no method-override middleware.
 * `/new` is static, so it wins over the `:clientId` parameter.
 */
export const clientRoutes = route({
  index: get('/'),
  new: form('/new'),
  show: get('/:clientId'),
  edit: form('/:clientId/edit'),
});
