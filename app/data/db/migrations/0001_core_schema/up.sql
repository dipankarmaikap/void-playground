-- The identity/Organization core as it stood before the invoice-era steps: users without the
-- display_name column (0012 adds it) and invoicing profiles without the #40 tax, invoice
-- preference, branding, and signatory columns (0014 rebuilds the table with them). Every other
-- table here is already at its final shape; no later migration alters these tables.

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  verification_expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
    CHECK (
      length(trim(name, ' ' || char(9) || char(10) || char(11) || char(12) || char(13))) > 0
    ),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE organization_invoicing_profiles (
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

CREATE TABLE organization_gst_rate_presets (
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

CREATE TABLE organization_memberships (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  is_owner INTEGER NOT NULL CHECK (is_owner IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE user_passwords (
  user_id TEXT PRIMARY KEY NOT NULL,
  password_hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  data TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_organization_memberships_user_id
  ON organization_memberships(user_id);
CREATE UNIQUE INDEX idx_organization_memberships_one_owner
  ON organization_memberships(organization_id) WHERE is_owner = 1;
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_gst_presets_organization
  ON organization_gst_rate_presets(organization_id);

-- Client types are inlined from the canonical CLIENT_TYPES list in
-- app/data/client-names.ts; the Client-type sync test keeps this CHECK aligned with it.
CREATE TABLE clients (
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

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_type ON clients(type);
CREATE INDEX idx_clients_legal_name ON clients(legal_name);
CREATE INDEX idx_clients_tax_value ON clients(tax_value);
