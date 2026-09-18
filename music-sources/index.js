// Cloudflare Workers cannot enumerate a directory at runtime. Register a
// script here only after it has passed the Worker compatibility check.
export const sourceLoaders = [
  { name: 'huibq', version: '1.2.0', load: () => import('./huibq.js') },
  { name: 'huanyin', version: '3', disabledActions: { tx: ['musicUrl'], kw: ['musicUrl'], wy: ['musicUrl'] }, load: () => import('./huanyin.js') },
  { name: 'direct-resolver-bridge', version: '1.0.0', load: () => import('./direct-resolver-bridge.js') },
  { name: 'kw-catalog', version: '1.0.0', load: () => import('./kw-catalog.js') },
  { name: 'kg-catalog', version: '1.0.0', load: () => import('./kg-catalog.js') },
  { name: 'tx-catalog', version: '1.0.0', load: () => import('./tx-catalog.js') },
  { name: 'wy-catalog', version: '1.0.0', load: () => import('./wy-catalog.js') },
];
