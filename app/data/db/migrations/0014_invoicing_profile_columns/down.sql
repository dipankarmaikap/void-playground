-- Reverts 0014 by rebuilding the pre-#40 profile shape; the tax, invoice preference, branding,
-- and signatory data is lost with the columns.

CREATE TABLE organization_invoicing_profiles_pre_40 (
  organization_id TEXT PRIMARY KEY NOT NULL,
  legal_name TEXT CHECK (legal_name IS NULL OR length(trim(legal_name)) > 0),
  address_line1 TEXT,
  address_locality TEXT,
  address_region TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  billing_email TEXT CHECK (billing_email IS NULL OR length(trim(billing_email)) > 0),
  billing_phone TEXT CHECK (billing_phone IS NULL OR length(trim(billing_phone)) > 0),
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
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

INSERT INTO organization_invoicing_profiles_pre_40 (
  organization_id, legal_name, address_line1, address_locality, address_region,
  address_postal_code, address_country, billing_email, billing_phone, created_at, updated_at
)
SELECT
  organization_id, legal_name, address_line1, address_locality, address_region,
  address_postal_code, address_country, billing_email, billing_phone, created_at, updated_at
FROM organization_invoicing_profiles;

DROP TABLE organization_invoicing_profiles;
ALTER TABLE organization_invoicing_profiles_pre_40 RENAME TO organization_invoicing_profiles;
