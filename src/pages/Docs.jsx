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
  "capabilities": ["search", "random", "lyrics", "artwork", "playback"],
  "playback": { "mode": "direct", "qualities": ["128k", "192k", "320k", "flac", "flac24bit"] },
  "endpoints": {
    "activate": "https://provider.example.com/v1/auth/activate",
    "refresh": "https://provider.example.com/v1/auth/refresh",
    "account": "https://provider.example.com/v1/account",
    "search": "https://provider.example.com/v1/catalog/search",
    "random": "https://provider.example.com/v1/catalog/random",
    "resolve": "https://provider.example.com/v1/tracks/resolve",
    "lyrics": "https://provider.example.com/v1/tracks/{id}/lyrics",
    "artwork": "https://provider.example.com/v1/tracks/{id}/artwork"
  }
}`;

const trackExample = `{
  "tracks": [{
    "id": "track-001",
    "title": "Track title",
    "artist": "Artist",
    "album": "Album",
    "duration": 238,
    "art": "https://provider.example.com/artwork/track-001"
  }],
  "page": 1,
  "hasMore": false
}`;

const nav = [
  ['start', '快速开始'],
  ['provider-types', '连接方式'],
  ['usage', '使用说明'],
  ['protocol', '协议概览'],
  ['discovery', '服务发现'],
  ['authentication', '认证协议'],
  ['api', '接口文档'],
  ['security', '安全与合规'],
  ['errors', '错误规范'],
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

export default function Docs() {
  return <main className="docs-page">
    <header className="docs-hero">
      <div><span>LURI MUSIC</span><strong>开发者文档</strong></div>
      <nav><a href="#start">使用指南</a><a href="#protocol">协议文档</a><a href="#api">接口文档</a><Link to="/music">打开播放器</Link></nav>
    </header>
    <div className="docs-layout">
      <aside className="docs-sidebar"><p>文档导航</p>{nav.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</aside>
      <article className="docs-content">
        <div className="docs-title"><p>MUSIC PROVIDER PROTOCOL · 1.0</p><h1>LURI MUSIC 文档</h1><span>面向播放器用户、Provider 服务运营者和第三方开发者的接入说明。</span></div>

        <section id="start"><h2>快速开始</h2><p>LURI MUSIC 是音乐播放器客户端，不预置内容源。播放器通过开放的 Music Provider Protocol（MPP）连接由用户选择的独立服务。Provider 可以是个人私有音乐库、机构授权曲库、播客或广播目录，也可以是开发测试服务。</p><ol><li>注册并登录 LURI MUSIC。</li><li>打开右上角账户菜单，进入“Provider 配置”。</li><li>选择官方源、HTTPS 私有源或激活码，并填写 Provider 地址及所需凭证。</li><li>验证成功后启用该 Provider，即可使用其声明的搜索、播放、歌词等能力。</li></ol><div className="docs-note"><b>连接前检查</b><span>请确认 Provider 的运营主体、服务条款、隐私政策及内容授权范围。协议兼容只表示技术格式兼容，不代表 LURI MUSIC 的审核或推荐。</span></div></section>

        <section id="provider-types"><h2>连接方式</h2><p>同一账号可保存多个 Provider，但同一时间只启用一个。官方源和 HTTPS 私有源可选择无认证、API Key 或 Authorization，激活码放在最后作为独立授权入口。</p><div className="docs-cards"><article><i>01</i><h3>官方源</h3><p>连接符合协议的正式 Provider 服务，可按其声明选择认证参数。</p><code>none / api_key</code></article><article><i>02</i><h3>HTTPS 私有源</h3><p>连接自建或私有 HTTPS Provider，可自定义认证请求头和前缀。</p><code>none / api_key</code></article><article><i>03</i><h3>激活码</h3><p>使用 Provider 签发的一次性凭证领取独立授权。</p><code>activation_code</code></article></div><div className="docs-note"><b>凭证安全</b><span>API Key、Authorization 凭证和 refresh token 均由 LURI MUSIC 服务端加密保存，不会写入浏览器存储或 URL。</span></div></section>

        <section id="usage"><h2>使用说明</h2><h3>添加、编辑与切换</h3><p>Provider 地址应填写服务根地址，例如 <code>https://provider.example.com</code>。客户端会读取标准发现文件并核对协议版本、认证能力及接口地址。编辑配置时会先验证新地址和凭证，验证失败不会覆盖原配置。</p><h3>搜索与播放</h3><p>搜索、随机发现、歌曲详情、播放地址、歌词和封面均由当前 Provider 按其能力声明返回。播放列表和播放状态保存在浏览器中；切换 Provider 后，客户端会使用独立的存储命名空间，避免不同服务的数据混淆。</p><h3>删除配置</h3><p>删除操作会移除 LURI MUSIC 加密保存的连接凭证。已使用的激活码不能再次兑换，删除后无法通过原激活码恢复。</p></section>

        <section id="protocol"><h2>协议概览</h2><p>Music Provider Protocol 是基于 HTTPS 与 JSON 的开放接口约定。客户端不会下载或执行 Provider 提供的远程 JavaScript，所有能力通过声明式清单和固定 HTTP 接口完成。</p><ul><li>协议标识固定为 <code>music-provider</code>。</li><li>1.x 客户端忽略未知字段，兼容新增的可选能力。</li><li>发现文件和所有接口必须使用 HTTPS 且保持同源。</li><li>Provider 应仅声明自己确实实现的能力与端点。</li></ul></section>

        <section id="discovery"><h2>服务发现</h2><p>Provider 必须在服务根地址提供公开发现文件。响应状态应为 <code>200</code>，内容类型应为 <code>application/json</code>，且不得通过 3xx 重定向返回。</p><Endpoint method="GET" path="/.well-known/music-provider.json">返回 Provider 身份、协议版本、认证方式、能力声明、播放配置和各功能端点。</Endpoint><Code>{manifestExample}</Code><SchemaTable title="发现文件字段" rows={[
          ['protocol', 'string', '是', '协议标识，固定为 music-provider。'],
          ['protocolVersion', 'string', '是', '协议版本；当前客户端接受 1.x，例如 1.0。'],
          ['provider', 'object', '是', 'Provider 的公开身份信息。'],
          ['provider.id', 'string', '是', '全局稳定且不可随意变更的 Provider 标识。'],
          ['provider.name', 'string', '建议', '展示名称；用户未自定义名称时作为默认名称。'],
          ['provider.homepage', 'HTTPS URL', '否', 'Provider 官网、服务说明或运营主体页面。'],
          ['authentication.types', 'string[]', '是', '声明 none、api_key、activation_code 中至少一种；激活码内容接口使用 bearer_token。'],
          ['authentication.accessTokenSeconds', 'integer', '否', '建议的短期访问令牌有效秒数。'],
          ['capabilities', 'string[]', '建议', '已实现能力：search、random、lyrics、artwork、playback。'],
          ['playback.mode', 'string', '建议', '播放交付方式；当前支持 direct，即 resolve 返回可播放 URL。'],
          ['playback.qualities', 'string[]', '否', '支持的音质标识，例如 128k、320k、lossless。'],
          ['endpoints', 'object', '是', '接口地址集合；所有地址须与 Provider 根地址同源并使用 HTTPS。'],
          ['endpoints.terms', 'HTTPS URL', '是', 'Provider 服务条款及内容授权范围说明。'],
          ['endpoints.privacy', 'HTTPS URL', '是', 'Provider 隐私政策、运营主体及联系方式说明。'],
          ['endpoints.search', 'HTTPS URL', '是', '搜索接口地址。'],
          ['endpoints.resolve', 'HTTPS URL', '是', '播放地址解析接口。'],
          ['endpoints.random', 'HTTPS URL', '否', '随机发现接口；声明 random 能力时应提供。'],
          ['endpoints.lyrics', 'URL template', '否', '歌词接口，以 {id} 表示曲目标识。'],
          ['endpoints.artwork', 'URL template', '否', '封面接口，以 {id} 表示曲目标识。'],
          ['endpoints.activate', 'HTTPS URL', '条件', '使用 activation_code 时必填的激活码兑换接口。'],
          ['endpoints.refresh', 'HTTPS URL', '条件', '使用 activation_code 时必填的访问令牌刷新接口。'],
          ['endpoints.account', 'HTTPS URL', '否', '授权状态、有效期与额度查询接口。'],
        ]} /><div className="docs-note"><b>地址校验规则</b><span>发现文件及所有端点必须使用 HTTPS、与填写的 Provider 地址保持同源，并直接返回最终响应。端点模板中仅使用文档约定的占位符。</span></div></section>

        <section id="authentication"><h2>认证协议</h2><p>Provider 可声明无认证、API Key 或激活码。API Key 模式支持自定义安全请求头和前缀；Authorization 使用 <code>Authorization</code> 请求头，默认前缀为 <code>Bearer </code>。凭证不得放入 URL。</p><h3>激活码模式</h3><Endpoint method="POST" path="/v1/auth/activate">使用一次性激活码领取独立授权，并换取短期访问令牌和长期刷新令牌。</Endpoint><SchemaTable title="请求体 · application/json" rows={[
          ['activationCode', 'string', '是', 'Provider 签发的未使用激活码；前后空白会被移除。'],
          ['idempotencyKey', 'string', '是', '本次激活操作的唯一键；同一请求重试必须复用，最长 100 字符。'],
          ['clientAccount', 'object', '是', '客户端账号摘要，仅供 Provider 后台展示和审计。'],
          ['clientAccount.id', 'string', '是', '客户端账号内部标识，最长 100 字符。'],
          ['clientAccount.name', 'string', '否', '客户端账号显示名称，最长 80 字符。'],
          ['clientAccount.email', 'string', '是', '客户端账号邮箱，最长 160 字符。'],
        ]} /><SchemaTable title="成功响应 · 200" rows={[
          ['accessToken', 'string', '是', '调用 Provider 内容与账号接口的短期令牌。'],
          ['refreshToken', 'string', '是', '换取新 accessToken 的长期凭证；必须支持撤销。'],
          ['expiresIn', 'integer', '是', 'accessToken 从签发起的有效秒数，建议 300–3600。'],
          ['account', 'object', '建议', 'Provider 账号当前状态和有效期摘要。'],
        ]} /><Endpoint method="POST" path="/v1/auth/refresh">使用 refreshToken 签发新的短期访问令牌；刷新失败应返回 401。</Endpoint><SchemaTable title="刷新请求与响应" rows={[
          ['refreshToken', 'string', '请求必填', 'activate 返回的长期刷新令牌。'],
          ['accessToken', 'string', '响应必填', '新签发的短期访问令牌。'],
          ['expiresIn', 'integer', '响应必填', '新 accessToken 的有效秒数。'],
        ]} /><Endpoint method="GET" path="/v1/account">使用当前访问令牌查询 Provider 账号状态。</Endpoint><SchemaTable title="账号响应" rows={[
          ['status', 'string', '建议', '账号状态，推荐 active、inactive、suspended。'],
          ['expiresAt', 'ISO 8601 string | null', '否', '服务有效期的 UTC 时间；永久有效可返回 null 或省略。'],
          ['plan', 'string', '否', '套餐或服务等级的展示名称。'],
          ['quota', 'object | number | null', '否', '额度摘要，具体字段由 Provider 在自身文档中说明。'],
        ]} /><div className="docs-note"><b>幂等规则</b><span>同一激活码与同一 idempotencyKey 重试时，Provider 应视为同一次操作并重新签发凭证；已使用激活码配合新的 idempotencyKey 必须返回 409 activation_code_used。</span></div><p><code>clientAccount</code> 是客户端声明的信息，不构成 Provider 对用户身份的独立证明。Provider 负责激活码和 Token，客户端负责将加密 refresh token 绑定到自己的登录用户。</p></section>

        <section id="api"><h2>接口文档</h2><p>以下内容接口由浏览器直接请求。JSON 响应应使用 UTF-8 编码及 <code>application/json</code> 内容类型。</p><h3>分页搜索</h3><Endpoint method="GET" path="/v1/catalog/search?q={keyword}&page={page}&limit={limit}">按关键词返回分页曲目列表。播放器接近列表底部时，会递增 page 自动加载下一页。</Endpoint><SchemaTable title="查询参数" rows={[
          ['q', 'string', '是', '用户输入的歌曲、艺人或专辑关键词；不得为空。'],
          ['page', 'integer', '是', '从 1 开始的页码。'],
          ['limit', 'integer', '否', '期望每页数量；Provider 可设置上限并返回实际数量。'],
        ]} /><SchemaTable title="响应字段" rows={[
          ['tracks', 'Track[]', '是', '当前页曲目数组；无结果时返回空数组。'],
          ['page', 'integer', '建议', '当前实际页码。'],
          ['hasMore', 'boolean', '是', '是否仍有下一页；为 true 时客户端允许继续加载。'],
        ]} /><h3>随机发现</h3><Endpoint method="GET" path="/v1/catalog/random?limit={limit}&exclude={artists}">返回随机或推荐曲目。exclude 是以逗号分隔、经过 URL 编码的近期艺人列表，可用于降低重复。</Endpoint><SchemaTable title="查询与响应" rows={[
          ['limit', 'integer', '否', '期望返回的候选曲目数量。'],
          ['exclude', 'string', '否', '希望排除的艺人名称列表，逗号分隔。'],
          ['tracks', 'Track[]', '响应必填', '可随机选择并播放的候选曲目。'],
          ['singer', 'string', '响应可选', '本次推荐使用的艺人标识，客户端会用于后续去重。'],
        ]} /><Code>{trackExample}</Code><SchemaTable title="Track 对象" rows={[
          ['id', 'string', '是', 'Provider 内稳定且唯一的曲目标识，后续接口通过此值引用曲目。'],
          ['title', 'string', '是', '歌曲或音频标题。'],
          ['artist', 'string', '是', '艺人、作者或节目名称。'],
          ['album', 'string', '否', '专辑、节目系列或作品集名称。'],
          ['duration', 'number', '否', '音频时长，单位为秒。'],
          ['artwork', 'HTTPS URL', '否', '通用封面地址；建议同时返回 art 以兼容当前播放器。'],
          ['art', 'HTTPS URL', '否', '当前播放器直接使用的封面字段。'],
          ['source', 'string', '否', 'Provider 内的数据源或目录标识，会随后续请求传回。'],
          ['sourceId', 'string', '否', '底层资源标识；未提供时客户端使用 id。'],
          ['year', 'string | number', '否', '发行或发布年份。'],
          ['meta', 'object', '否', 'Provider 自定义的可序列化上下文，会在后续请求中原样传回。'],
        ]} /><h3>获取播放资源</h3><Endpoint method="POST" path="/v1/tracks/resolve">根据 Provider 自身的合法内容授权返回当前条目的短期播放地址。请求和响应均为 JSON。</Endpoint><SchemaTable title="请求体" rows={[
          ['id', 'string', '是', 'Track.id 或 Track.sourceId。'],
          ['source', 'string', '否', 'Track.source，用于定位具体目录。'],
          ['title', 'string', '否', '曲目标题，便于 Provider 校验或兼容旧数据。'],
          ['artist', 'string', '否', '艺人名称。'],
          ['quality', 'string', '否', '请求的音质标识，应来自 playback.qualities。'],
          ['meta', 'object', '否', '搜索结果附带的 Provider 自定义上下文。'],
          ['fallbackOnly', 'string', '否', '值为 1 时表示客户端正在尝试备用播放地址。'],
        ]} /><SchemaTable title="成功响应" rows={[
          ['url', 'HTTPS URL', '是', '浏览器可直接播放的音频地址，应支持媒体流或 Range 请求。'],
          ['expiresAt', 'ISO 8601 string | null', '建议', '播放地址失效时间；长期地址可为 null。'],
          ['bitrate', 'integer', '否', '实际码率，单位 kbps。'],
          ['quality', 'string', '否', '实际返回的音质标识。'],
          ['requestedQuality', 'string', '否', '客户端请求的音质；auto 表示由 Provider 自动选择。'],
          ['degraded', 'boolean', '否', '实际解析档位是否低于首选档位。'],
          ['qualityVerified', 'boolean', '否', '音质是否由上游返回的码率信息确认。'],
          ['mimeType', 'string', '否', '音频 MIME 类型，例如 audio/mpeg。'],
          ['art', 'HTTPS URL', '否', '解析阶段补充或更新的封面地址。'],
        ]} /><h3>歌词</h3><Endpoint method="GET" path="/v1/catalog/tracks/{id}/lyrics">将路径中的 {`{id}`} 替换为 URL 编码后的曲目标识，并附加可用的上下文查询参数。</Endpoint><SchemaTable title="查询与响应" rows={[
          ['source', 'string', '否', 'Track.source。'],
          ['title', 'string', '否', '曲目标题。'],
          ['artist', 'string', '否', '艺人名称。'],
          ['album', 'string', '否', '专辑名称。'],
          ['meta', 'JSON string', '否', 'Track.meta 序列化后的 JSON 字符串。'],
          ['lyrics', 'string', '响应必填', 'LRC 时间轴歌词或纯文本；无歌词时返回空字符串。'],
          ['translation', 'string', '响应可选', '翻译歌词，建议使用与 lyrics 一致的时间轴。'],
          ['format', 'string', '响应可选', '歌词格式标识，推荐 lrc 或 text。'],
        ]} /><h3>封面</h3><Endpoint method="GET" path="/v1/catalog/tracks/{id}/artwork">请求参数与歌词接口一致。当前播放器期望 JSON 响应，至少包含 url。</Endpoint><SchemaTable title="JSON 响应" rows={[
          ['url', 'HTTPS URL', '是', '浏览器可直接加载的图片地址。'],
          ['width', 'integer', '否', '图片原始宽度，单位像素。'],
          ['height', 'integer', '否', '图片原始高度，单位像素。'],
          ['mimeType', 'string', '否', '图片 MIME 类型，例如 image/jpeg。'],
        ]} /><h3>跨域要求</h3><p>浏览器会直接访问 Provider，Provider 必须处理预检请求、允许 LURI MUSIC 域名，并放行实际使用的认证请求头。音频和图片资源也应允许跨域读取。</p><Code>{`Access-Control-Allow-Origin: https://luri.cc.cd\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization`}</Code></section>

        <section id="security"><h2>安全与合规</h2><ul><li>禁止在 URL 查询参数中传输 API Key、Authorization、激活码、access token 或 refresh token。</li><li>refresh token 应具备撤销、轮换与最小权限能力，Provider 数据库只保存其摘要。</li><li>播放 URL 应设置较短有效期，不应暴露上游长期凭证。</li><li>Provider 应提供隐私政策、服务条款、运营者联系方式和权利投诉渠道。</li><li>仅可提供已获授权、自有、开放许可或用户依法有权访问的内容。</li><li>不得利用协议绕过访问控制、抓取非公开数据或规避数字版权保护措施。</li></ul></section>

        <section id="errors"><h2>错误规范</h2><p>失败响应应使用合适的 HTTP 状态码，并返回稳定的机器代码和可读消息。</p><Code>{`{
  "error": {
    "code": "activation_code_used",
    "message": "Activation code has already been used"
  }
}`}</Code><div className="docs-table"><div><b>400</b><span>请求参数或协议格式错误</span></div><div><b>401</b><span>凭证无效或已经过期</span></div><div><b>403</b><span>激活码无效或权限不可用</span></div><div><b>404</b><span>曲目或资源不存在</span></div><div><b>409</b><span>激活码已经被其他操作使用</span></div><div><b>429</b><span>请求频率或额度超限</span></div><div><b>5xx</b><span>Provider 内部或上游服务异常</span></div></div></section>

        <footer className="docs-footer"><span>Music Provider Protocol 1.0</span><a href="mailto:luri@luri.cc.cd">问题反馈：luri@luri.cc.cd</a></footer>
      </article>
      <aside className="docs-outline"><p>本页目录</p>{nav.slice(3).map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</aside>
    </div>
  </main>;
}
