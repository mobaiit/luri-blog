import { useCallback, useEffect, useState } from 'react';
import Turnstile from './Turnstile';
import { LoadingScreen, Spinner, Toast } from './UiFeedback';
import './admin-netease.css';
import './admin-ux.css';
import './ui-feedback.css';

const api = async (path, options = {}) => { const response = await fetch(`/api/luri-music/${path}`, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || '请求失败，请稍后重试'); return data; };
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN') : '—';

export default function Admin() {
  const [booting, setBooting] = useState(true); const [authenticated, setAuthenticated] = useState(false); const [page, setPage] = useState('generate'); const [turnstile, setTurnstile] = useState({ enabled: false, siteKey: '' }); const [toast, setToast] = useState(null);
  const notify = useCallback((title, message = '', type = 'info') => setToast({ title, message, type }), []);
  useEffect(() => { Promise.all([api('auth/me'), api('admin/list').then(() => true).catch(() => false)]).then(([me, signedIn]) => { setTurnstile(me.turnstile || { enabled: false, siteKey: '' }); setAuthenticated(signedIn); }).catch((error) => notify('加载失败', error.message, 'error')).finally(() => setBooting(false)); }, [notify]);
  if (booting) return <LoadingScreen label="正在加载管理后台…" />;
  if (!authenticated) return <><AdminLogin turnstile={turnstile} done={() => setAuthenticated(true)} notify={notify} /><Toast toast={toast} onClose={() => setToast(null)} /></>;
  const logout = async () => { try { await api('admin/logout', { method: 'POST' }); setAuthenticated(false); notify('已退出登录', '', 'success'); } catch (error) { notify('退出失败', error.message, 'error'); } };
  return <main className="admin-page"><aside><a href="/admin">LURI ADMIN</a><button className={page === 'generate' ? 'active' : ''} onClick={() => setPage('generate')}>兑换码生成</button><button className={page === 'records' ? 'active' : ''} onClick={() => setPage('records')}>兑换码记录</button><button className={page === 'password' ? 'active' : ''} onClick={() => setPage('password')}>修改密码</button><button onClick={logout}>退出登录</button></aside><section className="admin-content"><header><span>LURI ADMIN</span></header>{page === 'generate' && <Generate notify={notify} />}{page === 'records' && <Records notify={notify} />}{page === 'password' && <AdminPassword notify={notify} />}</section><Toast toast={toast} onClose={() => setToast(null)} /></main>;
}

function AdminLogin({ turnstile, done, notify }) {
  const [password, setPassword] = useState(''); const [token, setToken] = useState(''); const [reset, setReset] = useState(0); const [loading, setLoading] = useState(false);
  const resetTurnstile = useCallback(() => { setToken(''); setReset((value) => value + 1); }, []);
  const submit = async (event) => { event.preventDefault(); if (turnstile.enabled && !token) return notify('请先完成人机验证', '请完成下方的 Turnstile 验证后再尝试', 'error'); setLoading(true); try { await api('admin/login', { method: 'POST', body: JSON.stringify({ password, turnstileToken: token }) }); notify('登录成功', '', 'success'); done(); } catch (error) { notify('登录失败', error.message, 'error'); resetTurnstile(); } finally { setLoading(false); } };
  return <main className="admin-login"><form onSubmit={submit}><p>后台管理端</p><h1>LURI ADMIN</h1><label>账号<input value="管理员" readOnly /></label><label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required /></label>{turnstile.enabled && <Turnstile siteKey={turnstile.siteKey} onVerify={setToken} onExpire={resetTurnstile} resetSignal={reset} />}<button disabled={loading || (turnstile.enabled && !token)}>{loading ? <><Spinner /> 登录中…</> : '登录'}</button></form></main>;
}

function Generate({ notify }) {
  const [type, setType] = useState('day'); const [codes, setCodes] = useState([]); const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); try { const data = await api('admin/codes', { method: 'POST', body: JSON.stringify({ durationType: type, durationValue: form.get('value'), count: form.get('count'), validDays: form.get('valid'), note: form.get('note') }) }); setCodes(data.codes); notify('生成成功', `已生成 ${data.codes.length} 个兑换码`, 'success'); } catch (error) { notify('生成失败', error.message, 'error'); } finally { setLoading(false); } };
  const copyAll = async () => { try { await navigator.clipboard.writeText(codes.join('\n')); notify('复制成功', '兑换码已全部复制', 'success'); } catch { notify('复制失败', '请检查浏览器剪贴板权限', 'error'); } };
  return <section><h1>兑换码生成</h1><form className="admin-form" onSubmit={submit}><label>有效期类型<div className="segments">{[['day', '天'], ['month', '月'], ['year', '年']].map(([value, label]) => <button type="button" className={type === value ? 'selected' : ''} onClick={() => setType(value)} key={value}>{label}</button>)}</div></label><label>有效期数值<input name="value" type="number" min="1" defaultValue="30" required /></label><label>生成数量<input name="count" type="number" min="1" max="100" defaultValue="1" required /></label><label>兑换截止天数<input name="valid" type="number" min="1" defaultValue="30" required /></label><label>备注<input name="note" maxLength="120" /></label><button className="primary" disabled={loading}>{loading ? <><Spinner /> 生成中…</> : '生成兑换码'}</button></form>{codes.length > 0 && <div className="code-result">{codes.map((code) => <code key={code}>{code}</code>)}<button onClick={copyAll}>复制全部兑换码</button></div>}</section>;
}

function Records({ notify }) {
  const [data, setData] = useState(null); const [status, setStatus] = useState(''); const [email, setEmail] = useState(''); const [page, setPage] = useState(1); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setData(await api(`admin/list?status=${encodeURIComponent(status)}&email=${encodeURIComponent(email)}&page=${page}`)); } catch (error) { notify('记录加载失败', error.message, 'error'); } finally { setLoading(false); } }, [status, email, page, notify]);
  useEffect(() => { load(); }, [load]);
  const copy = async (code) => { if (!code) return notify('无法复制', '历史兑换码未保存明文', 'error'); try { await navigator.clipboard.writeText(code); notify('复制成功', code, 'success'); } catch { notify('复制失败', '请检查浏览器剪贴板权限', 'error'); } };
  const revoke = async (id) => { try { await api('admin/revoke', { method: 'POST', body: JSON.stringify({ id }) }); notify('已作废', '该兑换码将无法继续使用', 'success'); load(); } catch (error) { notify('作废失败', error.message, 'error'); } };
  return <section><h1>兑换码记录</h1><div className="filters"><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">全部状态</option><option>未使用</option><option>已使用</option><option>已过期</option><option>已作废</option></select><input value={email} onChange={(event) => { setEmail(event.target.value); setPage(1); }} placeholder="兑换者邮箱" /><button onClick={load} disabled={loading}>{loading ? <Spinner /> : '查询'}</button></div>{loading && !data ? <div className="admin-inline-loading"><Spinner /><span>加载中…</span></div> : <><div className="record-table"><div className="tr head"><span>兑换码</span><span>有效期</span><span>状态</span><span>兑换者</span><span>兑换时间</span><span>操作</span></div>{data?.items.length ? data.items.map((code) => <div className="tr" key={code.id}><code>{code.code_display || '历史兑换码'}</code><span>{code.durationLabel}</span><b className={`tag ${code.status}`}>{code.status}</b><span>{code.email || '—'}</span><span>{formatDate(code.redeemed_at)}</span><span className="row-actions"><button onClick={() => copy(code.code_display)}>复制</button>{code.status === '未使用' && <button onClick={() => revoke(code.id)}>作废</button>}</span></div>) : <div className="admin-empty">暂无数据</div>}</div><div className="pager"><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页 / 共 {Math.max(1, Math.ceil((data?.total || 0) / (data?.size || 20)))} 页</span><button disabled={loading || page * (data?.size || 20) >= (data?.total || 0)} onClick={() => setPage(page + 1)}>下一页</button></div></>}</section>;
}

function AdminPassword({ notify }) {
  const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (form.get('next') !== form.get('confirm')) return notify('无法修改密码', '两次输入的新密码不一致', 'error'); setLoading(true); try { await api('admin/password', { method: 'POST', body: JSON.stringify({ currentPassword: form.get('current'), newPassword: form.get('next') }) }); event.currentTarget.reset(); notify('修改成功', '管理员密码已更新', 'success'); } catch (error) { notify('修改失败', error.message, 'error'); } finally { setLoading(false); } };
  return <section><h1>修改密码</h1><form className="admin-form" onSubmit={submit}><label>当前密码<input name="current" type="password" autoComplete="current-password" required /></label><label>新密码<input name="next" type="password" minLength="8" autoComplete="new-password" required /></label><label>确认新密码<input name="confirm" type="password" minLength="8" autoComplete="new-password" required /></label><button className="primary" disabled={loading}>{loading ? <><Spinner /> 保存中…</> : '保存修改'}</button></form></section>;
}
