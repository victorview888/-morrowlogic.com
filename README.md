# Morrow Logic · 明日逻辑

中英双语静态品牌站，介绍休闲游戏、AI 工具与热点内容站点的建设和运营。生产页面没有 JavaScript 运行时依赖；开发阶段使用 parse5 生成 HTML、Playwright 验证浏览器行为。

## 本地开发

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run build
npm start
```

开发服务默认使用 8080 端口；可用 `PORT=8081 npm start` 指定端口。必须使用 HTTP 服务预览，不能直接以 `file://` 打开。

- 英文首页：`/`
- 中文首页：`/zh-CN/`
- 英文隐私政策：`/pages/privacy`
- 中文隐私政策：`/zh-CN/pages/privacy`

URL 决定语言，不被浏览器语言或旧 localStorage 偏好覆盖。语言切换保留当前页面、查询参数和锚点，浏览器前进、后退、刷新均使用实际静态文件。关闭 JavaScript 后正文、邮箱与语言链接仍可使用。

## 修改内容

- 页面结构：`templates/index.html`、`templates/privacy.html`
- 中英文案：`assets/js/locales/zh-CN.js`、`assets/js/locales/en.js`
- 样式：`assets/css/`
- 交互：`assets/js/main.js`、`assets/js/i18n.js`
- 表单公开配置：`assets/js/config.js`

修改后执行 `npm run build`。生成的 `index.html`、`pages/privacy.html`、`zh-CN/` 和 `sitemap.xml` **一起提交**，不要直接编辑生成页面。生成过程校验页面引用的翻译键，并更新页面标题、描述、canonical、hreflang、OG URL、结构化数据和资源内容版本号。

只公布可核验的信息。当前已去除占位地址、备案号、未经核实的用户量和合作方标识；AI 工具和热点内容标为内容方向，不作为已有客户案例。现有邮箱与 QuickWebGames 链接沿用原仓库信息，其归属及接收能力需由运营方确认。补充真实案例时，应注明统计口径、时间及可验证链接。

## 联系表单

默认 `window.ML_FORM_ENDPOINT = ''`：只生成邮件草稿，访客需要点击链接并在邮件客户端发送，网站不会声称服务端已收到消息。邮箱链接始终可用；公司和电话选填。

如有已配置的表单处理服务，在 `assets/js/config.js` 中填写其**公开 HTTPS 接收地址**，然后重新生成页面。端点需要接受 JSON POST、允许网站来源的 CORS，并仅在接受提交后返回 2xx。字段为 `name`、`company`、`email`、`phone`、`type`、`message`。

接入后，前端提供发送状态、重复提交保护、15 秒超时及失败反馈，失败时保留输入。API 密钥必须保存在服务端，不能放在配置文件中。启用前请配置接收方、限流和反垃圾措施，并核对隐私政策；用真实测试咨询验证通知实际送达。自动化测试使用模拟端点，不代表邮件送达已验证。

## 验证

```bash
npx playwright install chromium
npm test
# 启动本地服务后：
npm run smoke
# 对部署后的站点做只读检查：
npm run smoke -- https://morrowlogic.com
```

如机器已有兼容 Chromium，可使用 `CHROMIUM_PATH=/usr/bin/chromium npm test`。受限云环境可为 npm 指定可写缓存：`npm ci --cache /tmp/morrow-npm-cache`。

测试覆盖四个页面的静态翻译、页面元数据、内部链接和锚点，以及手机/平板/桌面布局、键盘操作、无脚本阅读、语言切换、表单校验、草稿模式及模拟提交成功和失败。真实线上性能需另行测量，可参考 LCP ≤ 2.5 秒、INP ≤ 200 毫秒、CLS ≤ 0.1 的目标；本地功能通过不代表已达到这些指标。

## Cloudflare Pages

保持已有 Git 连接：仓库 `victorview888/-morrowlogic.com`，生产分支 `main`。由于生成页面随代码提交，现有“构建命令为空、发布仓库根目录”的模式仍然可用。无需新增 GitHub Actions 部署密钥或 Wrangler。

`.github/workflows/check.yml` 只运行检查，不负责发布。建议为 `main` 设置必须通过检查的分支规则；Cloudflare 原生 Git 部署与 GitHub 检查可能并行执行。

部署前后核对：

1. Workers & Pages 中的 Git 连接、生产分支和自动部署开关仍有效。
2. 最近一次成功部署的提交 SHA 与目标提交一致。
3. `morrowlogic.com` 自定义域名为 Active，HTTPS 正常。
4. 对生产地址运行上面的 smoke 命令，再验证语言切换及关键交互。
5. 失败时在 Pages 部署记录中回滚到已确认的成功版本。

固定文件名资源使用重新验证缓存，HTML 引用同时附带内容版本号，避免此前一年 immutable 缓存的旧资源继续被复用。外部托管平台的实际缓存响应头、Git 连接和部署状态需要在发布后验证。
