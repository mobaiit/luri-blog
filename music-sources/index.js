// Cloudflare Workers cannot enumerate a directory at runtime. Add every source
// module here so the Pages bundler includes it in the Worker bundle.
export const sourceLoaders = [
  () => import('./1.3.0.js'),
  () => import('./itunes-preview.js'),
];
