-- #40 extends the #39 profile with tax registration, invoice preference, branding, and
-- signatory columns. SQLite cannot add the cross-column CHECKs (GST-identifier pairing,
-- invoice/credit-note prefix inequality) via ALTER TABLE, so the table is rebuilt at its
-- modern declaration to end every database—fresh or upgraded—at the same schema. The rebuild
-- is safe inside the runner's transaction: the profile is a child of organizations and nothing
-- references it, so dropping it never trips a foreign key.

CREATE TABLE organization_invoicing_profiles_rebuilt (
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

INSERT INTO organization_invoicing_profiles_rebuilt (
  organization_id, legal_name, address_line1, address_locality, address_region,
  address_postal_code, address_country, billing_email, billing_phone, created_at, updated_at
)
SELECT
  organization_id, legal_name, address_line1, address_locality, address_region,
  address_postal_code, address_country, billing_email, billing_phone, created_at, updated_at
FROM organization_invoicing_profiles;

DROP TABLE organization_invoicing_profiles;
ALTER TABLE organization_invoicing_profiles_rebuilt RENAME TO organization_invoicing_profiles;
