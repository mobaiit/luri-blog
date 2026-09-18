import CryptoJS from 'crypto-js';

const EVENT_NAMES = Object.freeze({ request: 'request', inited: 'inited', updateAlert: 'updateAlert' });
const SCRIPT_VERSION = '1.0.0';
let runtimePromise;

function responseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') || contentType.includes('javascript') ? response.json() : response.text();
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

function toBytes(value, encoding = 'utf8') {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  const source = String(value ?? '');
  if (encoding === 'hex') return Uint8Array.from(source.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
  if (encoding === 'base64') {
    const parsed = CryptoJS.enc.Base64.parse(source);
    return Uint8Array.from(CryptoJS.enc.Hex.stringify(parsed).match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
  }
  return new TextEncoder().encode(source);
}

const wordArray = (bytes) => CryptoJS.lib.WordArray.create(bytes);

function createUtils() {
  return {
    crypto: {
      aesEncrypt(input, mode, key, iv) {
        const cipher = /^aes-(\d+)-cbc$/i.exec(mode || '');
        if (!cipher) throw new Error(`Unsupported AES mode: ${mode}`);
        const keyBytes = toBytes(key);
        if (keyBytes.byteLength !== Number(cipher[1]) / 8) throw new Error(`Invalid AES key length for ${mode}`);
        const encrypted = CryptoJS.AES.encrypt(wordArray(toBytes(input)), wordArray(keyBytes), { iv: wordArray(toBytes(iv)), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
        return toBytes(CryptoJS.enc.Hex.stringify(encrypted.ciphertext), 'hex');
      },
      md5(value) { return CryptoJS.MD5(String(value)).toString(CryptoJS.enc.Hex); },
      randomBytes(size) { return crypto.getRandomValues(new Uint8Array(size)); },
      // The desktop host provides synchronous OpenSSL RSA. Workers cannot do
      // that synchronously, so fail clearly rather than send a bad signature.
      rsaEncrypt() { throw new Error('rsaEncrypt is not available in the Worker runtime'); },
    },
    buffer: {
      from(value, encoding) { return toBytes(value, encoding); },
      bufToString(value, format = 'utf8') {
        const bytes = toBytes(value); const data = wordArray(bytes);
        if (format === 'base64') return CryptoJS.enc.Base64.stringify(data);
        if (format === 'hex') return CryptoJS.enc.Hex.stringify(data);
        if (format === 'binary') return CryptoJS.enc.Latin1.stringify(data);
        return new TextDecoder().decode(bytes);
      },
    },
  };
}

async function boot() {
  const listeners = new Map(); const registeredSources = {}; const sourceHandlers = new Map(); const searchCooldowns = new Map(); const loadResults = []; const utils = createUtils();
  const createHost = (scriptInfo) => ({
    EVENT_NAMES, env: 'worker', version: SCRIPT_VERSION, currentScriptInfo: scriptInfo, utils,
    on(eventName, listener) {
      const eventListeners = listeners.get(eventName) || [];
      eventListeners.push({ listener, script: scriptInfo.name }); listeners.set(eventName, eventListeners);
    },
    send(eventName, payload) {
      if (eventName !== EVENT_NAMES.inited || !payload?.sources) return;
      for (const [source, definition] of Object.entries(payload.sources)) {
        const disabledActions = scriptInfo.disabledActions?.[source] || [];
        const actions = (definition.actions || []).filter((action) => !disabledActions.includes(action));
        if (!actions.length) continue;
        const previous = registeredSources[source] || {};
        registeredSources[source] = {
          ...previous,
          ...definition,
          actions: [...new Set([...(previous.actions || []), ...actions])],
          qualitys: [...new Set([...(previous.qualitys || []), ...(definition.qualitys || [])])],
        };
        const handlers = sourceHandlers.get(source) || new Map();
        for (const action of actions) handlers.set(action, scriptInfo.name);
        sourceHandlers.set(source, handlers);
      }
    },
    request(url, options = {}, callback) {
      const controller = new AbortController();
      const timeout = Math.min(Math.max(Number(options.timeout) || 6000, 1), 10000);
      const timer = setTimeout(() => controller.abort('Music source request timed out'), timeout);
      fetch(url, { ...options, signal: controller.signal }).then(async (response) => {
        clearTimeout(timer);
        callback(null, { statusCode: response.status, statusMessage: response.statusText, body: await responseBody(response) });
      }).catch((error) => { clearTimeout(timer); callback(error); });
    },
  });
  globalThis.lx = createHost({ name: 'luri-worker', version: SCRIPT_VERSION, rawScript: '' });

  const { sourceLoaders } = await import('../../music-sources/index.js');
  for (const source of sourceLoaders) {
    globalThis.lx = createHost({ name: source.name, version: source.version || 'unknown', disabledActions: source.disabledActions, rawScript: '' });
    try { await source.load(); loadResults.push({ name: source.name, status: 'loaded' }); }
    catch (error) { loadResults.push({ name: source.name, status: 'failed', error: error instanceof Error ? error.message : String(error) }); }
  }

  return {
    registeredSources,
    status() {
      return {
        scripts: loadResults,
        sources: Object.keys(registeredSources),
        handlers: Object.fromEntries([...sourceHandlers].map(([source, handlers]) => [source, Object.fromEntries(handlers)])),
      };
    },
    async invoke({ source, action, info }) {
      const owner = sourceHandlers.get(source)?.get(action);
      for (const handler of listeners.get(EVENT_NAMES.request) || []) {
        if (owner && handler.script !== owner) continue;
        try { const result = await handler.listener({ source, action, info }); if (result !== undefined && result !== null) return result; }
        catch { /* Try the next registered handler for this source. */ }
      }
      return null;
    },
    async search(keyword, page = 1) {
      const now = Date.now();
      const searchableSources = Object.entries(registeredSources).filter(([source, definition]) => definition?.actions?.includes('search') && (searchCooldowns.get(source) || 0) <= now).map(([source]) => source);
      const results = await Promise.allSettled(searchableSources.map(async (source) => {
        const result = await withTimeout(this.invoke({ source, action: 'search', info: { keyword, key: keyword, searchKey: keyword, page: Math.max(1, Number(page) || 1), limit: 30 } }), 1200, `${source} search timed out`);
        const tracks = Array.isArray(result) ? result : result?.tracks || result?.data || result?.list || [];
        return tracks.map((track) => ({ ...track, source: track.source || source }));
      }));
      return results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        searchCooldowns.set(searchableSources[index], Date.now() + 300000);
        return [];
      });
    },
  };
}

export function getMusicRuntime() { runtimePromise ||= boot(); return runtimePromise; }
