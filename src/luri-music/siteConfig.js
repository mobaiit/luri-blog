const STORAGE_KEY = 'luri-site-config-v1';
const STORAGE_TTL = 5 * 60 * 1000;
let pendingRequest = null;

export const normalizeSiteConfig = (data = {}) => ({
  blogEnabled: data.blogSiteEnabled !== false,
  postsEnabled: data.blogPostsEnabled !== false,
  enabled: data.musicPageEnabled !== false,
  navigationEnabled: data.musicNavigationEnabled !== false,
  blogNavigationEnabled: data.musicBlogNavigationEnabled !== false,
  accessRequired: data.musicAccessRequired !== false,
  aboutEnabled: data.aboutPageEnabled !== false,
  docsEnabled: data.docsPageEnabled !== false,
});

export const readSiteConfig = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return cached?.expiresAt > Date.now() && cached.value ? cached.value : null;
  } catch {
    return null;
  }
};

export const writeSiteConfig = (data) => {
  const value = normalizeSiteConfig(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ value, expiresAt: Date.now() + STORAGE_TTL }));
  } catch {
    // Storage can be unavailable in private browsing; the HTTP cache still applies.
  }
  return value;
};

export const fetchSiteConfig = () => {
  if (pendingRequest) return pendingRequest;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  pendingRequest = fetch('/api/luri-music/site-config', { credentials: 'omit', cache: 'no-store', signal: controller.signal })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('网站配置加载失败')))
    .finally(() => {
      window.clearTimeout(timeout);
      pendingRequest = null;
    });
  return pendingRequest;
};
