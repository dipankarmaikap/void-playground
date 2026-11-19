-- Reverts 0001 by dropping the core tables in reverse dependency order.

DROP TABLE sessions;
DROP TABLE user_passwords;
DROP TABLE organization_memberships;
DROP TABLE organization_gst_rate_presets;
DROP TABLE clients;
DROP TABLE organization_invoicing_profiles;
DROP TABLE users;
DROP TABLE organizations;
