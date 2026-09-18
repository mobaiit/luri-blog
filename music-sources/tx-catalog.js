/**
 * TX metadata catalog. This is a Worker-native adaptation of the public
 * search request used by LX Music Desktop (Apache-2.0). It requests JSON
 * metadata only; playback is still resolved separately in the browser.
 */
import CryptoJS from 'crypto-js';

const { EVENT_NAMES, request, on, send } = globalThis.lx;

const PART_1_INDEXES = [23, 14, 6, 36, 16, 40, 7, 19];
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5];
const SCRAMBLE_VALUES = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

const qqSign = (payload) => {
  const hash = CryptoJS.SHA1(JSON.stringify(payload)).toString(CryptoJS.enc.Hex);
  const first = PART_1_INDEXES.map((index) => hash[index]).join('');
  const last = PART_2_INDEXES.map((index) => hash[index]).join('');
  const scrambled = Uint8Array.from(SCRAMBLE_VALUES.map((value, index) => value ^ Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16)));
  const middle = CryptoJS.enc.Base64.stringify(CryptoJS.lib.WordArray.create(scrambled)).replace(/[\\/+=]/g, '');
  return `zzc${first}${middle}${last}`.toLowerCase();
};

const postJson = (url, body) => new Promise((resolve, reject) => {
  request(url, { method: 'POST', timeout: 3000, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'QQMusic 14090508(android 12)' }, body: JSON.stringify(body) }, (error, response) => {
    if (error || response.statusCode < 200 || response.statusCode >= 300) return reject(error || new Error(response.statusMessage));
    try { resolve(typeof response.body === 'string' ? JSON.parse(response.body) : response.body); }
    catch { reject(new Error('TX catalog returned invalid JSON')); }
  });
});

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'tx' || action !== 'search' || !info?.keyword) return undefined;
  const limit = Math.min(Math.max(1, Number(info.limit) || 30), 30);
  const payload = {
    comm: { ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic', phonetype: 'EBG-AN10', deviceScore: '553.47', devicelevel: '50', newdevicelevel: '20', rom: 'HuaWei/EMOTION/EmotionUI_14.2.0', os_ver: '12', OpenUDID: '0', OpenUDID2: '0', QIMEI36: '0', udid: '0', chid: '0', aid: '0', oaid: '0', taid: '0', tid: '0', wid: '0', uid: '0', sid: '0', modeSwitch: '6', teenMode: '0', ui_mode: '2', nettype: '1020', v4ip: '' },
    req: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicMobile', param: { search_type: 0, searchid: Math.random().toString().slice(2), query: info.keyword, page_num: Math.max(1, Number(info.page) || 1), num_per_page: limit, highlight: 0, nqc_flag: 0, multi_zhida: 0, cat: 2, grp: 1, sin: 0, sem: 0 } },
  };
  const url = new URL('https://u.y.qq.com/cgi-bin/musics.fcg');
  url.searchParams.set('sign', qqSign(payload));
  const result = await postJson(url.href, payload);
  if (result?.code !== 0 || result?.req?.code !== 0) throw new Error('TX catalog rejected the query');
  return (result.req.data?.body?.item_song || []).filter((item) => item?.mid).map((item) => ({
    id: String(item.mid), source: 'tx', title: item.title || item.name || '', artist: (item.singer || []).map((singer) => singer.name).filter(Boolean).join(', '), album: item.album?.name || '', duration: Number(item.interval) || 0,
    art: item.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${item.album.mid}.jpg` : '',
    musicInfo: { songmid: item.mid, id: item.id, strMediaMid: item.file?.media_mid || '' },
  })).filter((track) => track.title);
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: { tx: { name: 'TX Catalog', type: 'music', actions: ['search'], qualitys: [] } } });
