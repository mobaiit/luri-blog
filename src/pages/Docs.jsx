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
    "types": ["activation_code", "api_key", "none"],
    "apiKey": { "header": "X-API-Key", "prefix": "" },
    "accessTokenSeconds": 900
  },
  "capabilities": ["search", "random", "lyrics", "artwork", "playback"],
  "playback": { "mode": "direct", "qualities": ["128k", "320k"] },
  "endpoints": {
    "activate": "https://provider.example.com/v1/auth/activate",
    "refresh": "https://provider.example.com/v1/auth/refresh",
    "account": "https://provider.example.com/v1/account",
    "search": "https://provider.example.com/v1/catalog/search",
    "random": "https://provider.example.com/v1/catalog/random",
    "resolve": "https://provider.example.com/v1/catalog/resolve",
    "lyrics": "https://provider.example.com/v1/catalog/tracks/{id}/lyrics",
    "artwork": "https://provider.example.com/v1/catalog/tracks/{id}/artwork"
  }
}`;

const trackExample = `{
  "tracks": [{
    "id": "track-001",
    "title": "Track title",
    "artist": "Artist",
    "album": "Album",
    "duration": 238,
    "artwork": "https://provider.example.com/artwork/track-001"
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

        <section id="start"><h2>快速开始</h2><p>LURI MUSIC 是音乐播放器客户端，不预置内容源。播放器通过开放的 Music Provider Protocol（MPP）连接由用户选择的独立服务。Provider 可以是个人私有音乐库、机构授权曲库、播客或广播目录，也可以是开发测试服务。</p><ol><li>注册并登录 LURI MUSIC。</li><li>打开右上角账户菜单，进入“Provider 配置”。</li><li>选择 Provider 支持的连接方式，填写 HTTPS 服务地址及对应凭证。</li><li>验证成功后启用该 Provider，即可使用其声明的搜索、播放、歌词等能力。</li></ol><div className="docs-note"><b>连接前检查</b><span>请确认 Provider 的运营主体、服务条款、隐私政策及内容授权范围。协议兼容只表示技术格式兼容，不代表 LURI MUSIC 的审核或推荐。</span></div></section>

        <section id="provider-types"><h2>连接方式</h2><p>同一账号可保存多个 Provider，但同一时间只激活一个。客户端 1.x 支持以下三种认证配置：</p><div className="docs-cards"><article><i>01</i><h3>授权码</h3><p>适合订阅服务、设备授权或有有效期的账号。授权码仅用于换取 Provider 凭证，不是播放器激活码。</p><code>activation_code</code></article><article><i>02</i><h3>API Key</h3><p>适合自建服务、机构接口和开发者平台。密钥由用户自己的 Provider 签发并加密保存。</p><code>api_key</code></article><article><i>03</i><h3>公开服务</h3><p>适合开放版权曲库、公共广播、播客目录或无需身份认证的私有局域网网关。</p><code>none</code></article></div><p>OAuth 2.0 PKCE 已在协议中保留，但当前网页客户端尚未开放配置入口。</p></section>

        <section id="usage"><h2>使用说明</h2><h3>添加与切换</h3><p>Provider 地址应填写服务根地址，例如 <code>https://provider.example.com</code>。客户端会读取标准发现文件并核对协议版本、认证方式和接口地址。保存后可在 Provider 列表中随时切换，切换不会删除其他配置。</p><h3>搜索与播放</h3><p>搜索、随机发现、歌曲详情、播放地址、歌词和封面均由当前 Provider 按其能力声明返回。播放列表和播放状态保存在浏览器中；切换 Provider 后，客户端会使用独立的存储命名空间，避免不同服务的数据混淆。</p><h3>删除配置</h3><p>删除操作只会移除 LURI MUSIC 保存的连接配置，不会删除 Provider 侧账号或内容。需要撤销设备或密钥时，请同时前往对应 Provider 完成撤销。</p></section>

        <section id="protocol"><h2>协议概览</h2><p>Music Provider Protocol 是基于 HTTPS 与 JSON 的开放接口约定。客户端不会下载或执行 Provider 提供的远程 JavaScript，所有能力通过声明式清单和固定 HTTP 接口完成。</p><ul><li>协议标识固定为 <code>music-provider</code>。</li><li>1.x 客户端忽略未知字段，兼容新增的可选能力。</li><li>发现文件和所有接口必须使用 HTTPS 且保持同源。</li><li>Provider 应仅声明自己确实实现的能力与端点。</li></ul></section>

        <section id="discovery"><h2>服务发现</h2><p>Provider 必须在根域名提供以下公开文件：</p><Endpoint method="GET" path="/.well-known/music-provider.json">返回 Provider 标识、协议版本、认证类型、能力、播放模式及接口地址。</Endpoint><Code>{manifestExample}</Code><p>当声明 <code>api_key</code> 时，可通过 <code>authentication.apiKey</code> 指定请求头名称和可选前缀。请求头仅允许标准安全名称；推荐使用 <code>Authorization: Bearer ...</code> 或 <code>X-API-Key: ...</code>。</p></section>

        <section id="authentication"><h2>认证协议</h2><h3>授权码模式</h3><Endpoint method="POST" path="/v1/auth/activate">接收 activationCode、deviceId、deviceName，返回短期 accessToken、长期 refreshToken、expiresIn 和 account。</Endpoint><Endpoint method="POST" path="/v1/auth/refresh">接收 refreshToken，签发新的短期 accessToken。</Endpoint><Endpoint method="GET" path="/v1/account">返回状态、有效期、额度与设备摘要。</Endpoint><h3>API Key 模式</h3><p>用户在播放器中输入由 Provider 签发的 API Key。LURI MUSIC 服务端使用 AES-GCM 加密保存，浏览器只在请求当前 Provider 时临时取得凭证。Provider 可通过发现文件指定 <code>Authorization</code> 或 <code>X-API-Key</code> 请求头。</p><h3>公开模式</h3><p>公开 Provider 不要求凭证，但仍必须提供标准发现文件、CORS 响应头和完整的内容接口。公开模式不等于内容可以任意使用，Provider 仍需公布内容许可和使用范围。</p></section>

        <section id="api"><h2>接口文档</h2><h3>目录接口</h3><Endpoint method="GET" path="/v1/catalog/search?q={keyword}&page={page}&limit={limit}">分页搜索。返回 tracks、page 和 hasMore。</Endpoint><Endpoint method="GET" path="/v1/catalog/random?limit={limit}">返回随机或推荐曲目，响应结构与搜索一致。</Endpoint><Code>{trackExample}</Code><h3>播放与元数据</h3><Endpoint method="POST" path="/v1/catalog/resolve">请求体包含 id、source 和 quality，返回短期可播放 URL、码率与过期时间。</Endpoint><Endpoint method="GET" path="/v1/catalog/tracks/{id}/lyrics">返回 lyrics，可选 translation 及时间轴格式声明。</Endpoint><Endpoint method="GET" path="/v1/catalog/tracks/{id}/artwork">可直接返回图片，或返回包含 url、width、height 的 JSON。</Endpoint><h3>跨域要求</h3><p>由于播放请求由浏览器直接发往 Provider，Provider 必须允许 LURI MUSIC 域名，并放行实际使用的认证请求头：</p><Code>{`Access-Control-Allow-Origin: https://luri.cc.cd\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: Content-Type, Authorization, X-API-Key`}</Code></section>

        <section id="security"><h2>安全与合规</h2><ul><li>禁止在 URL 查询参数中传输 API Key、access token 或 refresh token。</li><li>refresh token 和 API Key 应具备撤销、轮换与最小权限能力。</li><li>播放 URL 应设置较短有效期，不应暴露上游长期凭证。</li><li>Provider 应提供隐私政策、服务条款、运营者联系方式和权利投诉渠道。</li><li>仅可提供已获授权、自有、开放许可或用户依法有权访问的内容。</li><li>不得利用协议绕过访问控制、抓取非公开数据或规避数字版权保护措施。</li></ul></section>

        <section id="errors"><h2>错误规范</h2><p>失败响应应使用合适的 HTTP 状态码，并返回稳定的机器代码和可读消息。</p><Code>{`{
  "error": {
    "code": "invalid_credentials",
    "message": "Provider credential is invalid"
  }
}`}</Code><div className="docs-table"><div><b>400</b><span>请求参数或协议格式错误</span></div><div><b>401</b><span>凭证无效或已经过期</span></div><div><b>403</b><span>账号无权访问该能力或内容</span></div><div><b>404</b><span>曲目或资源不存在</span></div><div><b>429</b><span>请求频率或额度超限</span></div><div><b>5xx</b><span>Provider 内部或上游服务异常</span></div></div></section>

        <footer className="docs-footer"><span>Music Provider Protocol 1.0</span><a href="mailto:luri@luri.cc.cd">问题反馈：luri@luri.cc.cd</a></footer>
      </article>
      <aside className="docs-outline"><p>本页目录</p>{nav.slice(3).map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}</aside>
    </div>
  </main>;
}
