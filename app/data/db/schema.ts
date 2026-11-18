import type { SqliteDatabase } from 'remix/data-table/sqlite';

/**
 * Creates every table a fresh install needs. These declarations must stay synchronized with the
 * typed table declarations in `./tables.ts` and with the guarded migrations in `./migrations.ts`.
 */
export async function applyFreshInstallSchema(database: SqliteDatabase): Promise<void> {
  await database.executeScript(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      verification_expires_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
        CHECK (
          length(trim(name, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
        ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_invoicing_profiles (
      organization_id TEXT PRIMARY KEY NOT NULL,
      legal_name TEXT CHECK (legal_name IS NULL OR length(trim(legal_name)) > 0),
      address_line1 TEXT,
      address_locality TEXT,
      address_region TEXT,
      address_postal_code TEXT,
      address_country TEXT,
      billing_email TEXT CHECK (billing_email IS NULL OR length(trim(billing_email)) > 0),
      billing_phone TEXT CHECK (billing_phone IS NULL OR length(trim(billing_phone)) > 0),
      pan TEXT CHECK (pan IS NULL OR length(pan) = 10),
      gst_registered INTEGER NOT NULL DEFAULT 0 CHECK (gst_registered IN (0, 1)),
      gstin TEXT,
      gst_state_code TEXT,
      gst_state_name TEXT,
      default_currency TEXT NOT NULL DEFAULT 'INR'
        CHECK (default_currency GLOB '[A-Z][A-Z][A-Z]'),
      payment_term TEXT NOT NULL DEFAULT 'due_on_receipt'
        CHECK (payment_term IN (
          'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
        )),
      custom_payment_terms TEXT CHECK (
        custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200
      ),
      payment_instructions TEXT CHECK (
        payment_instructions IS NULL OR length(payment_instructions) <= 1000
      ),
      customer_notes TEXT CHECK (
        customer_notes IS NULL OR length(customer_notes) <= 1000
      ),
      invoice_prefix TEXT NOT NULL DEFAULT 'INV' CHECK (
        length(invoice_prefix) BETWEEN 1 AND 12
        AND invoice_prefix NOT GLOB '*[/]*'
        AND invoice_prefix NOT GLOB '*[^A-Z0-9_-]*'
      ),
      invoice_starting_number INTEGER NOT NULL DEFAULT 1 CHECK (invoice_starting_number >= 1),
      credit_note_prefix TEXT NOT NULL DEFAULT 'CN' CHECK (
        length(credit_note_prefix) BETWEEN 1 AND 12
        AND credit_note_prefix NOT GLOB '*[/]*'
        AND credit_note_prefix NOT GLOB '*[^A-Z0-9_-]*'
      ),
      credit_note_starting_number INTEGER NOT NULL DEFAULT 1 CHECK (credit_note_starting_number >= 1),
      logo_data_url TEXT CHECK (
        logo_data_url IS NULL OR (
          length(logo_data_url) <= 175000 AND (
            logo_data_url GLOB 'data:image/png;base64,*'
            OR logo_data_url GLOB 'data:image/jpeg;base64,*'
            OR logo_data_url GLOB 'data:image/webp;base64,*'
          )
        )
      ),
      signature_data_url TEXT CHECK (
        signature_data_url IS NULL OR (
          length(signature_data_url) <= 175000 AND (
            signature_data_url GLOB 'data:image/png;base64,*'
            OR signature_data_url GLOB 'data:image/jpeg;base64,*'
            OR signature_data_url GLOB 'data:image/webp;base64,*'
          )
        )
      ),
      signatory_name TEXT CHECK (signatory_name IS NULL OR length(signatory_name) <= 120),
      signatory_designation TEXT CHECK (
        signatory_designation IS NULL OR length(signatory_designation) <= 100
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        (
          address_line1 IS NULL AND address_locality IS NULL AND address_region IS NULL
          AND address_postal_code IS NULL AND address_country IS NULL
        )
        OR (
          address_line1 IS NOT NULL AND length(trim(address_line1)) > 0
          AND address_country IS NOT NULL AND length(trim(address_country)) > 0
        )
      ),
      CHECK (gst_registered = 0 OR (
        gstin IS NOT NULL AND length(gstin) = 15
        AND gst_state_code IS NOT NULL AND length(gst_state_code) = 2
      )),
      CHECK (gst_registered = 1 OR (
        gstin IS NULL AND gst_state_code IS NULL AND gst_state_name IS NULL
      )),
      CHECK (invoice_prefix <> credit_note_prefix),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS organization_gst_rate_presets (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      rate TEXT NOT NULL CHECK (
        length(rate) > 0
        AND rate GLOB '[0-9]*'
        AND rate NOT GLOB '*[^0-9.]*'
        AND rate NOT LIKE '%.%.%'
        AND CAST(rate AS REAL) >= 0
        AND CAST(rate AS REAL) <= 100
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE (organization_id, rate)
    );

    CREATE TABLE IF NOT EXISTS organization_memberships (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      is_owner INTEGER NOT NULL CHECK (is_owner IN (0, 1)),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_passwords (
      user_id TEXT PRIMARY KEY NOT NULL,
      password_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
    CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id
      ON organization_memberships(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_memberships_one_owner
      ON organization_memberships(organization_id) WHERE is_owner = 1;
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_gst_presets_organization
      ON organization_gst_rate_presets(organization_id);

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('individual', 'business')),
      legal_name TEXT NOT NULL,
      preferred_name TEXT,
      trading_name TEXT,
      industry TEXT,
      email TEXT,
      phone TEXT,
      contact_name TEXT,
      contact_role TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      billing_line1 TEXT,
      billing_locality TEXT,
      billing_region TEXT,
      billing_postal_code TEXT,
      billing_country TEXT,
      billing_currency TEXT,
      tax_country TEXT,
      tax_type TEXT,
      tax_value TEXT,
      tax_state_name TEXT,
      tax_state_code TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
    CREATE INDEX IF NOT EXISTS idx_clients_legal_name ON clients(legal_name);
    CREATE INDEX IF NOT EXISTS idx_clients_tax_value ON clients(tax_value);
  `);

  // #42 adds Organization-scoped invoices with same-Organization composite foreign keys. SQLite
  // requires the parent key to be unique, so the matching indexes are created alongside the tables.
  await database.executeScript(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_organization_id ON clients(organization_id, id);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      document_type TEXT NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'credit_note')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),
      invoice_number TEXT CHECK (
        invoice_number IS NULL OR (status <> 'draft' AND length(trim(invoice_number)) > 0)
      ),
      issued_at INTEGER,
      seller_legal_name TEXT,
      seller_address_line1 TEXT,
      seller_address_locality TEXT,
      seller_address_region TEXT,
      seller_address_postal_code TEXT,
      seller_country TEXT,
      seller_email TEXT,
      seller_phone TEXT,
      seller_pan TEXT,
      seller_gst_registered INTEGER NOT NULL DEFAULT 0 CHECK (seller_gst_registered IN (0, 1)),
      seller_gstin TEXT,
      seller_gst_state_code TEXT,
      seller_gst_state_name TEXT,
      seller_logo_data_url TEXT,
      seller_signature_data_url TEXT,
      seller_signatory_name TEXT,
      seller_signatory_designation TEXT,
      currency TEXT NOT NULL CHECK (currency GLOB '[A-Z][A-Z][A-Z]'),
      invoice_date TEXT NOT NULL CHECK (
        invoice_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      due_date TEXT NOT NULL CHECK (
        due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      payment_term TEXT NOT NULL CHECK (payment_term IN (
        'due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_60', 'custom'
      )),
      custom_payment_terms TEXT CHECK (custom_payment_terms IS NULL OR length(custom_payment_terms) <= 200),
      recipient_legal_name TEXT NOT NULL CHECK (length(trim(recipient_legal_name)) > 0),
      recipient_billing_line1 TEXT,
      recipient_billing_locality TEXT,
      recipient_billing_region TEXT,
      recipient_billing_postal_code TEXT,
      recipient_billing_country TEXT,
      recipient_tax_country TEXT,
      recipient_tax_type TEXT,
      recipient_tax_value TEXT,
      recipient_tax_state_name TEXT,
      recipient_tax_state_code TEXT,
      gst_mode TEXT NOT NULL DEFAULT 'none' CHECK (
        gst_mode IN ('none', 'india_gst', 'foreign_manual')
      ),
      supply_type TEXT CHECK (supply_type IN ('domestic', 'export_lut', 'export_igst')),
      place_of_supply_state_code TEXT,
      place_of_supply_state_name TEXT,
      place_of_supply_country TEXT,
      recipient_gstin_applicable INTEGER NOT NULL DEFAULT 0 CHECK (recipient_gstin_applicable IN (0, 1)),
      reverse_charge INTEGER NOT NULL DEFAULT 0 CHECK (reverse_charge IN (0, 1)),
      export_reference TEXT CHECK (export_reference IS NULL OR length(export_reference) <= 200),
      payment_instructions TEXT CHECK (payment_instructions IS NULL OR length(payment_instructions) <= 1000),
      customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 1000),
      internal_note TEXT CHECK (internal_note IS NULL OR length(internal_note) <= 1000),
      subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
      line_discount_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_total_minor >= 0),
      invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed')),
      invoice_discount_value TEXT CHECK (
        invoice_discount_value IS NULL OR (
          length(invoice_discount_value) > 0
          AND invoice_discount_value GLOB '[0-9]*'
          AND invoice_discount_value NOT GLOB '*[^0-9.]*'
          AND invoice_discount_value NOT LIKE '%.%.%'
        )
      ),
      invoice_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (invoice_discount_minor >= 0),
      net_subtotal_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_subtotal_minor >= 0),
      tax_total_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_total_minor >= 0),
      round_off_minor INTEGER NOT NULL DEFAULT 0,
      total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (invoice_discount_mode IS NOT NULL OR (
        invoice_discount_value IS NULL AND invoice_discount_minor = 0
      )),
      CHECK (recipient_gstin_applicable = 0 OR gst_mode = 'india_gst'),
      CHECK (reverse_charge = 0 OR gst_mode = 'india_gst'),
      CHECK (gst_mode = 'india_gst' OR (
        supply_type IS NULL AND place_of_supply_state_code IS NULL
        AND place_of_supply_state_name IS NULL AND place_of_supply_country IS NULL
        AND export_reference IS NULL
      )),
      CHECK (gst_mode <> 'india_gst' OR (supply_type IS NOT NULL AND (
        (supply_type = 'domestic' AND place_of_supply_state_code IS NOT NULL
          AND place_of_supply_country IS NULL AND export_reference IS NULL)
        OR (supply_type IN ('export_lut', 'export_igst')
          AND place_of_supply_state_code IS NULL AND place_of_supply_country IS NOT NULL
          AND place_of_supply_country <> 'IN')
      ))),
      CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
      CHECK (
        total_minor = net_subtotal_minor
          + CASE WHEN reverse_charge = 1 THEN 0 ELSE tax_total_minor END
          + round_off_minor
      ),
      CHECK (
        (status = 'draft' AND invoice_number IS NULL AND issued_at IS NULL)
        OR (
          status = 'issued' AND invoice_number IS NOT NULL
          AND length(trim(invoice_number)) > 0 AND issued_at IS NOT NULL
        )
      ),
      CHECK (status <> 'issued' OR (
        seller_legal_name IS NOT NULL AND length(trim(seller_legal_name)) > 0
        AND seller_address_line1 IS NOT NULL AND length(trim(seller_address_line1)) > 0
        AND seller_country IS NOT NULL AND length(trim(seller_country)) > 0
      )),
      CHECK (status <> 'issued' OR seller_gst_registered = 0 OR (
        seller_gstin IS NOT NULL AND length(seller_gstin) = 15
        AND seller_gst_state_code IS NOT NULL AND length(seller_gst_state_code) = 2
        AND seller_gst_state_name IS NOT NULL AND length(trim(seller_gst_state_name)) > 0
      )),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, client_id) REFERENCES clients(organization_id, id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id, id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_organization_invoice_number
      ON invoices(organization_id, invoice_number);
    CREATE INDEX IF NOT EXISTS idx_invoices_organization_status
      ON invoices(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_invoices_organization_dates
      ON invoices(organization_id, invoice_date DESC, created_at DESC, id ASC);

    CREATE TABLE IF NOT EXISTS document_sequences (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'credit_note')),
      financial_year TEXT NOT NULL CHECK (financial_year GLOB '[0-9][0-9]-[0-9][0-9]'),
      current_number INTEGER NOT NULL CHECK (current_number BETWEEN 1 AND 9007199254740991),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE (organization_id, document_type, financial_year)
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      description TEXT NOT NULL CHECK (length(trim(description)) > 0),
      sac TEXT CHECK (sac IS NULL OR length(sac) <= 64),
      quantity TEXT NOT NULL CHECK (
        length(quantity) > 0 AND quantity GLOB '[0-9]*'
        AND quantity NOT GLOB '*[^0-9.]*' AND quantity NOT LIKE '%.%.%'
      ),
      unit_price TEXT NOT NULL CHECK (
        length(unit_price) > 0 AND unit_price GLOB '[0-9]*'
        AND unit_price NOT GLOB '*[^0-9.]*' AND unit_price NOT LIKE '%.%.%'
      ),
      amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
      discount_mode TEXT CHECK (discount_mode IN ('percent', 'fixed')),
      discount_value TEXT CHECK (
        discount_value IS NULL OR (
          length(discount_value) > 0
          AND discount_value GLOB '[0-9]*'
          AND discount_value NOT GLOB '*[^0-9.]*'
          AND discount_value NOT LIKE '%.%.%'
        )
      ),
      line_discount_minor INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_minor >= 0),
      allocated_invoice_discount_minor INTEGER NOT NULL DEFAULT 0
        CHECK (allocated_invoice_discount_minor >= 0),
      net_minor INTEGER NOT NULL DEFAULT 0 CHECK (net_minor >= 0),
      tax_treatment TEXT CHECK (
        tax_treatment IN ('taxable', 'nil_rated', 'exempt', 'non_gst')
      ),
      gst_rate TEXT CHECK (
        gst_rate IS NULL OR (length(gst_rate) > 0 AND gst_rate GLOB '*[0-9]*'
          AND gst_rate NOT GLOB '*[^0-9.]*'
          AND gst_rate NOT LIKE '%.%.%' AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100)
      ),
      cgst_rate TEXT CHECK (cgst_rate IS NULL OR (
        length(cgst_rate) > 0 AND cgst_rate GLOB '*[0-9]*'
        AND cgst_rate NOT GLOB '*[^0-9.]*'
        AND cgst_rate NOT LIKE '%.%.%' AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100
      )),
      sgst_rate TEXT CHECK (sgst_rate IS NULL OR (
        length(sgst_rate) > 0 AND sgst_rate GLOB '*[0-9]*'
        AND sgst_rate NOT GLOB '*[^0-9.]*'
        AND sgst_rate NOT LIKE '%.%.%' AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100
      )),
      igst_rate TEXT CHECK (igst_rate IS NULL OR (
        length(igst_rate) > 0 AND igst_rate GLOB '*[0-9]*'
        AND igst_rate NOT GLOB '*[^0-9.]*'
        AND igst_rate NOT LIKE '%.%.%' AND CAST(igst_rate AS REAL) BETWEEN 0 AND 100
      )),
      cgst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (cgst_amount_minor >= 0),
      sgst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (sgst_amount_minor >= 0),
      igst_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (igst_amount_minor >= 0),
      foreign_tax_label TEXT CHECK (
        foreign_tax_label IS NULL OR length(trim(foreign_tax_label)) BETWEEN 1 AND 80
      ),
      foreign_tax_mode TEXT CHECK (foreign_tax_mode IN ('percent', 'fixed')),
      foreign_tax_rate TEXT CHECK (
        foreign_tax_rate IS NULL OR (
          length(foreign_tax_rate) > 0 AND foreign_tax_rate GLOB '*[0-9]*'
          AND foreign_tax_rate NOT GLOB '*[^0-9.]*'
          AND foreign_tax_rate NOT LIKE '%.%.%'
          AND CAST(foreign_tax_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      foreign_tax_amount_minor INTEGER NOT NULL DEFAULT 0
        CHECK (foreign_tax_amount_minor >= 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (line_discount_minor + allocated_invoice_discount_minor <= amount_minor),
      CHECK (discount_mode IS NOT NULL OR (discount_value IS NULL AND line_discount_minor = 0)),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id) ON DELETE CASCADE,
      UNIQUE (invoice_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, position);

    CREATE TABLE IF NOT EXISTS invoice_pdf_artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      data BLOB NOT NULL CHECK (length(data) > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
        ON DELETE CASCADE,
      UNIQUE (organization_id, invoice_id)
    );
  `);
}

// #49 records confirmed offline invoice payments without changing the immutable issued invoice.
// Create this after the invoice ownership migrations have established its composite parent key.
export async function applyInvoicePaymentSchema(database: SqliteDatabase): Promise<void> {
  await database.executeScript(`
    CREATE TABLE IF NOT EXISTS invoice_payments (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      payment_date TEXT NOT NULL CHECK (
        payment_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      amount_minor INTEGER NOT NULL CHECK (
        amount_minor > 0 AND amount_minor <= 9007199254740991
      ),
      payment_method TEXT NOT NULL CHECK (payment_method IN (
        'cash', 'upi', 'card', 'cheque_demand_draft', 'bank_transfer',
        'international_wire', 'other'
      )),
      reference TEXT CHECK (reference IS NULL OR length(reference) <= 200),
      voided_at INTEGER,
      void_reason TEXT CHECK (
        void_reason IS NULL OR length(void_reason) <= 1000
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        (voided_at IS NULL AND void_reason IS NULL)
        OR (
          voided_at IS NOT NULL AND void_reason IS NOT NULL
          AND length(trim(void_reason, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
        )
      ),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
        ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_history
      ON invoice_payments(organization_id, invoice_id, payment_date, created_at);
    CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_active
      ON invoice_payments(organization_id, invoice_id) WHERE voided_at IS NULL;
  `);
}

// #51 records manual refunds of over-credited paid invoices with the same same-Organization
// composite parent key and void audit trail as payments.
export async function applyInvoiceRefundSchema(database: SqliteDatabase): Promise<void> {
  await database.executeScript(`
    CREATE TABLE IF NOT EXISTS invoice_refunds (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      refund_date TEXT NOT NULL CHECK (
        refund_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      amount_minor INTEGER NOT NULL CHECK (
        amount_minor > 0 AND amount_minor <= 9007199254740991
      ),
      refund_method TEXT NOT NULL CHECK (refund_method IN (
        'cash', 'upi', 'card', 'cheque_demand_draft', 'bank_transfer',
        'international_wire', 'other'
      )),
      reference TEXT CHECK (reference IS NULL OR length(reference) <= 200),
      voided_at INTEGER,
      void_reason TEXT CHECK (
        void_reason IS NULL OR length(void_reason) <= 1000
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (
        (voided_at IS NULL AND void_reason IS NULL)
        OR (
          voided_at IS NOT NULL AND void_reason IS NOT NULL
          AND length(trim(void_reason, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
        )
      ),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
        ON DELETE CASCADE,
      UNIQUE (organization_id, id, invoice_id)
    );
    CREATE INDEX IF NOT EXISTS idx_invoice_refunds_invoice_history
      ON invoice_refunds(organization_id, invoice_id, refund_date, created_at);
    CREATE INDEX IF NOT EXISTS idx_invoice_refunds_invoice_active
      ON invoice_refunds(organization_id, invoice_id) WHERE voided_at IS NULL;
  `);
}

// #50 stores linked Credit Notes, their credited source lines, and immutable issue-time PDFs.
export async function applyCreditNoteSchema(database: SqliteDatabase): Promise<void> {
  await database.executeScript(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_lines_org_line_invoice
      ON invoice_lines(organization_id, id, invoice_id);

    CREATE TABLE IF NOT EXISTS credit_notes (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'issued')),
      credit_note_number TEXT,
      credit_date TEXT NOT NULL CHECK (
        credit_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      reason TEXT NOT NULL CHECK (
        length(trim(reason, ' ' || char(9) || char(10) || char(11) || char(12) || char(13)))
          BETWEEN 1 AND 1000
      ),
      issued_at INTEGER,
      subtotal_minor INTEGER NOT NULL CHECK (
        subtotal_minor BETWEEN 0 AND 9007199254740991
      ),
      line_discount_total_minor INTEGER NOT NULL CHECK (
        line_discount_total_minor BETWEEN 0 AND 9007199254740991
      ),
      invoice_discount_mode TEXT CHECK (invoice_discount_mode IN ('percent', 'fixed')),
      invoice_discount_minor INTEGER NOT NULL CHECK (
        invoice_discount_minor BETWEEN 0 AND 9007199254740991
      ),
      net_subtotal_minor INTEGER NOT NULL CHECK (
        net_subtotal_minor BETWEEN 0 AND 9007199254740991
      ),
      tax_total_minor INTEGER NOT NULL CHECK (
        tax_total_minor BETWEEN 0 AND 9007199254740991
      ),
      round_off_minor INTEGER NOT NULL CHECK (
        round_off_minor BETWEEN -9007199254740991 AND 9007199254740991
      ),
      total_minor INTEGER NOT NULL CHECK (total_minor BETWEEN 1 AND 9007199254740991),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (subtotal_minor = line_discount_total_minor + invoice_discount_minor + net_subtotal_minor),
      CHECK (
        (status = 'draft' AND credit_note_number IS NULL AND issued_at IS NULL)
        OR (
          status = 'issued' AND credit_note_number IS NOT NULL
          AND length(trim(credit_note_number)) > 0 AND issued_at IS NOT NULL
        )
      ),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
        ON DELETE CASCADE,
      UNIQUE (organization_id, id),
      UNIQUE (organization_id, id, invoice_id),
      UNIQUE (organization_id, credit_note_number)
    );

    CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_history
      ON credit_notes(organization_id, invoice_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_issued
      ON credit_notes(organization_id, invoice_id) WHERE status = 'issued';

    CREATE TABLE IF NOT EXISTS credit_note_lines (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      credit_note_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      invoice_line_id TEXT NOT NULL,
      position INTEGER NOT NULL CHECK (position >= 0),
      description TEXT NOT NULL CHECK (length(trim(description)) > 0),
      sac TEXT CHECK (sac IS NULL OR length(sac) <= 64),
      quantity TEXT NOT NULL CHECK (
        length(quantity) > 0 AND quantity GLOB '[0-9]*'
        AND quantity NOT GLOB '*[^0-9.]*' AND quantity NOT LIKE '%.%.%'
      ),
      unit_price TEXT NOT NULL CHECK (
        length(unit_price) > 0 AND unit_price GLOB '[0-9]*'
        AND unit_price NOT GLOB '*[^0-9.]*' AND unit_price NOT LIKE '%.%.%'
      ),
      amount_minor INTEGER NOT NULL CHECK (
        amount_minor BETWEEN 0 AND 9007199254740991
      ),
      discount_mode TEXT CHECK (discount_mode IN ('percent', 'fixed')),
      discount_value TEXT CHECK (
        discount_value IS NULL OR (
          length(discount_value) > 0
          AND discount_value GLOB '[0-9]*'
          AND discount_value NOT GLOB '*[^0-9.]*'
          AND discount_value NOT LIKE '%.%.%'
        )
      ),
      line_discount_minor INTEGER NOT NULL CHECK (
        line_discount_minor BETWEEN 0 AND 9007199254740991
      ),
      allocated_invoice_discount_minor INTEGER NOT NULL CHECK (
        allocated_invoice_discount_minor BETWEEN 0 AND 9007199254740991
      ),
      net_minor INTEGER NOT NULL CHECK (net_minor BETWEEN 0 AND 9007199254740991),
      tax_treatment TEXT CHECK (
        tax_treatment IN ('taxable', 'nil_rated', 'exempt', 'non_gst')
      ),
      gst_rate TEXT CHECK (
        gst_rate IS NULL OR (
          length(gst_rate) > 0 AND gst_rate GLOB '*[0-9]*'
          AND gst_rate NOT GLOB '*[^0-9.]*' AND gst_rate NOT LIKE '%.%.%'
          AND CAST(gst_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      cgst_rate TEXT CHECK (
        cgst_rate IS NULL OR (
          length(cgst_rate) > 0 AND cgst_rate GLOB '*[0-9]*'
          AND cgst_rate NOT GLOB '*[^0-9.]*' AND cgst_rate NOT LIKE '%.%.%'
          AND CAST(cgst_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      sgst_rate TEXT CHECK (
        sgst_rate IS NULL OR (
          length(sgst_rate) > 0 AND sgst_rate GLOB '*[0-9]*'
          AND sgst_rate NOT GLOB '*[^0-9.]*' AND sgst_rate NOT LIKE '%.%.%'
          AND CAST(sgst_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      igst_rate TEXT CHECK (
        igst_rate IS NULL OR (
          length(igst_rate) > 0 AND igst_rate GLOB '*[0-9]*'
          AND igst_rate NOT GLOB '*[^0-9.]*' AND igst_rate NOT LIKE '%.%.%'
          AND CAST(igst_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      cgst_amount_minor INTEGER NOT NULL CHECK (
        cgst_amount_minor BETWEEN 0 AND 9007199254740991
      ),
      sgst_amount_minor INTEGER NOT NULL CHECK (
        sgst_amount_minor BETWEEN 0 AND 9007199254740991
      ),
      igst_amount_minor INTEGER NOT NULL CHECK (
        igst_amount_minor BETWEEN 0 AND 9007199254740991
      ),
      foreign_tax_label TEXT CHECK (
        foreign_tax_label IS NULL OR length(trim(foreign_tax_label)) BETWEEN 1 AND 80
      ),
      foreign_tax_mode TEXT CHECK (foreign_tax_mode IN ('percent', 'fixed')),
      foreign_tax_rate TEXT CHECK (
        foreign_tax_rate IS NULL OR (
          length(foreign_tax_rate) > 0 AND foreign_tax_rate GLOB '*[0-9]*'
          AND foreign_tax_rate NOT GLOB '*[^0-9.]*' AND foreign_tax_rate NOT LIKE '%.%.%'
          AND CAST(foreign_tax_rate AS REAL) BETWEEN 0 AND 100
        )
      ),
      foreign_tax_amount_minor INTEGER NOT NULL CHECK (
        foreign_tax_amount_minor BETWEEN 0 AND 9007199254740991
      ),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (line_discount_minor + allocated_invoice_discount_minor <= amount_minor),
      CHECK (
        discount_mode IS NOT NULL OR (discount_value IS NULL AND line_discount_minor = 0)
      ),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, credit_note_id, invoice_id)
        REFERENCES credit_notes(organization_id, id, invoice_id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id, invoice_line_id, invoice_id)
        REFERENCES invoice_lines(organization_id, id, invoice_id),
      UNIQUE (credit_note_id, invoice_line_id),
      UNIQUE (credit_note_id, position)
    );

    CREATE INDEX IF NOT EXISTS idx_credit_note_lines_invoice
      ON credit_note_lines(organization_id, invoice_id, credit_note_id);

    CREATE TABLE IF NOT EXISTS credit_note_pdf_artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      organization_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      credit_note_id TEXT NOT NULL,
      data BLOB NOT NULL CHECK (length(data) > 0),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (organization_id, invoice_id) REFERENCES invoices(organization_id, id)
        ON DELETE CASCADE,
      FOREIGN KEY (organization_id, credit_note_id, invoice_id)
        REFERENCES credit_notes(organization_id, id, invoice_id) ON DELETE CASCADE,
      UNIQUE (organization_id, credit_note_id)
    );
  `);
}

export async function createClientsOrganizationStatusIndex(
  database: SqliteDatabase,
): Promise<void> {
  await database.executeScript(`
    CREATE INDEX IF NOT EXISTS idx_clients_organization_status
      ON clients(organization_id, status);
  `);
}
