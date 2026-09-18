const EVENT_NAMES = Object.freeze({ request: 'request', inited: 'inited', updateAlert: 'updateAlert' });

let runtimePromise;

function responseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') || contentType.includes('javascript') ? response.json() : response.text();
}

async function boot() {
  const listeners = new Map();
  const registeredSources = {};

  globalThis.lx = {
    EVENT_NAMES,
    on(eventName, listener) {
      const eventListeners = listeners.get(eventName) || [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    send(eventName, payload) {
      if (eventName === EVENT_NAMES.inited && payload?.sources) Object.assign(registeredSources, payload.sources);
    },
    request(url, options = {}, callback) {
      fetch(url, options)
        .then(async (response) => callback(null, { statusCode: response.status, statusMessage: response.statusText, body: await responseBody(response) }))
        .catch((error) => callback(error));
    },
  };

  // These imports must remain dynamic: source scripts expect globalThis.lx to
  // exist while their module body is evaluated.
  const { sourceLoaders } = await import('../../music-sources/index.js');
  await Promise.all(sourceLoaders.map((load) => load()));

  return {
    registeredSources,
    async invoke({ source, action, info }) {
      const handlers = listeners.get(EVENT_NAMES.request) || [];
      for (const handler of handlers) {
        try {
          const result = await handler({ source, action, info });
          if (result !== undefined && result !== null) return result;
        } catch {
          // Some LX scripts assume every musicUrl request belongs to them.
          // Ignore that script and allow the source owning this request to run.
        }
      }
      return null;
    },
    async search(keyword) {
      const searchableSources = Object.entries(registeredSources)
        .filter(([, definition]) => definition?.actions?.includes('search'))
        .map(([source]) => source);
      const results = await Promise.allSettled(searchableSources.map(async (source) => {
        const result = await this.invoke({ source, action: 'search', info: { keyword, key: keyword, searchKey: keyword, page: 1, limit: 30 } });
        const tracks = Array.isArray(result) ? result : result?.tracks || result?.data || result?.list || [];
        return tracks.map((track) => ({ ...track, source: track.source || source }));
      }));
      return results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        console.error(`Music source search failed: ${searchableSources[index]}`, result.reason);
        return [];
      });
    },
  };
}

export function getMusicRuntime() {
  runtimePromise ||= boot();
  return runtimePromise;
}
