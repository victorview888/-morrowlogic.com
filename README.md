# Morrow Logic · 明日逻辑 品牌站

纯静态、零依赖、6 国语言、形象专业型品牌官网。围绕“计算机软件开发 / 系统集成 / 数据处理服务”三大业务展开。

## 目录结构

```
.
├── index.html                       主入口（单页长滚动 + 预留扩展）
├── pages/
│   ├── _template.html               子页模板（共用头尾/i18n/样式）
│   └── privacy.html                 隐私政策示例
├── assets/
│   ├── css/
│   │   ├── base.css                 设计令牌、reset、排版、无障碍
│   │   ├── components.css           按钮、卡片、导航、语言切换、页脚
│   │   └── sections.css             各 section 布局、Hero 背景、响应式
│   ├── js/
│   │   ├── i18n.js                  多语言引擎（兼容 file:// 直开）
│   │   ├── main.js                  交互（导航/计数/Canvas/表单/返回顶部）
│   │   └── locales/
│   │       ├── zh-CN.js             简体中文
│   │       ├── en.js                English
│   │       ├── ja.js                日本語
│   │       ├── zh-TW.js             繁體中文
│   │       ├── es.js                Español
│   │       └── de.js                Deutsch
│   └── img/
│       ├── logo-mark.svg            单色标志
│       ├── logo-full.svg            完整标志（含文字）
│       ├── favicon.svg              浏览器图标
│       └── og-image.svg             社交分享卡
├── robots.txt
└── sitemap.xml
```

## 快速预览

无需构建，直接起一个静态服务：

```bash
# 任选其一
python -m http.server 8080
npx serve .
# 或直接在浏览器打开 index.html
```

## 国际化（i18n）

- 默认语言：**简体中文**（`zh-CN`）。
- 顺序：用户上次选择 → URL `?lang=xx` → 浏览器语言 → 默认。
- 切换状态保存在 `localStorage.ml_lang`。
- URL 会同步追加 `?lang=xx`，便于分享与 SEO。

### 新增/修改语言

1. 复制 `assets/js/locales/en.js` 为 `xx.js`，逐条翻译。
2. 在 `i18n.js` 的 `SUPPORTED` 数组追加 `xx`。
3. 在 `SUPPORTED_NAMES` 补充本地化显示名。
4. 在 `index.html` 头部 `<link rel="alternate" hreflang="...">` 与语言下拉 `[data-lang-option]` 中加上。
5. （可选）在 `sitemap.xml` 同步 `xhtml:link`。

> 校验脚本：`node -e "/* 见仓库根 README 末尾 */"`。

## 内容自定义（占位 → 真实）

文案修改原则：**只改语言包，不改 HTML**。所有可见文字均通过 `data-i18n="key"` 标注，对应每个语言包里的 key。

需要替换的占位：

| 占位 | 在哪 |
| --- | --- |
| 公司全称 | 各 locale `footer.slogan`、`<title>`、`meta.*` |
| 业务数据 | `stats.s*`、首页 Stats 节点 `data-count` |
| 客户案例 | `cases.c1/c2/c3.*` |
| 联系方式 | `contact.l*` 与 HTML `<a href>` 中的邮箱/电话 |
| ICP 备案号 | `footer.icp` |
| Logo / OG 图 | `assets/img/*.svg`（导出 PNG 建议 2x 尺寸） |

## 表单接入

`main.js` 默认走 `mailto:` 兜底（不会丢线索）。

如需对接服务端：

```html
<script>window.ML_FORM_ENDPOINT = 'https://formspree.io/f/xxxxxx';</script>
```

即可启用 JSON POST 提交（endpoint 需支持 CORS）。

## 部署

### 通用静态主机（任意）
把仓库内容上传到 宝塔 / OSS / S3 / Nginx 即可，无需构建。

### Cloudflare Pages
- 直接连接 Git 仓库或上传 dist。
- 默认根目录：仓库根。
- 无构建命令。

### Vercel
- Framework Preset: **Other**。
- Build Command / Output: 留空。

## 性能与无障碍

- 无外部依赖、首屏仅 ~25KB CSS + ~6KB JS（未压缩）。
- `prefers-reduced-motion` 全面降级。
- 键盘可达：跳过链接、`:focus-visible`、语言切换支持方向键与回车。
- 颜色对比 AA+。

## 多页扩展

1. 复制 `pages/_template.html` 为 `pages/<name>.html`。
2. 把 `#INCLUDE-HEAD` / `#INCLUDE-FOOT` 注释替换为对应的 `<link>` 与 `<script>` 引入（用相对路径 `../assets/...`）。
3. 在 `<main>` 内写正文，复用 `data-i18n` 系统（任意 key，可在不同页面用不同 key）。
4. 在 `index.html` 头部 `nav__menu` 增加入口链接。

## 自定义视觉

主要令牌在 `assets/css/base.css` 顶部 `:root{}`，改一处即全站生效：

```css
--brand-1:#4f8dff;   /* 主色 */
--brand-2:#22e3c4;   /* 高光 */
--brand-3:#8b5cf6;   /* 强调 */
--grad-1:...         /* 主按钮渐变 */
--grad-text:...      /* 渐变文字 */
```

## License

MIT
