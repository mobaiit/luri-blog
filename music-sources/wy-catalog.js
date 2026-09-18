/** Metadata-only WY catalog using the public EAPI search envelope. */
import CryptoJS from 'crypto-js';

const { EVENT_NAMES, request, on, send } = globalThis.lx;
const EAPI_KEY = CryptoJS.enc.Utf8.parse('e82ckenh8dichen8');

const eapiParams = (path, data) => {
  const text = JSON.stringify(data);
  const digest = CryptoJS.MD5(`nobody${path}use${text}md5forencrypt`).toString(CryptoJS.enc.Hex);
  const plaintext = `${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  return CryptoJS.AES.encrypt(plaintext, EAPI_KEY, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }).ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();
};

const postForm = (url, params) => new Promise((resolve, reject) => {
  request(url, { method: 'POST', timeout: 3000, headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://music.163.com', 'User-Agent': 'Mozilla/5.0' }, body: new URLSearchParams(params).toString() }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    try { resolve(typeof response.body === 'string' ? JSON.parse(response.body) : response.body); }
    catch { reject(new Error('WY catalog returned invalid JSON')); }
  });
});

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'wy' || action !== 'search' || !info?.keyword) return undefined;
  const limit = Math.min(Math.max(1, Number(info.limit) || 30), 30);
  const path = '/api/search/song/list/page';
  const result = await postForm('https://interface.music.163.com/eapi/batch', { params: eapiParams(path, { keyword: info.keyword, needCorrect: '1', channel: 'typing', offset: limit * (Math.max(1, Number(info.page) || 1) - 1), scene: 'normal', total: true, limit }) });
  if (result?.code !== 200) throw new Error('WY catalog rejected the query');
  return (result.data?.resources || []).map((resource) => resource?.baseInfo?.simpleSongData).filter((item) => item?.id).map((item) => ({
    id: String(item.id), source: 'wy', title: item.name || '', artist: (item.ar || []).map((artist) => artist.name).filter(Boolean).join(', '), album: item.al?.name || '', duration: Math.round((Number(item.dt) || 0) / 1000), art: (item.al?.picUrl || '').replace(/^http:/, 'https:'),
    musicInfo: { songmid: item.id, id: item.id },
  })).filter((track) => track.title);
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { wy: { name: 'WY Catalog', type: 'music', actions: ['search'], qualitys: [] } } });
