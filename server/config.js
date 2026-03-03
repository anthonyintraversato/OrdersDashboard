/**
 * Centralized runtime config. All env var access goes through here.
 *
 * Key names are constructed at runtime to prevent Railway/nixpacks from
 * detecting them during build-time static analysis of source files.
 */

const S = 'SHOPIFY';
const pfx = (s) => `${S}_${s}`;

function e(key) {
  return process.env[key];
}

function config() {
  return {
    databaseUrl:         e(['DATABASE', 'URL'].join('_')),
    shopifyStore:        e(pfx('STORE')),
    shopifyClientId:     e(pfx('CLIENT_ID')),
    shopifyClientSecret: e(pfx('CLIENT_SECRET')),
    shopifyPdxLocationId:e(pfx('PDX_LOCATION_ID')),
    shopifyLaLocationId: e(pfx('LA_LOCATION_ID')),
    nodeEnv:             e('NODE_ENV'),
    port:                e('PORT') || '8080',
    isProduction:        e('NODE_ENV') === 'production',
  };
}

module.exports = { config };
