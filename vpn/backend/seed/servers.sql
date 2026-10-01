-- ============================================================================
--  Seed server-location catalog.
--
--  These are PLACEHOLDER rows so the website/app show a realistic location
--  list out of the box. The endpoint_host / public_key / agent_url values are
--  dummies — a node only becomes usable once you run infra/install-vpn-node.sh
--  on a real VPS and register it (the installer prints the exact INSERT, or use
--  `POST /admin/nodes`). Until then these rows are marked healthy=false.
--
--  Free tier: a couple of locations. Premium: the long list (the upsell).
-- ============================================================================

INSERT INTO nodes (code, country, country_name, city, endpoint_host, endpoint_port, public_key, agent_url, agent_secret, premium)
VALUES
  ('us-nyc-1', 'US', 'United States', 'New York',     'nyc1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_1=', 'https://nyc1.example-vpn.net:8443', 'replace-me', false),
  ('de-fra-1', 'DE', 'Germany',       'Frankfurt',    'fra1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_2=', 'https://fra1.example-vpn.net:8443', 'replace-me', false),
  ('gb-lon-1', 'GB', 'United Kingdom','London',        'lon1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_3=', 'https://lon1.example-vpn.net:8443', 'replace-me', true),
  ('nl-ams-1', 'NL', 'Netherlands',   'Amsterdam',     'ams1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_4=', 'https://ams1.example-vpn.net:8443', 'replace-me', true),
  ('jp-tyo-1', 'JP', 'Japan',         'Tokyo',         'tyo1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_5=', 'https://tyo1.example-vpn.net:8443', 'replace-me', true),
  ('sg-sin-1', 'SG', 'Singapore',     'Singapore',     'sin1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_6=', 'https://sin1.example-vpn.net:8443', 'replace-me', true),
  ('ca-tor-1', 'CA', 'Canada',        'Toronto',       'tor1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_7=', 'https://tor1.example-vpn.net:8443', 'replace-me', true),
  ('au-syd-1', 'AU', 'Australia',     'Sydney',        'syd1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_8=', 'https://syd1.example-vpn.net:8443', 'replace-me', true),
  ('fr-par-1', 'FR', 'France',        'Paris',         'par1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_9=', 'https://par1.example-vpn.net:8443', 'replace-me', true),
  ('ch-zrh-1', 'CH', 'Switzerland',   'Zurich',        'zrh1.example-vpn.net', 51820, 'SEED_PLACEHOLDER_PUBKEY_10=', 'https://zrh1.example-vpn.net:8443', 'replace-me', true)
ON CONFLICT (code) DO NOTHING;
