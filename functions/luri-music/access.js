import { json } from './shared.js';

export async function blogMusicUnavailable(env) {
  if (!env?.LURI_MUSIC_DB) return null;
  const setting = await env.LURI_MUSIC_DB.prepare("SELECT value FROM luri_music_settings WHERE key='music_enabled'").first();
  return setting?.value === 'false' ? json({ error: '当前音乐功能暂不可用' }, 503) : null;
}
