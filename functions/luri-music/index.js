import { cookie, hash, id, json, now, passwordHash, sessionCookie, token, verifyPassword, verifyTurnstileToken } from './shared.js';

const USER_COOKIE = 'luri_music_session';
const ADMIN_COOKIE = 'luri_music_admin';
const RESEND_SETTING = 'resend_api_key';
const RESEND_FROM = 'LURI MUSIC <no-reply@luri.cc.cd>';
const EMAIL_CODE_TTL = 10 * 60 * 1000;
const EMAIL_CODE_COOLDOWN = 60 * 1000;
const body = async (request) => request.json().catch(() => ({}));
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128;

const currentUser = async (request, env) => {
  const value = cookie(request, USER_COOKIE);
  return value && env.LURI_MUSIC_DB.prepare('SELECT u.id,u.email,u.display_name,e.expires_at FROM luri_music_sessions s JOIN luri_music_users u ON u.id=s.user_id LEFT JOIN luri_music_entitlements e ON e.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(value), now()).first();
};
const publicUser = (user) => user && ({ id: user.id, email: user.email, name: user.display_name, expiresAt: user.expires_at || null, hasPlayback: Boolean(user.expires_at && Date.parse(user.expires_at) > Date.now()) });
const isAdmin = async (request, env) => {
  const value = cookie(request, ADMIN_COOKIE);
  return Boolean(value && await env.LURI_MUSIC_DB.prepare('SELECT id FROM luri_music_admin_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(value), now()).first());
};
const createSession = async (userId, env) => {
  const value = token();
  await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(id(), userId, await hash(value), new Date(Date.now() + 2592e6).toISOString(), now()).run();
  return value;
};
const calculateExpiry = (base, type, amount) => {
  const source = new Date(base); const target = new Date(source);
  if (type === 'day') return new Date(source.getTime() + amount * 864e5).toISOString();
  if (type === 'month') target.setMonth(target.getMonth() + amount); else target.setFullYear(target.getFullYear() + amount);
  if (target.getDate() !== source.getDate()) target.setDate(0);
  return target.toISOString();
};
const durationLabel = (code) => `${code.duration_value}${code.duration_type === 'day' ? '天' : code.duration_type === 'month' ? '个月' : '年'}`;
const codeStatus = (code) => code.disabled_at ? '已禁用' : code.redeemed_at ? '已使用' : Date.parse(code.expires_at) <= Date.now() ? '已过期' : '未使用';
const recomputeEntitlement = async (env, userId) => {
  if (!userId) return null;
  const result = await env.LURI_MUSIC_DB.prepare('SELECT duration_type,duration_value,redeemed_at FROM luri_music_codes WHERE redeemed_by=? AND redeemed_at IS NOT NULL AND disabled_at IS NULL ORDER BY redeemed_at,id').bind(userId).all();
  let expiresAt = null;
  for (const code of result.results) {
    const base = Math.max(Date.parse(code.redeemed_at), Date.parse(expiresAt || 0));
    expiresAt = calculateExpiry(base, code.duration_type, code.duration_value);
  }
  if (expiresAt) await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_entitlements(user_id,expires_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(userId, expiresAt, now()).run();
  else await env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_entitlements WHERE user_id=?').bind(userId).run();
  return expiresAt;
};
const userPayload = async (env, user) => {
  const result = user ? await env.LURI_MUSIC_DB.prepare('SELECT code_display,duration_type,duration_value,redeemed_at,disabled_at FROM luri_music_codes WHERE redeemed_by=? ORDER BY redeemed_at DESC').bind(user.id).all() : { results: [] };
  return user && { ...publicUser(user), redemptionCodes: result.results.map((code) => ({ code: code.code_display || '历史兑换码', durationLabel: durationLabel(code), redeemedAt: code.redeemed_at, status: code.disabled_at ? '已禁用' : '已使用' })) };
};
const verifyHuman = async (data, env) => {
  const result = await verifyTurnstileToken(data.turnstileToken, env);
  return result.success ? null : json({ error: result.reason === 'missing-token' ? '请先完成人机验证' : '人机验证未通过' }, 400);
};
const resendConfig = async (env) => {
  const setting = await env.LURI_MUSIC_DB.prepare('SELECT value FROM luri_music_settings WHERE key=?').bind(RESEND_SETTING).first();
  if (setting?.value) return { key: setting.value, source: 'database' };
  if (env.RESEND_API_KEY) return { key: env.RESEND_API_KEY, source: 'environment' };
  return { key: '', source: 'none' };
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const sendVerificationEmail = async (env, recipient, purpose, code) => {
  const config = await resendConfig(env);
  if (!config.key) throw new Error('邮件服务尚未配置');
  const action = purpose === 'register' ? '注册账号' : '重置密码';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [recipient], subject: `LURI MUSIC ${action}验证码`, html: `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;color:#111;line-height:1.7"><h2 style="margin:0 0 18px">LURI MUSIC</h2><p>你正在${escapeHtml(action)}，验证码为：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:20px 0">${escapeHtml(code)}</p><p>验证码 10 分钟内有效，请勿转发给他人。如非本人操作，请忽略本邮件。</p></div>` }),
  });
  if (!response.ok) { console.error('Resend request failed', response.status); throw new Error('验证码邮件发送失败，请稍后重试'); }
};
const generateEmailCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const consumeEmailCode = async (env, mail, purpose, value) => {
  const row = await env.LURI_MUSIC_DB.prepare('SELECT id,code_hash,expires_at,attempts FROM luri_music_email_codes WHERE email=? AND purpose=?').bind(mail, purpose).first();
  if (!row || Date.parse(row.expires_at) <= Date.now() || row.attempts >= 5 || await hash(String(value || '').trim()) !== row.code_hash) {
    if (row) await env.LURI_MUSIC_DB.prepare('UPDATE luri_music_email_codes SET attempts=attempts+1 WHERE id=?').bind(row.id).run();
    return null;
  }
  return row;
};

export async function hasMusicAccess(request, env) { return Boolean(publicUser(await currentUser(request, env))?.hasPlayback); }

export async function handleLuriMusic(request, env) {
  if (!env.LURI_MUSIC_DB) return json({ error: '音乐服务尚未配置' }, 503);
  const action = new URL(request.url).pathname.replace('/api/luri-music/', '');
  if (action === 'auth/me') { const user = await currentUser(request, env); return json({ user: await userPayload(env, user), turnstile: { enabled: Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY), siteKey: env.TURNSTILE_SITE_KEY || '' } }); }

  if (action === 'auth/email-code' && request.method === 'POST') {
    const data = await body(request); const mail = normalizeEmail(data.email);
    const purpose = data.purpose === 'reset' ? 'reset' : data.purpose === 'register' ? 'register' : '';
    if (!isEmail(mail) || !purpose) return json({ error: '请输入有效邮箱' }, 400);
    await env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_email_codes WHERE expires_at<=?').bind(now()).run();
    const existingUser = await env.LURI_MUSIC_DB.prepare('SELECT id FROM luri_music_users WHERE email=?').bind(mail).first();
    if (purpose === 'register' && existingUser) return json({ error: '该邮箱已注册' }, 409);
    if (purpose === 'reset' && !existingUser) return json({ ok: true, message: '如果该邮箱已注册，验证码将发送至邮箱' });
    const previous = await env.LURI_MUSIC_DB.prepare('SELECT last_sent_at FROM luri_music_email_codes WHERE email=? AND purpose=?').bind(mail, purpose).first();
    if (previous && Date.now() - Date.parse(previous.last_sent_at) < EMAIL_CODE_COOLDOWN) return json({ error: '发送过于频繁，请稍后再试' }, 429);
    const code = generateEmailCode();
    await sendVerificationEmail(env, mail, purpose, code);
    const timestamp = now();
    await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_email_codes(id,email,purpose,code_hash,expires_at,last_sent_at,attempts,created_at) VALUES(?,?,?,?,?,?,0,?) ON CONFLICT(email,purpose) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,last_sent_at=excluded.last_sent_at,attempts=0,created_at=excluded.created_at').bind(id(), mail, purpose, await hash(code), new Date(Date.now() + EMAIL_CODE_TTL).toISOString(), timestamp, timestamp).run();
    return json({ ok: true, message: '验证码已发送，有效期 10 分钟' });
  }

  if (action === 'auth/register' && request.method === 'POST') {
    const data = await body(request); const mail = normalizeEmail(data.email); const name = String(data.name || '').trim().slice(0, 40);
    if (!isEmail(mail) || !name || !validPassword(data.password)) return json({ error: '请填写名称、有效邮箱和至少 8 位密码' }, 400);
    const human = await verifyHuman(data, env); if (human) return human;
    const emailCode = await consumeEmailCode(env, mail, 'register', data.emailCode);
    if (!emailCode) return json({ error: '邮箱验证码错误或已过期' }, 400);
    const userId = id();
    try { await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_users(id,email,display_name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(userId, mail, name, await passwordHash(data.password), now(), now()).run(); }
    catch { return json({ error: '该邮箱已注册' }, 409); }
    await env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_email_codes WHERE id=?').bind(emailCode.id).run();
    const value = await createSession(userId, env);
    return json({ user: { id: userId, email: mail, name, expiresAt: null, hasPlayback: false } }, 201, { 'set-cookie': sessionCookie(USER_COOKIE, value, 2592000) });
  }

  if (action === 'auth/login' && request.method === 'POST') {
    const data = await body(request); const registered = data.turnstileToken === '__skip__' ? await currentUser(request, env) : null;
    const canSkip = Boolean(registered && normalizeEmail(registered.email) === normalizeEmail(data.email));
    const human = canSkip ? null : await verifyHuman(data, env); if (human) return human;
    const user = await env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_users WHERE email=?').bind(normalizeEmail(data.email)).first();
    if (!user || !await verifyPassword(data.password || '', user.password_hash)) return json({ error: '邮箱或密码错误' }, 401);
    const entitlement = await env.LURI_MUSIC_DB.prepare('SELECT expires_at FROM luri_music_entitlements WHERE user_id=?').bind(user.id).first();
    const value = await createSession(user.id, env);
    return json({ user: await userPayload(env, { ...user, expires_at: entitlement?.expires_at }) }, 200, { 'set-cookie': sessionCookie(USER_COOKIE, value, 2592000) });
  }

  if (action === 'auth/reset-password' && request.method === 'POST') {
    const data = await body(request); const mail = normalizeEmail(data.email);
    if (!isEmail(mail) || !validPassword(data.password)) return json({ error: '请输入有效邮箱和至少 8 位新密码' }, 400);
    const human = await verifyHuman(data, env); if (human) return human;
    const emailCode = await consumeEmailCode(env, mail, 'reset', data.emailCode);
    if (!emailCode) return json({ error: '邮箱验证码错误或已过期' }, 400);
    const user = await env.LURI_MUSIC_DB.prepare('SELECT id FROM luri_music_users WHERE email=?').bind(mail).first();
    if (!user) return json({ error: '邮箱验证码错误或已过期' }, 400);
    await env.LURI_MUSIC_DB.batch([
      env.LURI_MUSIC_DB.prepare('UPDATE luri_music_users SET password_hash=?,updated_at=? WHERE id=?').bind(await passwordHash(data.password), now(), user.id),
      env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_sessions WHERE user_id=?').bind(user.id),
      env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_email_codes WHERE id=?').bind(emailCode.id),
    ]);
    return json({ ok: true });
  }

  if (action === 'auth/logout') return json({ ok: true }, 200, { 'set-cookie': sessionCookie(USER_COOKIE, '', 0) });
  if (action === 'admin/logout') return json({ ok: true }, 200, { 'set-cookie': sessionCookie(ADMIN_COOKIE, '', 0) });
  if (action === 'auth/password' && request.method === 'POST') {
    const user = await currentUser(request, env); const data = await body(request);
    if (!user) return json({ error: '请先登录' }, 401);
    const row = await env.LURI_MUSIC_DB.prepare('SELECT password_hash FROM luri_music_users WHERE id=?').bind(user.id).first();
    if (!await verifyPassword(data.currentPassword || '', row.password_hash)) return json({ error: '旧密码错误' }, 400);
    if (!validPassword(data.password)) return json({ error: '新密码至少需要 8 位' }, 400);
    await env.LURI_MUSIC_DB.prepare('UPDATE luri_music_users SET password_hash=?,updated_at=? WHERE id=?').bind(await passwordHash(data.password), now(), user.id).run();
    return json({ ok: true });
  }

  if (action === 'redeem' && request.method === 'POST') {
    const user = await currentUser(request, env); const data = await body(request);
    if (!user) return json({ error: '请先登录' }, 401);
    const human = await verifyHuman(data, env); if (human) return human;
    const rawCode = String(data.code || '').replace(/[^a-z0-9]/ig, '').toUpperCase();
    const code = await env.LURI_MUSIC_DB.prepare('SELECT * FROM luri_music_codes WHERE code_hash=?').bind(await hash(rawCode)).first();
    if (!code) return json({ error: '兑换码不存在' }, 400);
    if (code.disabled_at) return json({ error: '兑换码已作废' }, 400);
    if (code.redeemed_at) return json({ error: '兑换码已使用' }, 400);
    if (Date.parse(code.expires_at) <= Date.now()) return json({ error: '兑换码已过期' }, 400);
    const redeemedAt = now();
    const updated = await env.LURI_MUSIC_DB.prepare('UPDATE luri_music_codes SET redeemed_by=?,redeemed_at=? WHERE id=? AND redeemed_at IS NULL AND disabled_at IS NULL').bind(user.id, redeemedAt, code.id).run();
    if (!updated.meta.changes) return json({ error: '兑换码状态已变化，请重试' }, 409);
    const expiresAt = await recomputeEntitlement(env, user.id);
    return json({ expiresAt });
  }

  if (action === 'admin/login' && request.method === 'POST') {
    const data = await body(request); const human = await verifyHuman(data, env); if (human) return human;
    const credentials = await env.LURI_MUSIC_DB.prepare('SELECT password_hash FROM luri_music_admin_credentials WHERE id=1').first();
    const valid = credentials ? await verifyPassword(data.password || '', credentials.password_hash) : Boolean(env.ADMIN_PASSWORD && data.password === env.ADMIN_PASSWORD);
    if (!valid) return json({ error: '账号或密码错误' }, 401);
    const value = token();
    await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_admin_sessions(id,token_hash,expires_at,created_at) VALUES(?,?,?,?)').bind(id(), await hash(value), new Date(Date.now() + 288e5).toISOString(), now()).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(ADMIN_COOKIE, value, 28800) });
  }

  if (!await isAdmin(request, env)) return json({ error: '管理员登录已失效' }, 401);
  if (action === 'admin/email-config' && request.method === 'GET') {
    const config = await resendConfig(env);
    return json({ configured: Boolean(config.key), source: config.source, sender: 'no-reply@luri.cc.cd', apiKey: config.key });
  }
  if (action === 'admin/email-config' && request.method === 'POST') {
    const data = await body(request); const apiKey = String(data.apiKey || '').trim();
    if (apiKey.length < 10) return json({ error: '请输入有效的 Resend API Key' }, 400);
    await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(RESEND_SETTING, apiKey, now()).run();
    return json({ configured: true, source: 'database', sender: 'no-reply@luri.cc.cd' });
  }

  if (action === 'admin/codes' && request.method === 'POST') {
    const data = await body(request); const type = ['day', 'month', 'year'].includes(data.durationType) ? data.durationType : 'day';
    const value = Math.min(100, Math.max(1, Number(data.durationValue) || 0)); const count = Math.min(100, Math.max(1, Number(data.count) || 1)); const validDays = Math.min(3650, Math.max(1, Number(data.validDays) || 30));
    if (!value) return json({ error: '有效期数值不正确' }, 400);
    const codes = [];
    for (let index = 0; index < count; index += 1) {
      const raw = [...crypto.getRandomValues(new Uint8Array(10))].map((number) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[number % 32]).join(''); const code = `LM-${raw.slice(0, 5)}-${raw.slice(5)}`;
      codes.push(code);
      await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_codes(id,code_hash,code_display,duration_days,duration_type,duration_value,expires_at,note,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id(), await hash(code.replaceAll('-', '')), code, value, type, value, new Date(Date.now() + validDays * 864e5).toISOString(), String(data.note || '').slice(0, 120), now()).run();
    }
    return json({ codes });
  }

  if (action === 'admin/list' && request.method === 'GET') {
    const url = new URL(request.url); const kind = url.searchParams.get('kind') || 'all'; const requestedStatus = url.searchParams.get('status') || ''; const query = url.searchParams.get('email') || ''; const page = Math.max(1, Number(url.searchParams.get('page')) || 1); const size = 20;
    const where = [kind === 'redeemed' ? 'c.redeemed_at IS NOT NULL' : '1=1']; const args = [];
    if (requestedStatus) { where.push("CASE WHEN c.disabled_at IS NOT NULL THEN '已禁用' WHEN c.redeemed_at IS NOT NULL THEN '已使用' WHEN c.expires_at<=? THEN '已过期' ELSE '未使用' END=?"); args.push(now(), requestedStatus); }
    if (query) { where.push('u.email LIKE ?'); args.push(`%${query}%`); }
    const from = ` FROM luri_music_codes c LEFT JOIN luri_music_users u ON u.id=c.redeemed_by LEFT JOIN luri_music_entitlements ent ON ent.user_id=c.redeemed_by WHERE ${where.join(' AND ')}`;
    const total = await env.LURI_MUSIC_DB.prepare(`SELECT count(*) n${from}`).bind(...args).first();
    const rows = await env.LURI_MUSIC_DB.prepare(`SELECT c.*,u.email,ent.expires_at member_expires_at${from} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`).bind(...args, size, (page - 1) * size).all();
    return json({ items: rows.results.map((code) => ({ ...code, status: codeStatus(code), durationLabel: durationLabel(code), membershipStatus: code.member_expires_at && Date.parse(code.member_expires_at) > Date.now() ? '有效' : '已过期' })), total: total.n, page, size });
  }
  if (action === 'admin/code-status' && request.method === 'POST') {
    const data = await body(request); const code = await env.LURI_MUSIC_DB.prepare('SELECT id,redeemed_by FROM luri_music_codes WHERE id=?').bind(data.id).first();
    if (!code) return json({ error: '兑换码不存在' }, 404);
    await env.LURI_MUSIC_DB.prepare(`UPDATE luri_music_codes SET disabled_at=${data.disabled ? '?' : 'NULL'} WHERE id=?`).bind(...(data.disabled ? [now(), data.id] : [data.id])).run();
    if (code.redeemed_by) await recomputeEntitlement(env, code.redeemed_by);
    return json({ ok: true });
  }
  if (action === 'admin/delete' && request.method === 'POST') {
    const data = await body(request); const code = await env.LURI_MUSIC_DB.prepare('SELECT redeemed_by FROM luri_music_codes WHERE id=?').bind(data.id).first();
    if (!code) return json({ error: '兑换码不存在' }, 404);
    await env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_codes WHERE id=?').bind(data.id).run();
    if (code.redeemed_by) await recomputeEntitlement(env, code.redeemed_by);
    return json({ ok: true });
  }
  if (action === 'admin/bulk-delete' && request.method === 'POST') {
    const data = await body(request); const ids = [...new Set(Array.isArray(data.ids) ? data.ids.filter((value) => typeof value === 'string').slice(0, 100) : [])];
    if (!ids.length) return json({ error: '请选择要删除的兑换码' }, 400);
    const placeholders = ids.map(() => '?').join(',');
    const rows = await env.LURI_MUSIC_DB.prepare(`SELECT DISTINCT redeemed_by FROM luri_music_codes WHERE id IN (${placeholders}) AND redeemed_by IS NOT NULL`).bind(...ids).all();
    const result = await env.LURI_MUSIC_DB.prepare(`DELETE FROM luri_music_codes WHERE id IN (${placeholders})`).bind(...ids).run();
    for (const row of rows.results) await recomputeEntitlement(env, row.redeemed_by);
    return json({ ok: true, deleted: result.meta.changes });
  }
  if (action === 'admin/cleanup-expired' && request.method === 'POST') {
    const result = await env.LURI_MUSIC_DB.prepare('DELETE FROM luri_music_codes WHERE redeemed_at IS NULL AND expires_at<=?').bind(now()).run();
    return json({ ok: true, deleted: result.meta.changes });
  }
  if (action === 'admin/password' && request.method === 'POST') {
    const data = await body(request); const credentials = await env.LURI_MUSIC_DB.prepare('SELECT password_hash FROM luri_music_admin_credentials WHERE id=1').first();
    const valid = credentials ? await verifyPassword(data.currentPassword || '', credentials.password_hash) : Boolean(env.ADMIN_PASSWORD && data.currentPassword === env.ADMIN_PASSWORD);
    if (!valid) return json({ error: '当前密码错误' }, 400);
    if (!validPassword(data.newPassword)) return json({ error: '新密码至少需要 8 位' }, 400);
    const password = await passwordHash(data.newPassword);
    if (credentials) await env.LURI_MUSIC_DB.prepare('UPDATE luri_music_admin_credentials SET password_hash=?,updated_at=? WHERE id=1').bind(password, now()).run();
    else await env.LURI_MUSIC_DB.prepare('INSERT INTO luri_music_admin_credentials(id,password_hash,updated_at) VALUES(1,?,?)').bind(password, now()).run();
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
}
