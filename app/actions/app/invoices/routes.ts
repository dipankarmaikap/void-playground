import { del, get, post, resources, route } from 'remix/routes';

/**
 * The CRUD-shaped leaves come from the framework's resource builder, restricted to the leaves
 * this app has today; the collection is nested under /app. `/new` is static, so it wins over the
 * `:invoiceId` parameter. Non-CRUD shapes — the PDF preview, the issue/discard transitions, and
 * the nested payments, refunds, and credit notes — stay explicit declarations. Voiding a
 * payment or refund is a delete of that money movement, submitted as DELETE through the
 * method-override middleware.
 */
export const invoiceRoutes = route({
  ...resources('/', {
    only: ['index', 'new', 'show', 'edit', 'create', 'update'],
    param: 'invoiceId',
  }),
  pdf: get('/:invoiceId/pdf'),
  lifecycle: route('/:invoiceId', {
    issue: post('/issue'),
    discard: post('/discard'),
    internalNote: post('/internal-note'),
  }),
  payments: route('/:invoiceId/payments', {
    record: post('/'),
    void: del('/:paymentId/void'),
  }),
  refunds: route('/:invoiceId/refunds', {
    record: post('/'),
    void: del('/:refundId/void'),
  }),
  creditNotes: route('/:invoiceId/credit-notes', {
    ...resources('/', {
      only: ['new', 'edit', 'create', 'update'],
      param: 'creditNoteId',
    }),
    pdf: get('/:creditNoteId/pdf'),
    lifecycle: route('/:creditNoteId', {
      issue: post('/issue'),
      discard: post('/discard'),
    }),
  }),
});
