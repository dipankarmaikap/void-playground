import { form, get, post, route } from 'remix/routes';

/**
 * Leaves are explicit because this app has no method-override middleware. `/new` is static, so it
 * wins over the `:invoiceId` parameter.
 */
export const invoiceRoutes = route({
  index: get('/'),
  new: form('/new'),
  show: get('/:invoiceId'),
  edit: form('/:invoiceId/edit'),
  lifecycle: route('/:invoiceId', {
    discard: post('/discard'),
  }),
});
