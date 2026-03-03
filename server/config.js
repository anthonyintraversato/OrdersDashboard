/**
 * Centralized runtime config. All env var access goes through here.
 *
 * Why bracket notation: Railway/nixpacks scans source for process.env.VAR_NAME
 * patterns and requires them at build time. Reading via bracket access with
 * string keys prevents static detection — these vars are only needed at runtime.
 */

const ENV_KEYS = {
  databaseUrl: 'DATABASE_URL',
  shopifyStore: 'SHOPIFY_STORE',
  shopifyClientId: 'SHOPIFY_CLIENT_ID',
  shopifyClientSecret: 'SHOPIFY_CLIENT_SECRET',
  shopifyPdxLocationId: 'SHOPIFY_PDX_LOCATION_ID',
  shopifyLaLocationId: 'SHOPIFY_LA_LOCATION_ID',
  nodeEnv: 'NODE_ENV',
  port: 'PORT',
};

function env(key) {
  return process.env[key];
}

function config() {
  return {
    databaseUrl: env(ENV_KEYS.databaseUrl),
    shopifyStore: env(ENV_KEYS.shopifyStore),
    shopifyClientId: env(ENV_KEYS.shopifyClientId),
    shopifyClientSecret: env(ENV_KEYS.shopifyClientSecret),
    shopifyPdxLocationId: env(ENV_KEYS.shopifyPdxLocationId),
    shopifyLaLocationId: env(ENV_KEYS.shopifyLaLocationId),
    nodeEnv: env(ENV_KEYS.nodeEnv),
    port: env(ENV_KEYS.port) || '8080',
    isProduction: env(ENV_KEYS.nodeEnv) === 'production',
  };
}

module.exports = { config };
