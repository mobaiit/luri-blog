import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Music from '../pages/Music';
import ProviderClient, { normalizeProviderConnection, verifyProviderConnection } from './ProviderClient';
import Turnstile from './Turnstile';
import { ConfirmDialog, LoadingScreen, Spinner, Toast } from './UiFeedback';
import './luri-music.css';
import './auth-ux.css';
import './code-management.css';
import './ui-feedback.css';

const api = async (path, options = {}) => { const response = await fetch(`/api/luri-music/${path}`, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || '请求失败，请稍后重试'); return data; };
const ANNOUNCEMENT_DISMISSED = 'luri.music.announcement.dismissed.v2';
const TERMS_VERSION = '2026-09-22.1';
const PROVIDER_PROTOCOL_DOCS = '/docs#protocol';
const QUALITY_OPTIONS = [
  { value: '128k', label: '普通', mark: 'STD', tone: 'low', note: '128 Kbps · 更省流量' },
  { value: '192k', label: '标准', mark: 'HQ', tone: 'medium', note: '192 Kbps · 均衡选择' },
  { value: '320k', label: '高音质', mark: 'HQ+', tone: 'high', note: '320 Kbps · 清晰度优先' },
  { value: 'flac', label: '无损 FLAC', mark: 'SQ', tone: 'lossless', note: '无损音频 · 流量较高' },
  { value: 'flac24bit', label: 'Hi-Res', mark: 'Hi-Res', tone: 'hires', note: '24-bit FLAC · 实验性支持' },
];
const shouldShowAnnouncement = () => { try { return localStorage.getItem(ANNOUNCEMENT_DISMISSED) !== '1'; } catch { return true; } };
const renderStrongText = (value) => String(value).split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
const LEGAL_DOCUMENTS = {
  terms: {
    title: '使用条款',
    sections: [
      ['重要提示与条款适用', '本条款适用于 LURI MUSIC 网页播放器、账号系统、Provider 配置及相关服务。使用前请务必完整阅读并理解本条款，尤其是以粗体标注的内容。注册或登录时，用户须**主动勾选同意本条款**；完成确认并继续使用，即表示用户已阅读、理解并接受本条款。未成年人应在监护人阅读、理解并同意后使用。'],
      ['定义与约定', '**“用户”**是指注册、访问或使用 LURI MUSIC 的个人或组织；**“Provider”**是指按照 Music Provider Protocol 提供数据与功能接口的独立服务；**“合规 Provider”**是指其运营、数据来源和接口实现符合适用法律、内容许可及相关平台协议的 Provider；**“版权内容”**包括但不限于音乐文件、歌词、专辑封面、艺人信息及其他受知识产权法律保护的内容。'],
      ['产品定位与服务范围', 'LURI MUSIC 是一款**基于 Web 的可扩展媒体播放客户端**，提供内容检索与播放界面、播放列表、本地播放控制、账号服务及 Music Provider Protocol 配置管理。LURI MUSIC **不预置内容源，不实现具体内容源适配，不运营音乐曲库，不托管、存储、缓存、代理或分发音频文件**。检索、播放地址、歌词及封面等数据均由用户自行选择的独立 Provider 提供；账号可保存多个 Provider 配置，但同一时间仅启用一个。'],
      ['第三方 Provider 与内容来源', 'Provider 由第三方或用户自行运营，其服务条款、隐私政策、数据处理方式和内容授权情况均与 LURI MUSIC 相互独立。搜索结果、歌曲信息、播放地址、歌词及封面等数据由当前 Provider 处理和返回。**连接 Provider 前，用户应自行核实其运营主体、数据来源、授权范围和使用条件**。'],
      ['合规使用与版权要求', '用户仅可在法律法规、内容许可及 Provider 服务条款允许的范围内使用相关功能和内容。**未经合法授权，不得下载、复制、传播、公开表演或商业利用受保护内容**；不得绕过访问控制或技术保护措施，不得获取非公开数据、实施批量抓取、攻击或干扰服务。LURI MUSIC 尊重知识产权并倡导通过官方或已获授权的渠道获取音乐服务。'],
      ['Provider 开发与接入', '第三方开发者和用户可以依据 Music Provider Protocol 1.0 实现兼容服务。Provider 的开发、部署、分发及运营者应确保接口实现、数据来源和处理行为合法合规。**协议兼容仅表示技术接口兼容，不构成 LURI MUSIC 对任何 Provider 的审核、推荐、授权、合作或担保**。'],
      ['账号与安全', '用户应使用真实有效的邮箱注册并妥善保管账号及密码，不得出售、出借账号或绕过权限验证。发现异常登录或凭证泄露时，应立即修改密码并联系本站。对于违反本条款、存在安全风险或涉嫌违法侵权的账号，本站有权采取**限制功能、暂停服务或终止账号**等必要措施。'],
      ['个人信息处理', '为提供账号和 Provider 配置服务，本站会处理名称、邮箱、密码摘要、登录会话、Provider 地址、加密后的长期凭证、当前配置、收藏歌曲的名称、歌手及来源标识、同步状态、条款版本及必要的安全日志。相关信息仅用于身份验证、配置同步、收藏恢复、安全防护和故障排查。**本站不保存明文密码，也不出售个人信息**。'],
      ['第三方基础服务', '本站使用 Cloudflare 提供网络托管、数据存储和安全验证，使用 Resend 发送验证邮件。连接 Provider 后，功能请求会发送至用户选定的 Provider，并由其依据自身规则处理账号摘要、凭证和请求信息。用户可以随时停用或删除 Provider 配置。'],
      ['数据安全与用户权利', '本站采用密码摘要、HttpOnly 会话 Cookie、凭证加密等合理安全措施，并仅在实现服务、安全、合规和争议处理所需的期限内保存数据。用户可通过 luri@luri.cc.cd 申请查询、更正或删除账号信息，但法律法规要求保留或处理争议所必需的信息除外。'],
      ['服务可用性与责任限制', '网络、设备、Provider 维护或不可抗力可能导致服务中断、播放地址失效或数据异常。本站会在合理范围内维护播放器和账号功能，但**不对第三方 Provider 的持续可用性、数据准确性或内容合法性作出保证**。因用户或 Provider 运营者违反法律、第三方协议或本条款产生的责任，由相应行为人依法承担。'],
      ['权利投诉与处理', '权利人认为相关页面或功能侵害其合法权益时，可将作品名称、具体链接、权属证明、身份及联系方式和明确处理请求发送至 luri@luri.cc.cd。本站将在收到完整材料后及时核验，并根据实际情况采取**屏蔽、断开连接或停止相关功能**等措施。'],
      ['条款更新与服务变更', '本站可能因法律政策、产品功能或安全要求更新本条款，并在页面标注更新日期。涉及用户权益的重要调整将以合理方式提示；需要重新同意时，用户完成确认后方可继续使用相关服务。'],
      ['法律适用与联系', '本条款的订立、效力、解释和争议处理适用中华人民共和国法律。争议应优先友好协商；协商不成的，可依法向有管辖权的人民法院提起诉讼。联系邮箱：**luri@luri.cc.cd**。'],
    ],
  },
};

export default function LuriMusic({ active = true, accessRequired = true, standalone = false, docsEnabled = true }) {
  const [booting, setBooting] = useState(true); const [user, setUser] = useState(null); const [providers, setProviders] = useState([]); const [playbackQuality, setPlaybackQuality] = useState('128k'); const [turnstile, setTurnstile] = useState({ enabled: false, siteKey: '' }); const [authMode, setAuthMode] = useState('login'); const [dialog, setDialog] = useState(''); const [menuOpen, setMenuOpen] = useState(false); const [toast, setToast] = useState(null); const [announcement, setAnnouncement] = useState(shouldShowAnnouncement);
  const notify = useCallback((title, message = '', type = 'info') => setToast({ title, message, type }), []);
  const loadProviders = useCallback(async () => { const data = await api('providers'); setProviders(data.items || []); setPlaybackQuality(data.preferences?.playbackQuality === 'auto' ? '128k' : data.preferences?.playbackQuality || '128k'); return data.items || []; }, []);
  const refresh = useCallback(async () => { const data = await api('auth/me'); setUser(data.user || null); setTurnstile(data.turnstile || { enabled: false, siteKey: '' }); if (data.user) await loadProviders(); else { setProviders([]); setPlaybackQuality('128k'); } return data.user; }, [loadProviders]);
  useEffect(() => { refresh().catch((error) => notify('加载失败', error.message, 'error')).finally(() => setBooting(false)); }, [refresh, notify]);
  const activeProvider = providers.find((provider) => provider.active) || null;
  const providerClient = useMemo(() => activeProvider ? new ProviderClient(activeProvider, () => loadProviders().catch(() => {})) : null, [activeProvider, loadProviders]);
  if (booting) return active ? <LoadingScreen label="正在加载 LURI MUSIC…" /> : null;
  const openAuth = () => { setAuthMode('login'); setDialog('auth'); setMenuOpen(false); };
  const openAccountDialog = (name) => { setDialog(name); setMenuOpen(false); };
  const logout = async () => { try { await api('auth/logout', { method: 'POST' }); setUser(null); setProviders([]); setPlaybackQuality('128k'); setMenuOpen(false); notify('已退出登录', '', 'success'); } catch (error) { notify('退出失败', error.message, 'error'); } };
  const requireAccess = () => { if (!user) { openAuth(); notify('请先登录', '登录后即可配置并使用 Provider', 'warning'); return false; } if (!activeProvider) { openAccountDialog('providers'); notify('尚未启用 Provider', '请先添加或选择一个 Provider', 'warning'); return false; } return true; };
  const dismissAnnouncementForever = () => { try { localStorage.setItem(ANNOUNCEMENT_DISMISSED, '1'); } catch { /* 浏览器可能禁用本地存储 */ } setAnnouncement(false); };
  return <main className={`luri-music-clone${standalone ? ' is-standalone' : ''}${active ? '' : ' is-global-player'}`}>
    <header className={`lm-site-bar${accessRequired ? '' : ' public-access'}`}><strong>LURI MUSIC</strong>{docsEnabled && <a className="lm-docs-button" href="/docs" target="_blank" rel="noreferrer">使用文档</a>}<button className="lm-announcement-button" onClick={() => setAnnouncement(true)}>网站公告</button><div className="lm-account-wrap">{user ? <><button className="lm-account-trigger" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}><span><b>{user.name}</b></span></button>{menuOpen && <><button className="lm-menu-backdrop" aria-label="关闭账户菜单" onClick={() => setMenuOpen(false)} /><section className="lm-account-menu"><header><div className="lm-account-menu__identity"><b>{user.name}</b></div><span>{user.email}</span></header><ProviderInfo provider={activeProvider} /><button onClick={() => openAccountDialog('quality')}>播放设置</button><button onClick={() => openAccountDialog('providers')}>Provider 配置</button><button onClick={() => openAccountDialog('terms')}>使用条款</button><button onClick={() => openAccountDialog('password')}>修改密码</button><button className="danger" onClick={logout}>退出登录</button></section></>}</> : <button className="lm-account-trigger lm-login-trigger" onClick={openAuth}>登录 / 注册</button>}</div></header>
    <Music key={`${user?.id || 'guest'}:${activeProvider?.id || 'no-provider'}`} forceMusicPage={active} providerClient={providerClient} playbackQuality={playbackQuality} favoriteNamespace={user?.id || ''} favoriteBackup={user?.favorites || []} favoriteBackupUpdatedAt={user?.favoritesUpdatedAt || null} favoriteSyncEnabled={Boolean(user)} pageTitle="LURI MUSIC" headerNotice={null} legalLinks={false} onRequireAccess={requireAccess} />
    {active && announcement && <Announcement close={() => setAnnouncement(false)} dismissForever={dismissAnnouncementForever} />}
    {dialog === 'auth' && <AuthDialog mode={authMode} setMode={setAuthMode} turnstile={turnstile} done={async (nextUser) => { setUser(nextUser); await loadProviders().catch(() => setProviders([])); setDialog(''); notify('登录成功', `欢迎回来，${nextUser.name}`, 'success'); }} forgot={() => setDialog('forgot')} close={() => setDialog('')} notify={notify} />}
    {dialog === 'forgot' && <ForgotPassword turnstile={turnstile} back={() => { setAuthMode('login'); setDialog('auth'); }} close={() => setDialog('')} notify={notify} />}
    {dialog === 'providers' && <ProviderDialog user={user} providers={providers} refresh={loadProviders} close={() => setDialog('')} notify={notify} />}
    {dialog === 'quality' && <QualityDialog value={playbackQuality} saved={(quality) => { setPlaybackQuality(quality); setDialog(''); }} close={() => setDialog('')} notify={notify} />}
    {dialog === 'password' && <PasswordDialog close={() => setDialog('')} notify={notify} />}
    {dialog === 'terms' && <LegalDocument type="terms" close={() => setDialog('')} />}
    <Toast toast={toast} onClose={() => setToast(null)} />
  </main>;
}

function AuthDialog({ mode, setMode, turnstile, done, forgot, close, notify }) {
  const [token, setToken] = useState(''); const [reset, setReset] = useState(0); const [loading, setLoading] = useState(false); const [sending, setSending] = useState(false); const [countdown, setCountdown] = useState(0); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [emailCode, setEmailCode] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [legal, setLegal] = useState(''); const [termsAccepted, setTermsAccepted] = useState(false);
  useEffect(() => { if (!countdown) return undefined; const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [countdown]);
  const resetTurnstile = useCallback(() => { setToken(''); setReset((value) => value + 1); }, []);
  const switchMode = () => { setName(''); setEmail(''); setEmailCode(''); setPassword(''); setConfirm(''); setTermsAccepted(false); setMode(mode === 'login' ? 'register' : 'login'); };
  const sendCode = async () => { if (!/^\S+@\S+\.\S+$/.test(email)) return notify('无法发送', '请先填写有效邮箱', 'warning'); setSending(true); try { const data = await api('auth/email-code', { method: 'POST', body: JSON.stringify({ email, purpose: 'register' }) }); setCountdown(60); notify('发送成功', data.message, 'success'); } catch (error) { notify('发送失败', error.message, 'error'); } finally { setSending(false); } };
  const submit = async (event) => { event.preventDefault(); if (!termsAccepted) return notify('请先同意使用条款', '阅读并勾选《使用条款》后再继续', 'warning'); if (mode === 'register' && password !== confirm) return notify('两次密码不一致', '请检查确认密码后再提交', 'warning'); if (turnstile.enabled && !token) return notify('请先完成人机验证', '请完成下方的 Turnstile 验证后再尝试', 'warning'); setLoading(true); try { if (mode === 'register') { await api('auth/register', { method: 'POST', body: JSON.stringify({ name, email, emailCode, password, turnstileToken: token }) }); const login = await api('auth/login', { method: 'POST', body: JSON.stringify({ email, password, turnstileToken: '__skip__' }) }); done(login.user); } else { const login = await api('auth/login', { method: 'POST', body: JSON.stringify({ email, password, turnstileToken: token }) }); done(login.user); } } catch (error) { notify(mode === 'login' ? '登录失败' : '注册失败', error.message, 'error'); resetTurnstile(); } finally { setLoading(false); } };
  if (legal) return <LegalDocument type={legal} close={() => setLegal('')} />;
  return <Modal className="lm-auth-modal" title={mode === 'login' ? '登录 LURI MUSIC' : '注册 LURI MUSIC'} close={close}><form onSubmit={submit}><div className="lm-form-fields">{mode === 'register' && <label>名称<input value={name} onChange={(event) => setName(event.target.value)} required maxLength="40" autoComplete="name" /></label>}<label>邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" /></label>{mode === 'register' && <CodeField value={emailCode} onChange={setEmailCode} send={sendCode} sending={sending} countdown={countdown} />}<PasswordField label="密码" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode === 'register' && <PasswordField label="确认密码" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength="8" required autoComplete="new-password" />}</div>{mode === 'login' && <button type="button" className="link lm-forgot" onClick={forgot}>忘记密码？</button>}{turnstile.enabled && <Turnstile siteKey={turnstile.siteKey} onVerify={setToken} onExpire={resetTurnstile} resetSignal={reset} />}<div className="lm-consent"><input id="lm-terms-consent" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><label htmlFor="lm-terms-consent">我已阅读并同意</label><button type="button" onClick={() => setLegal('terms')}>《使用条款》</button></div><button className="primary" disabled={loading || !termsAccepted || (turnstile.enabled && !token)}>{loading ? <><Spinner /> {mode === 'login' ? '登录中…' : '注册并登录中…'}</> : mode === 'login' ? '登录' : '注册'}</button><button type="button" className="link" onClick={switchMode}>{mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}</button></form></Modal>;
}

function ForgotPassword({ turnstile, back, close, notify }) {
  const [email, setEmail] = useState(''); const [emailCode, setEmailCode] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [token, setToken] = useState(''); const [reset, setReset] = useState(0); const [loading, setLoading] = useState(false); const [sending, setSending] = useState(false); const [countdown, setCountdown] = useState(0);
  useEffect(() => { if (!countdown) return undefined; const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [countdown]);
  const resetTurnstile = useCallback(() => { setToken(''); setReset((value) => value + 1); }, []);
  const sendCode = async () => { if (!/^\S+@\S+\.\S+$/.test(email)) return notify('无法发送', '请先填写有效邮箱', 'warning'); setSending(true); try { const data = await api('auth/email-code', { method: 'POST', body: JSON.stringify({ email, purpose: 'reset' }) }); setCountdown(60); notify('请求已提交', data.message, 'success'); } catch (error) { notify('发送失败', error.message, 'error'); } finally { setSending(false); } };
  const submit = async (event) => { event.preventDefault(); if (password !== confirm) return notify('两次密码不一致', '请检查确认密码后再提交', 'warning'); if (turnstile.enabled && !token) return notify('请先完成人机验证', '请完成下方的 Turnstile 验证后再尝试', 'warning'); setLoading(true); try { await api('auth/reset-password', { method: 'POST', body: JSON.stringify({ email, emailCode, password, turnstileToken: token }) }); notify('重置成功', '请使用新密码登录', 'success'); back(); } catch (error) { notify('重置失败', error.message, 'error'); resetTurnstile(); } finally { setLoading(false); } };
  return <Modal title="找回密码" close={close}><form onSubmit={submit}><label>注册邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" autoFocus /></label><CodeField value={emailCode} onChange={setEmailCode} send={sendCode} sending={sending} countdown={countdown} /><PasswordField label="新密码" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required autoComplete="new-password" /><PasswordField label="确认新密码" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength="8" required autoComplete="new-password" />{turnstile.enabled && <Turnstile siteKey={turnstile.siteKey} onVerify={setToken} onExpire={resetTurnstile} resetSignal={reset} />}<button className="primary" disabled={loading || (turnstile.enabled && !token)}>{loading ? <><Spinner /> 重置中…</> : '重置密码'}</button><button type="button" className="link" onClick={back}>返回登录</button></form></Modal>;
}

function CodeField({ value, onChange, send, sending, countdown }) { return <label>邮箱验证码<span className="lm-code-input"><input value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="\d{6}" maxLength="6" required autoComplete="one-time-code" /><button type="button" onClick={send} disabled={sending || countdown > 0}>{sending ? <Spinner /> : countdown > 0 ? `${countdown} 秒` : '发送验证码'}</button></span></label>; }
function PasswordField({ label, ...props }) { const [visible, setVisible] = useState(false); return <label>{label}<span className="lm-password-input"><input {...props} type={visible ? 'text' : 'password'} /><button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? '隐藏密码' : '显示密码'} title={visible ? '隐藏' : '显示'}><EyeIcon crossed={!visible} /></button></span></label>; }
function EyeIcon({ crossed = false }) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.7" />{crossed && <path d="m4 4 16 16" />}</svg>; }

function ProviderDialog({ user, providers, refresh, close, notify }) {
  const [adding, setAdding] = useState(false); const [viewing, setViewing] = useState(null); const [editing, setEditing] = useState(null); const [acting, setActing] = useState(''); const [confirming, setConfirming] = useState(null); const [connectionType, setConnectionType] = useState('official'); const [advanced, setAdvanced] = useState(false); const [reconfiguring, setReconfiguring] = useState(false); const [formError, setFormError] = useState('');
  const errorRef = useRef(null);
  const save = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const target = editing ? `providers/${editing.id}` : 'providers';
    setActing(editing?.id || 'add');
    setFormError('');
    try {
      if (editing && !reconfiguring) {
        await api(target, { method: 'PATCH', body: JSON.stringify({ displayName: form.get('name') }) });
      } else {
        const input = advanced ? JSON.parse(String(form.get('advanced') || '')) : { url: form.get('url') };
        const connection = normalizeProviderConnection(input);
        const discovered = await verifyProviderConnection(connection, user);
        await api(target, {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({ connection: discovered.connection, manifest: discovered.manifest, displayName: form.get('name'), connectionType }),
        });
      }
      await refresh();
      const nameOnly = Boolean(editing && !reconfiguring);
      setAdding(false); setEditing(null); setAdvanced(false); setReconfiguring(false); setFormError('');
      notify(editing ? 'Provider 已更新' : 'Provider 已添加', nameOnly ? '显示名称已保存，原连接配置保持不变' : '连接与认证已验证并安全保存', 'success');
    } catch (error) {
      const accessDenied = error?.code === 'provider_access_denied' || error?.status === 401 || error?.status === 403;
      const message = error instanceof SyntaxError ? '高级配置不是有效的 JSON' : accessDenied ? 'Provider 拒绝了当前认证信息，请检查后重试' : error.message;
      setFormError(message);
      requestAnimationFrame(() => errorRef.current?.focus());
      notify(accessDenied ? 'Provider 认证失败' : editing ? '更新失败' : '添加失败', message, 'error');
    } finally { setActing(''); }
  };
  const activate = async (provider) => { setActing(provider.id); try { await api(`providers/${provider.id}/activate`, { method: 'POST', body: '{}' }); await refresh(); setViewing((current) => current?.id === provider.id ? { ...current, active: true } : current); notify('Provider 已启用', provider.displayName, 'success'); } catch (error) { notify('启用失败', error.message, 'error'); } finally { setActing(''); } };
  const deactivate = async (provider) => { setActing(provider.id); try { await api(`providers/${provider.id}/deactivate`, { method: 'POST', body: '{}' }); await refresh(); setViewing((current) => current?.id === provider.id ? { ...current, active: false } : current); notify('Provider 已禁用', provider.displayName, 'success'); } catch (error) { notify('禁用失败', error.message, 'error'); } finally { setActing(''); } };
  const remove = async (provider) => { setActing(provider.id); try { await api(`providers/${provider.id}`, { method: 'DELETE' }); await refresh(); setViewing(null); notify('Provider 已删除', '', 'success'); } catch (error) { notify('删除失败', error.message, 'error'); } finally { setActing(''); setConfirming(null); } };
  const formProvider = editing || null; const showForm = adding || Boolean(editing);
  const cancelForm = () => { setViewing(null); setAdding(false); setEditing(null); setAdvanced(false); setReconfiguring(false); setFormError(''); };
  const connectionLabels = { official: '官方源', third_party: '第三方 Provider' };
  const beginAdd = () => { setViewing(null); setEditing(null); setConnectionType('official'); setAdvanced(false); setReconfiguring(true); setFormError(''); setAdding(true); };
  const beginEdit = (provider) => { setViewing(null); setAdding(false); setEditing(provider); setConnectionType(provider.connectionType === 'official' ? 'official' : 'third_party'); setAdvanced(false); setReconfiguring(false); setFormError(''); };
  const editConnection = () => { setReconfiguring(true); setAdvanced(false); setFormError(''); };
  return <Modal className="lm-provider-modal" title="Provider 配置" close={close}>
    {showForm ? <form key={`${formProvider?.id || 'new'}:${reconfiguring}`} className="lm-provider-form" onSubmit={save}>
      <header className="lm-provider-form-header"><div><b>{formProvider ? '管理 Provider' : '添加 Provider'}</b><small>{formProvider && !reconfiguring ? '修改显示名称或重新配置连接' : '完成认证后保存连接'}</small></div>{formProvider && <span>{reconfiguring ? '重新配置' : '基本信息'}</span>}</header>
      {formError && <div className="lm-provider-form-error" role="alert" tabIndex="-1" ref={errorRef}><b>无法保存</b><span>{formError}</span></div>}
      {formProvider && !reconfiguring ? <>
        <label>显示名称<input name="name" maxLength="60" defaultValue={formProvider.displayName || ''} placeholder="我的 Provider" autoFocus /></label>
        <div className="lm-provider-current"><span>当前连接</span><b>{formProvider.providerUrl}</b><small>认证参数与 Header 已隐藏，保存名称不会修改现有连接。</small></div>
        <button type="button" className="lm-provider-reconfigure" onClick={editConnection}>重新配置连接</button>
      </> : <>
        <fieldset className="lm-provider-types"><legend>Provider 类型</legend>{[['official', '官方源'], ['third_party', '第三方 Provider']].map(([value, title]) => <button type="button" className={connectionType === value ? 'active' : ''} onClick={() => setConnectionType(value)} key={value}>{title}</button>)}</fieldset>
        {advanced ? <label>高级 JSON 配置<textarea name="advanced" rows="8" required autoFocus spellCheck="false" placeholder={'{\n  "url": "https://provider.example?key=xxx",\n  "headers": {\n    "Authorization": "Bearer xxx"\n  },\n  "credentials": "include"\n}'} /></label> : <label>Provider 地址<input name="url" type="url" placeholder="https://provider.example.com?key=xxx" required autoFocus /></label>}
        <button type="button" className="lm-provider-advanced-toggle" aria-expanded={advanced} onClick={() => { setAdvanced((value) => !value); setFormError(''); }}>{advanced ? '收起高级配置，改用普通 URL' : '高级配置：Header、Cookie 与 JSON'}</button>
        <label>显示名称（可选）<input name="name" maxLength="60" defaultValue={formProvider?.displayName || ''} placeholder="我的 Provider" /></label>
        <p>{formProvider ? '为保护敏感信息，重新配置时需要填写完整连接。' : 'URL 参数、静态 Header 和浏览器 Cookie 只用于认证。'} 保存前会将当前账号邮箱发送给 Provider，并换取短期访问 Token。</p>
      </>}
      {formProvider && !reconfiguring && <section className="lm-provider-danger-zone"><div><b>删除 Provider</b><small>删除后需要重新配置才能再次使用。</small></div><button type="button" disabled={Boolean(acting)} onClick={() => setConfirming(formProvider)}>删除</button></section>}
      <div className="lm-provider-form-actions"><button className="primary" disabled={Boolean(acting)}>{acting ? <><Spinner /> {editing && !reconfiguring ? '保存中…' : '认证中…'}</> : editing && !reconfiguring ? '保存名称' : formProvider ? '认证并更新' : '认证并添加'}</button><button type="button" className="lm-provider-back" onClick={cancelForm} disabled={Boolean(acting)}><span aria-hidden="true">←</span> 返回 Provider 列表</button></div>
    </form> : viewing ? <section className="lm-provider-detail">
      <ProviderInfo provider={viewing} showProviderStatus showConnection />
      <div className="lm-provider-detail-actions"><button className={viewing.active ? 'disable' : 'enable'} disabled={Boolean(acting)} onClick={() => viewing.active ? deactivate(viewing) : activate(viewing)}>{acting === viewing.id ? <><Spinner /> {viewing.active ? '禁用中…' : '启用中…'}</> : viewing.active ? '禁用' : '启用'}</button><button type="button" disabled={Boolean(acting)} onClick={() => beginEdit(viewing)}>编辑配置</button><button type="button" className="danger" disabled={Boolean(acting)} onClick={() => setConfirming(viewing)}>删除</button><button type="button" className="lm-provider-back" onClick={() => setViewing(null)} disabled={Boolean(acting)}><span aria-hidden="true">←</span> 返回 Provider 列表</button></div>
    </section> : <section className="lm-provider-index">
      <div className="lm-provider-toolbar"><div><b>已保存的 Provider</b><p>同一时间启用一个 Provider。</p></div><button className="primary" type="button" onClick={beginAdd}>添加 Provider</button></div>
      <div className="lm-provider-table-head" aria-hidden="true"><span>Provider</span><span>类型</span><span>状态</span><span>操作</span></div>
      <div className="lm-provider-list">{providers.map((provider) => <article className={provider.active ? 'active' : ''} key={provider.id}>
        <div className="lm-provider-summary"><b>{provider.displayName}</b></div>
        <span className="lm-provider-type">{connectionLabels[provider.connectionType] || '第三方 Provider'}</span>
        <span className={`lm-provider-status ${provider.active ? 'active' : 'inactive'}`}>{provider.active ? '启用' : '禁用'}</span>
        <div className="lm-provider-actions"><button className={provider.active ? 'disable' : 'enable'} disabled={Boolean(acting)} onClick={() => provider.active ? deactivate(provider) : activate(provider)}>{acting === provider.id ? <Spinner /> : provider.active ? '禁用' : '启用'}</button><button disabled={Boolean(acting)} onClick={() => setViewing(provider)}>详情</button></div>
      </article>)}{!providers.length && <div className="lm-provider-empty"><b>还没有 Provider</b><span>添加后即可搜索和播放内容。</span><button className="primary" type="button" onClick={beginAdd}>添加 Provider</button></div>}</div>
      <footer className="lm-provider-footer"><small>连接凭据仅用于认证，并以加密形式保存。</small><a href={PROVIDER_PROTOCOL_DOCS} target="_blank" rel="noreferrer">协议文档 <span aria-hidden="true">↗</span></a></footer>
    </section>}
    <ConfirmDialog open={Boolean(confirming)} title="删除 Provider？" message={confirming ? `“${confirming.displayName}”及其已保存的连接配置将被永久删除，此操作无法撤销。` : ''} confirmLabel="确认删除" tone="error" busy={Boolean(confirming && acting === confirming.id)} onCancel={() => setConfirming(null)} onConfirm={() => confirming && remove(confirming)} />
  </Modal>;
}

function ProviderInfo({ provider, showProviderStatus = false, showConnection = false }) {
  const presentation = provider?.presentation;
  const presentationTitle = presentation?.title || (presentation?.badge?.text ? '服务状态' : '');
  return <section className="lm-provider-info">
    <dl>
      <div><dt>Provider 名称</dt><dd>{provider?.displayName || '未配置'}</dd></div>
      {provider && showProviderStatus && <div><dt>Provider 状态</dt><dd><em className={provider.active ? 'tone-positive' : 'tone-negative'}>{provider.active ? '启用' : '禁用'}</em></dd></div>}
      {provider && <div><dt>Provider 类型</dt><dd>{provider.connectionType === 'official' ? '官方源' : '第三方 Provider'}</dd></div>}
      {provider && showConnection && <div><dt>连接地址</dt><dd title={provider.providerUrl}>{provider.providerUrl}</dd></div>}
      {presentationTitle && <div><dt>{presentationTitle}</dt><dd>{presentation.badge?.text ? <em className={`tone-${presentation.badge.tone || 'neutral'}`}>{presentation.badge.text}</em> : presentation.title}</dd></div>}
      {presentation?.items?.map((item, index) => <div key={`${item.label}:${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
    {presentation?.description && <p>{presentation.description}</p>}
    {presentation?.notice && presentation.notice !== '信息由 Provider 提供' && <small>{presentation.notice}</small>}
  </section>;
}

function PasswordDialog({ close, notify }) {
  const [loading, setLoading] = useState(false); const submit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (form.get('next') !== form.get('confirm')) return notify('两次密码不一致', '请检查确认密码后再提交', 'warning'); setLoading(true); try { await api('auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('current'), password: form.get('next') }) }); close(); notify('修改成功', '密码已更新', 'success'); } catch (error) { notify('修改失败', error.message, 'error'); } finally { setLoading(false); } };
  return <Modal title="修改密码" close={close}><form onSubmit={submit}><PasswordField label="当前密码" name="current" required autoComplete="current-password" autoFocus /><PasswordField label="新密码" name="next" minLength="8" required autoComplete="new-password" /><PasswordField label="确认新密码" name="confirm" minLength="8" required autoComplete="new-password" /><button className="primary" disabled={loading}>{loading ? <><Spinner /> 保存中…</> : '保存修改'}</button></form></Modal>;
}

function QualityDialog({ value, saved, close, notify }) {
  const [selected, setSelected] = useState(value === 'auto' ? '128k' : value || '128k'); const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { const data = await api('preferences', { method: 'PATCH', body: JSON.stringify({ playbackQuality: selected }) }); saved(data.playbackQuality); notify('音质设置已保存', '从下一首歌曲开始生效', 'success'); } catch (error) { notify('保存失败', error.message, 'error'); } finally { setSaving(false); } };
  return <Modal className="lm-quality-modal" title="播放音质" close={close}><form onSubmit={submit}><div className="lm-quality-options">{QUALITY_OPTIONS.map((option) => <label className={selected === option.value ? 'active' : ''} key={option.value}><input type="radio" name="quality" value={option.value} checked={selected === option.value} onChange={() => setSelected(option.value)} /><em className={`lm-quality-mark lm-quality-mark--${option.tone}`} aria-hidden="true">{option.mark}</em><span><b>{option.label}</b><small>{option.note}</small></span><i aria-hidden="true" /></label>)}</div><p className="lm-quality-note">实际可用音质由歌曲和当前 Provider 决定；发生降级时播放器会显示最终档位。</p><button className="primary" disabled={saving}>{saving ? <><Spinner /> 保存中…</> : '保存设置'}</button></form></Modal>;
}

function Announcement({ close, dismissForever }) { return <div className="lm-announcement" role="dialog" aria-modal="true" aria-label="网站公告" onClick={close}><article><span>NOTICE</span><h2>网站公告</h2><p><strong>LURI MUSIC 是一款基于 Web 的可扩展媒体播放客户端。</strong>我们专注于提供内容检索与播放界面、播放列表、本地播放控制、账号服务及 Provider 配置管理，让用户能够连接符合 Music Provider Protocol 的独立内容服务。</p><p><strong>LURI MUSIC 不预置内容源，不实现具体内容源适配，不运营音乐曲库，也不托管、存储、缓存、代理或分发音频文件，所有音频相关信息均由用户自行配置的第三方 Provider 提供。</strong>检索结果、条目信息、播放地址、歌词及封面等数据，均由用户主动选择的 Provider 处理和返回。连接前请核实 Provider 的运营主体、服务条款、隐私政策、数据来源与内容授权范围，并仅访问和使用你依法有权使用的内容。</p><p>Music Provider Protocol 是一套开放的技术接口规范，第三方开发者及用户可以据此接入私有媒体库、授权曲库、开放许可内容、播客或广播目录等服务。<strong>协议兼容仅表示接口格式兼容，不代表 LURI MUSIC 对第三方 Provider 的审核、推荐、授权、合作或担保。</strong>你可以随时停用或删除 Provider 配置；安全问题或权利投诉请联系 <strong>luri@luri.cc.cd</strong>。</p><div className="lm-announcement-actions"><small>点击公告任意位置关闭</small><button type="button" onClick={(event) => { event.stopPropagation(); dismissForever(); }}>不再提示</button></div></article></div>; }
function LegalDocument({ type, close }) { const document = LEGAL_DOCUMENTS[type]; return <Modal className="lm-legal-modal" title={document.title} close={close}><article className="lm-legal"><p className="lm-legal-date">更新日期：2026 年 9 月 22 日 · 版本 {TERMS_VERSION}</p>{document.sections.map(([title, content], index) => <section key={title}><h3>{index + 1}. {title}</h3><p>{renderStrongText(content)}</p>{index === 2 && <a className="lm-protocol-doc-link" href={PROVIDER_PROTOCOL_DOCS} target="_blank" rel="noreferrer">Music Provider Protocol 1.0 接口协议文档 <span aria-hidden="true">↗</span></a>}</section>)}<button className="primary" onClick={close}>我已阅读</button></article></Modal>; }
function Modal({ title, children, close, className = '' }) {
  useEffect(() => () => document.activeElement?.blur?.(), []);
  return <div className={`lm-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}><div><button className="close" onClick={close} aria-label="关闭">×</button><h2>{title}</h2>{children}</div></div>;
}
