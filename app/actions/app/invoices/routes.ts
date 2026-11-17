import { form, get, post, route } from 'remix/routes';

/**
 * Leaves are explicit because this app has no method-override middleware. `/new` is static, so it
 * wins over the `:invoiceId` parameter.
 */
export const invoiceRoutes = route({
  index: get('/'),
  new: form('/new'),
  show: get('/:invoiceId'),
  pdf: get('/:invoiceId/pdf'),
  edit: form('/:invoiceId/edit'),
  lifecycle: route('/:invoiceId', {
    issue: post('/issue'),
    discard: post('/discard'),
    internalNote: post('/internal-note'),
  }),
  payments: route('/:invoiceId/payments', {
    record: post('/'),
    void: post('/:paymentId/void'),
  }),
  refunds: route('/:invoiceId/refunds', {
    record: post('/'),
    void: post('/:refundId/void'),
  }),
  creditNotes: route('/:invoiceId/credit-notes', {
    new: form('/new'),
    edit: form('/:creditNoteId/edit'),
    pdf: get('/:creditNoteId/pdf'),
    lifecycle: route('/:creditNoteId', {
      issue: post('/issue'),
      discard: post('/discard'),
    }),
  }),
});
