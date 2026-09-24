import { Link } from 'react-router-dom';
import './Docs.css';

const manifestExample = `{
  "protocol": "music-provider",
  "protocolVersion": "1.0",
  "provider": {
    "id": "example-library",
    "name": "Example Library",
    "homepage": "https://provider.example.com"
  },
  "authentication": {
    "types": ["none", "api_key", "activation_code", "bearer_token"],
    "apiKey": { "header": "X-API-Key", "prefix": "" },
    "accessTokenSeconds": 900
  },
  "capabilities": ["search", "random", "charts", "lyrics", "artwork", "playback", "qualities"],
  "playback": {
    "mode": "direct",
    "qualities": ["128k", "192k", "320k", "flac", "flac24bit"]
  },
  "endpoints": {
    "terms": "https://provider.example.com/terms",
    "privacy": "https://provider.example.com/privacy",
    "activate": "https://provider.example.com/v1/auth/activate",
    "refresh": "https://provider.example.com/v1/auth/refresh",
    "revoke": "https://provider.example.com/v1/auth/revoke",
    "account": "https://provider.example.com/v1/account",
    "search": "https://provider.example.com/v1/catalog/search",
    "random": "https://provider.example.com/v1/catalog/random",
    "charts": "https://provider.example.com/v1/catalog/charts",
    "resolve": "https://provider.example.com/v1/tracks/resolve",
    "lyrics": "https://provider.example.com/v1/tracks/{songId}/lyrics",
    "artwork": "https://provider.example.com/v1/tracks/{songId}/artwork"
  }
}`;

const trackExample = `{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "title": "Track title",
  "artist": "Artist",
  "album": "Album",
  "duration": 238,
  "art": "https://provider.example.com/artwork/track-001",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": "https://provider.example.com/artwork/track-001"
  }
}`;

const resolveRequest = `POST /v1/tracks/resolve
Content-Type: application/json

{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "title": "Track title",
  "artist": "Artist",
  "album": "Album",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": "https://provider.example.com/artwork/track-001"
  },
  "quality": "320k",
  "refresh": false
}`;

const resolveResponse = `{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "url": "https://media.example.com/audio/temporary.mp3",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": "https://provider.example.com/artwork/track-001"
  },
  "requestedQuality": "320k",
  "quality": "320k",
  "bitrate": 320,
  "degraded": false,
  "qualityVerified": true,
  "expiresIn": 60,
  "expiresAt": "2026-09-24T12:01:00.000Z"
}`;

const emptyResolveResponse = `{
  "songId": "2725dfd72d4bdd075e2ddaebc49c7224",
  "url": "",
  "binding": {
    "source": "example",
    "sourceId": "track-001",
    "meta": {},
    "art": ""
  },
  "expiresIn": 0
}`;

const resourceRequestExample = `const context = {
  title: track.title,
  artist: track.artist,
  album: track.album, // 未知时仍传 ""
  binding: JSON.stringify(track.binding)
};

const query = new URLSearchParams(context);
const lyrics = await fetch(
  \`/v1/tracks/\${encodeURIComponent(track.songId)}/lyrics?\${query}\`
);
const artwork = await fetch(
  \`/v1/tracks/\${encodeURIComponent(track.songId)}/artwork?\${query}\`
);`;

const nav = [
  ['start', '快速开始', 'user'],
  ['connections', '连接方式', 'user'],
  ['data', '数据与切换', 'user'],
  ['troubleshooting', '常见问题', 'user'],
  ['protocol', '协议概览', 'developer'],
  ['discovery', '服务发现', 'developer'],
  ['authentication', '认证协议', 'developer'],
  ['track-model', 'Track 与 Binding', 'developer'],
  ['catalog', '目录接口', 'developer'],
  ['resources', '单曲接口', 'developer'],
  ['methods', 'HTTP 与跨域', 'developer'],
  ['errors', '错误规范', 'developer'],
  ['security', '安全与合规', 'developer'],
];

function Code({ children }) {
  return <pre className="docs-code"><code>{children}</code></pre>;
}

function Endpoint({ method, path, children }) {
  return <article className="docs-endpoint"><header><b>{method}</b><code>{path}</code></header><p>{children}</p></article>;
}

function SchemaTable({ title, rows }) {
  return <div className="docs-schema-wrap">{title && <h4>{title}</h4>}<div className="docs-schema"><div className="docs-schema-head"><b>参数</b><b>类型</b><b>必填</b><b>说明</b></div>{rows.map(([name, type, required, description]) => <div key={`${title}:${name}:${required}`}><code>{name}</code><span>{type}</span><span>{required}</span><span>{description}</span></div>)}</div></div>;
}

function SimpleTable({ rows }) {
  return <div className="docs-table">{rows.map(([name, description]) => <div key={name}><b>{name}</b><span>{description}</span></div>)}</div>;
}

function Icon({ id }) {
  return <svg className="docs-icon" aria-hidden="true"><use href={`/icons.svg#${id}`} /></svg>;
}

export default function Docs() {
  return <main className="docs-page">
    <header className="docs-hero">
      <div><span>LURI MUSIC</span><strong>使用与开发文档</strong></div>
      <nav>
        <a href="#start">用户指南</a>
        <a href="#protocol">Provider 协议</a>
        <a href="#resources">接口模型</a>
        <a href="https://github.com/mobaiit/luri-blog" target="_blank" rel="noreferrer" className="docs-github-link"><Icon id="github-icon" /></a>
        <Link to="/music">打开播放器</Link>
      </nav>
    </header>

    <div className="docs-layout">
      <aside className="docs-sidebar">
        <p>播放器用户</p>
        {nav.filter((item) => item[2] === 'user').map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
        <p className="docs-sidebar-group">Provider 开发者</p>
        {nav.filter((item) => item[2] === 'developer').map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
      </aside>

      <article className="docs-content">
        <div className="docs-title"><p>MUSIC PROVIDER PROTOCOL · 1.0</p><h1>LURI MUSIC 文档</h1><span>先帮助用户安全连接音乐服务，再为 Provider 开发者给出可直接实现的协议定义。</span></div>

        <div className="docs-section-label"><span>01</span><b>播放器用户指南</b></div>

        <section id="start">
          <h2>快速开始</h2>
          <p>LURI MUSIC 只是音乐播放器客户端，不预置、托管或代理音乐内容。搜索结果、播放地址、歌词和封面均由用户选择的独立 Provider 提供。</p>
          <ol>
            <li>注册并登录 LURI MUSIC。</li>
            <li>从账户菜单打开“Provider 配置”，点击“添加 Provider”。</li>
            <li>选择连接方式，填写 Provider 根地址和所需凭证。</li>
            <li>点击“验证并添加”。只有发现文件、协议版本、端点和凭证全部验证成功后才会保存。</li>
            <li>启用 Provider，进入播放器使用其已声明的搜索、榜单、播放、歌词和封面能力。</li>
          </ol>
          <div className="docs-note"><b>连接前检查</b><span>请确认 Provider 的运营主体、服务条款、隐私政策和内容授权范围。兼容本协议只代表接口格式正确，不代表 LURI MUSIC 对服务或内容进行审核、推荐或授权。</span></div>
        </section>

        <section id="connections">
          <h2>连接方式</h2>
          <p>同一账号可以保存多个 Provider，但同一时间只启用一个。Provider 地址填写服务根地址，例如 <code>https://provider.example.com</code>，不要填写具体搜索或播放接口。</p>
          <div className="docs-cards">
            <article><i>01</i><h3>官方源</h3><p>连接符合协议的正式 Provider，认证方式以发现文件声明为准。</p><code>none / api_key</code></article>
            <article><i>02</i><h3>HTTPS 私有源</h3><p>连接自建或私有服务，可配置 API Key、Authorization 请求头和前缀。</p><code>none / api_key</code></article>
            <article><i>03</i><h3>激活码</h3><p>使用 Provider 签发的一次性激活码领取独立授权。</p><code>activation_code</code></article>
          </div>
          <p>编辑已有配置时会先验证新地址和凭证，失败不会覆盖原配置。删除配置会永久移除 LURI MUSIC 加密保存的连接凭证；已兑换的激活码不能再次使用。</p>
          <div className="docs-note"><b>凭证安全</b><span>API Key、Authorization 凭证和 refresh token 由 LURI MUSIC 服务端加密保存，不会写入浏览器存储或 Provider URL。</span></div>
        </section>

        <section id="data">
          <h2>数据与 Provider 切换</h2>
          <h3>跨 Provider 歌曲身份</h3>
          <p>收藏使用歌曲原始名称与歌手生成的 <code>songId</code>，不使用某个平台的内部歌曲 ID。因此切换 Provider 后，同一首歌仍保持同一收藏身份；新 Provider 会根据歌曲信息和现有 binding 重新定位自己的播放资源。</p>
          <h3>浏览器数据</h3>
          <p>播放队列、搜索记录、随机历史、榜单缓存和短期资源地址保存在浏览器中，其中播放队列和资源缓存按 Provider 隔离。登录用户的收藏按账号保存，并同步到浏览器供离线展示。</p>
          <h3>播放地址</h3>
          <p>播放 URL 通常有较短有效期。客户端发现地址过期、返回空地址或实际播放失败时，会丢弃旧结果并向当前 Provider 强制刷新一次，不会无限重试。</p>
        </section>

        <section id="troubleshooting">
          <h2>常见问题</h2>
          <SimpleTable rows={[
            ['验证失败', '确认地址是 HTTPS Provider 根地址，发现文件可公开访问，端点与根地址同源，并重新填写认证凭证。'],
            ['没有搜索或榜单', '功能由 Provider 的 capabilities 决定；未声明或未实现的能力不会显示。'],
            ['歌曲无法播放', '空 URL、临时 URL 失效或媒体服务器拒绝访问都会导致失败。客户端会自动强制刷新一次，之后需要用户重新播放。'],
            ['歌词或封面为空', '空内容是合法结果，表示 Provider 本次没有匹配资源，不影响歌曲身份与收藏。'],
            ['Provider 请求超时', '所有 Provider 请求最多等待 30 秒；检查服务和上游状态后重试。'],
            ['切换后收藏不能播放', '收藏身份仍保留，但新 Provider 必须能识别 binding，或根据 title、artist、album 重新检索该歌曲。'],
          ]} />
        </section>

        <div className="docs-section-label"><span>02</span><b>Provider 开发规范</b></div>

        <section id="protocol">
          <h2>协议概览</h2>
          <p>Music Provider Protocol（MPP）是 LURI MUSIC 与独立音乐 Provider 之间的 HTTPS/JSON 协议。客户端不下载或执行 Provider 提供的 JavaScript，只读取发现文件并调用声明的固定端点。</p>
          <ul>
            <li>协议标识固定为 <code>music-provider</code>，当前版本为 <code>1.0</code>。</li>
            <li>发现文件和端点必须使用 HTTPS、保持同源且不得重定向到第三方主机。</li>
            <li>1.x 客户端忽略未知字段；已有字段不能在兼容更新中删除或改变语义。</li>
            <li>Provider 只声明确实实现的能力。协议 1.0 的播放模式为 <code>direct</code>。</li>
            <li>所有 Provider 请求的客户端超时为 30 秒。</li>
          </ul>
        </section>

        <section id="discovery">
          <h2>服务发现</h2>
          <Endpoint method="GET" path="/.well-known/music-provider.json">公开返回 Provider 身份、协议版本、认证方式、能力、播放配置和端点。必须直接返回 HTTP 200 与 application/json。</Endpoint>
          <Code>{manifestExample}</Code>
          <SchemaTable title="发现文件字段" rows={[
            ['protocol', 'string', '是', '固定为 music-provider。'],
            ['protocolVersion', 'string', '是', '当前为 1.0；客户端拒绝不支持的主版本。'],
            ['provider.id', 'string', '是', '全局稳定的 Provider 标识。'],
            ['provider.name', 'string', '是', '面向用户展示的 Provider 名称。'],
            ['provider.homepage', 'HTTPS URL', '否', 'Provider 官网或运营主体页面。'],
            ['authentication.types', 'string[]', '是', 'none、api_key、activation_code、bearer_token 的受支持组合。'],
            ['capabilities', 'string[]', '是', 'search、random、charts、lyrics、artwork、playback、qualities 中已实现的能力。'],
            ['playback.mode', 'direct', '条件', '声明 playback 时必填；resolve 返回浏览器可尝试播放的 URL。'],
            ['playback.qualities', 'string[]', '否', '声明 qualities 时给出可请求的音质标识。'],
            ['endpoints.terms', 'HTTPS URL', '是', '服务条款与内容授权范围。'],
            ['endpoints.privacy', 'HTTPS URL', '是', '隐私政策、运营主体与联系方式。'],
            ['endpoints.search', 'HTTPS URL', '条件', '声明 search 时必填。'],
            ['endpoints.random', 'HTTPS URL', '条件', '声明 random 时必填。'],
            ['endpoints.charts', 'HTTPS URL', '条件', '声明 charts 时必填。'],
            ['endpoints.resolve', 'HTTPS URL', '条件', '声明 playback 时必填。'],
            ['endpoints.lyrics', 'URL template', '条件', '声明 lyrics 时必填，使用 {songId} 占位符。'],
            ['endpoints.artwork', 'URL template', '条件', '声明 artwork 时必填，使用 {songId} 占位符。'],
            ['endpoints.activate', 'HTTPS URL', '条件', '声明 activation_code 时必填。'],
            ['endpoints.refresh', 'HTTPS URL', '条件', '激活码授权需要刷新令牌时必填。'],
            ['endpoints.revoke', 'HTTPS URL', '条件', '激活码授权支持撤销时必填。'],
            ['endpoints.account', 'HTTPS URL', '否', '查询授权状态和有效期。'],
          ]} />
        </section>

        <section id="authentication">
          <h2>认证协议</h2>
          <p><code>none</code> 和 <code>api_key</code> 是直接访问方式；Authorization 作为 API Key 模式下的标准请求头配置。<code>activation_code</code> 用于首次领取授权，领取后内容接口使用短期 <code>bearer_token</code>。Bearer token 不是用户再次填写的连接凭证。</p>
          <Endpoint method="POST" path="/v1/auth/activate">使用一次性激活码和幂等键领取短期 accessToken 与长期 refreshToken。</Endpoint>
          <SchemaTable title="激活请求" rows={[
            ['activationCode', 'string', '是', 'Provider 签发且尚未使用的激活码。'],
            ['idempotencyKey', 'string', '是', '同一次操作重试必须复用，最长 100 字符。'],
            ['clientAccount', 'object', '是', '供 Provider 审计的客户端账号摘要，不是身份凭证。'],
            ['clientAccount.id', 'string', '是', '客户端账号内部标识。'],
            ['clientAccount.name', 'string', '否', '客户端账号显示名称。'],
            ['clientAccount.email', 'string', '是', '客户端账号邮箱。'],
          ]} />
          <SchemaTable title="激活响应" rows={[
            ['accessToken', 'string', '是', '调用内容接口的短期 Bearer token。'],
            ['refreshToken', 'string', '是', '换取新 accessToken 的长期凭证。'],
            ['expiresIn', 'integer', '是', 'accessToken 有效秒数，建议 300–3600。'],
            ['refreshExpiresAt', 'ISO 8601 string', '否', 'refreshToken 或授权到期时间。'],
            ['account', 'object', '否', '授权状态与有效期摘要。'],
          ]} />
          <Endpoint method="POST" path="/v1/auth/refresh">请求体传 refreshToken，返回新的 accessToken 与 expiresIn。</Endpoint>
          <Endpoint method="POST" path="/v1/auth/revoke">撤销当前账号级授权或刷新凭证。</Endpoint>
          <Endpoint method="GET" path="/v1/account">使用当前 accessToken 查询 status 与 expiresAt。</Endpoint>
          <div className="docs-note"><b>激活幂等性</b><span>相同激活码与相同 idempotencyKey 的重试属于同一次操作；已使用激活码配合新的 idempotencyKey 必须返回 409 activation_code_used。</span></div>
        </section>

        <section id="track-model">
          <h2>Track 与 Binding</h2>
          <p>搜索、随机、榜单、收藏和所有单曲接口共享同一个 Track 模型。歌曲身份、可读元数据和上游资源位置必须分开表达。</p>
          <Code>{trackExample}</Code>
          <SchemaTable title="Track" rows={[
            ['songId', 'string', '是', 'MD5(UTF-8(JSON.stringify([title, artist]))) 的 32 位小写十六进制结果。'],
            ['title', 'string', '是', '参与 songId 计算的原始歌曲名称，不得 trim 或归一化。'],
            ['artist', 'string', '是', '参与 songId 计算的原始歌手名称，不得改写顺序或格式。'],
            ['album', 'string', '是', '原始专辑名称；未知时必须传空字符串，不得省略。'],
            ['duration', 'number', '否', '音频时长，单位秒。'],
            ['art', 'HTTPS URL | empty string', '否', '当前可用于展示的封面地址。'],
            ['binding', 'Binding', '是', '上游资源定位信息。Track 顶层不得重复 source 或 sourceId。'],
            ['rank', 'integer', '榜单条件必填', '榜单中的名次，从 1 开始。'],
          ]} />
          <SchemaTable title="Binding" rows={[
            ['source', 'string', '是', '非空的音乐平台或 API 服务标识。'],
            ['sourceId', 'string', '是', 'source 内部的不透明歌曲标识，客户端不得转换格式。'],
            ['meta', 'JSON object', '是', 'Provider 自定义上下文；可以是空对象，不得为数组、标量或 null，协议不单独规定字段大小上限。'],
            ['art', 'string', '是', '可为空的封面资源提示；封面解析失败时可回退使用。'],
          ]} />
          <div className="docs-note"><b>身份与定位</b><span>songId 用于跨 Provider 去重、收藏和缓存；binding 只负责定位某个平台或 API 服务中的资源。binding.art 不参与歌曲身份或 binding 唯一性判断。</span></div>
        </section>

        <section id="catalog">
          <h2>目录接口</h2>
          <Endpoint method="GET" path="/v1/catalog/search?q={keyword}&page={page}&limit={limit}">返回 {`{ tracks, page, hasMore }`}；无结果时 tracks 为空数组。</Endpoint>
          <Endpoint method="GET" path="/v1/catalog/random?limit={limit}&exclude={artists}">返回 {`{ singer?, tracks }`}；exclude 是 URL 编码、逗号分隔的近期艺人列表。</Endpoint>
          <Endpoint method="GET" path="/v1/catalog/charts?platform={platform}&chart={chart}&refresh={refresh}">返回 {`{ platform, chart, title, updatedAt, tracks }`}；refresh=1 表示用户主动刷新。</Endpoint>
          <SchemaTable title="通用目录规则" rows={[
            ['tracks', 'Track[]', '是', '每一项必须符合统一 Track 与 Binding 模型。'],
            ['page', 'integer', '搜索必填', '从 1 开始的实际页码。'],
            ['hasMore', 'boolean', '搜索必填', '是否可以继续请求下一页。'],
            ['updatedAt', 'ISO 8601 string', '榜单必填', '榜单数据的获取或更新时间。'],
            ['refresh', '0 | 1', '请求可选', '为 1 时跳过普通缓存；Provider 可以限制刷新频率。'],
          ]} />
        </section>

        <section id="resources">
          <h2>单曲接口</h2>
          <h3>解析播放资源</h3>
          <Endpoint method="POST" path="/v1/tracks/resolve">接收完整歌曲上下文。Provider 可优先使用 binding，也可按原始 title、artist、album 重新检索并返回新的 binding。</Endpoint>
          <Code>{resolveRequest}</Code>
          <SchemaTable title="resolve 响应" rows={[
            ['songId', 'string', '是', '必须与请求歌曲一致。'],
            ['url', 'HTTPS URL | empty string', '是', '非空时可尝试播放；空字符串表示本次没有取得播放资源。'],
            ['binding', 'Binding', '是', '实际使用或更新后的资源绑定。'],
            ['expiresIn', 'integer', '是', '建议缓存秒数；url 为空时为 0。'],
            ['expiresAt', 'ISO 8601 string', '否', '播放 URL 的绝对到期时间。'],
            ['requestedQuality', 'string', '否', '客户端请求的音质。'],
            ['quality', 'string | null', '否', '实际解析音质。'],
            ['bitrate', 'integer | null', '否', '实际码率，单位 kbps。'],
            ['degraded', 'boolean', '否', '实际音质是否低于首选档位。'],
            ['qualityVerified', 'boolean', '否', '音质是否由上游码率信息确认。'],
          ]} />
          <Code>{resolveResponse}</Code>
          <p>HTTP 200 与空 URL 不是协议错误，客户端只把它解释为“当前不可播放”：</p>
          <Code>{emptyResolveResponse}</Code>
          <div className="docs-retry-flow"><span>首次 resolve</span><i>→</i><span>URL 为空或播放失败</span><i>→</i><span>refresh=true 强制解析一次</span><i>→</i><span>成功播放或结束重试</span></div>

          <h3>歌词与封面</h3>
          <Endpoint method="GET" path="/v1/tracks/{songId}/lyrics?title=&artist=&album=&binding=&refresh=">返回 {`{ songId, lyrics, translation?, binding }`}；没有歌词时 lyrics 为空字符串，外部歌词回退结果的 binding 可以为 null。</Endpoint>
          <Endpoint method="GET" path="/v1/tracks/{songId}/artwork?title=&artist=&album=&binding=&refresh=">返回 {`{ songId, url, binding }`}；没有封面时 url 为空字符串，客户端使用占位图。</Endpoint>
          <SchemaTable title="歌词响应" rows={[
            ['songId', 'string', '是', '对应的稳定歌曲身份。'],
            ['lyrics', 'string', '是', 'LRC 时间轴歌词或纯文本；没有歌词时为空字符串。'],
            ['translation', 'string', '否', '翻译歌词，建议与 lyrics 使用相同时间轴。'],
            ['binding', 'Binding | null', '是', '实际歌词来源；无法绑定到歌曲平台资源的外部回退可以返回 null。'],
          ]} />
          <SchemaTable title="封面响应" rows={[
            ['songId', 'string', '是', '对应的稳定歌曲身份。'],
            ['url', 'HTTPS URL | empty string', '是', '当前封面地址；没有封面时为空字符串。'],
            ['binding', 'Binding', '是', '实际使用或更新后的资源绑定。'],
          ]} />
          <p><code>album</code> 参数即使为空也必须存在；<code>binding</code> 是完整 Binding 的 JSON 字符串。请使用标准 URL 编码：</p>
          <Code>{resourceRequestExample}</Code>
        </section>

        <section id="methods">
          <h2>HTTP 方法与跨域</h2>
          <SimpleTable rows={[
            ['GET', '发现、health、terms、privacy、account、search、random、charts、lyrics、artwork。'],
            ['POST', 'activate、refresh、revoke、resolve。'],
            ['OPTIONS', '仅用于 CORS 预检，不得执行端点业务逻辑。'],
            ['其他方法', '已知端点必须返回 405、Allow 响应头和 method_not_allowed 错误。'],
          ]} />
          <p>浏览器直接访问 Provider。Provider 必须允许已登记的 LURI MUSIC Origin、实际使用的认证请求头以及 GET、POST、OPTIONS。音频和图片资源也应支持 HTTPS、跨域访问；音频地址建议支持 Range 请求。</p>
          <Code>{`Access-Control-Allow-Origin: https://luri.cc.cd
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400`}</Code>
        </section>

        <section id="errors">
          <h2>错误规范</h2>
          <p>失败响应使用合适的 HTTP 状态码和稳定机器代码。空播放 URL、空歌词和空封面是成功响应，不使用错误状态码。</p>
          <Code>{`{
  "error": {
    "code": "invalid_request",
    "message": "Human-readable message"
  }
}`}</Code>
          <SimpleTable rows={[
            ['400', 'invalid_request / invalid_song_id：字段缺失、Binding 不合法或 songId 校验失败。'],
            ['401', 'unauthorized / invalid_grant：凭证无效、过期或已撤销。'],
            ['403', 'forbidden / entitlement_inactive：凭证有效但没有当前权限。'],
            ['404', 'not_found：端点或协议资源不存在。'],
            ['405', 'method_not_allowed：HTTP 方法不符合端点定义，同时返回 Allow。'],
            ['409', 'activation_code_used：激活状态或幂等操作冲突。'],
            ['429', 'rate_limited：请求或强制刷新频率超限。'],
            ['502', 'upstream_unavailable：Provider 上游暂时不可用。'],
            ['504', 'provider_timeout：Provider 请求超过客户端 30 秒期限。'],
          ]} />
        </section>

        <section id="security">
          <h2>安全与合规</h2>
          <ul>
            <li>API Key、Authorization、激活码、access token 和 refresh token 不得出现在 URL 查询参数或日志中。</li>
            <li>refresh token 必须高熵、可撤销、可轮换；数据库只保存其摘要。</li>
            <li>播放 URL 应短期有效，不得暴露上游长期凭证；日志不得记录完整播放 URL。</li>
            <li>发现文件中的端点必须与 Provider 根地址同源，客户端拒绝重定向和带账号密码的 URL。</li>
            <li>Provider 应公开服务条款、隐私政策、运营主体、联系方式和权利投诉渠道。</li>
            <li>只可提供自有、已获授权、开放许可或用户依法有权访问的内容，不得绕过访问控制或数字版权保护措施。</li>
          </ul>
        </section>

        <footer className="docs-footer"><span>Music Provider Protocol 1.0</span><a href="mailto:luri@luri.cc.cd">问题反馈：luri@luri.cc.cd</a></footer>
      </article>

      <aside className="docs-outline"><p>Provider 开发规范</p>{nav.filter((item) => item[2] === 'developer').map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</aside>
    </div>
  </main>;
}
