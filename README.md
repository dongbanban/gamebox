# gamebox

## QA 命令

```bash
pnpm test:ui           # UI 单测：app + 狗了个狗渲染/交互/音效，快速反馈
pnpm test:affected     # 按 Git 改动选择快速 UI 或受影响验证
pnpm test              # 核心 Vitest 测试
pnpm test:random       # 固定 seed 驱动的 1–100 连续前缀、检查点、100–1000 压力档
pnpm test:e2e          # Chromium 浏览器流程
pnpm test:qa           # 目标：核心 + 随机回归 + Chromium E2E；当前见下方已知限制
pnpm build:pages       # 生成 GitHub Pages /gamebox/ 路径产物
```

## Ticket 验收规则

UI 文案、DOM、渲染器、样式、视觉资源或游戏音效改动运行 `pnpm test:ui`；该命令不触发随机回归、浏览器 E2E 或构建。`test:ui` 已包含 `app`、`dog-lege-dog` 与 `sound-effects` 三组单测。

普通实现 ticket 运行 `pnpm test:affected`。命令会先识别纯 UI 改动并只运行 `pnpm test:ui`，避免重复触发相关测试、E2E 与构建；其他改动才依据 Vitest import graph 选择核心测试，并按影响范围追加随机回归、Chromium E2E，最后只运行一次 `build`，其内部已包含 `tsc --noEmit`。已经手动运行 `test:ui` 后，不要再叠加 `test:affected`。

测试失败后立即停止后续步骤，避免错误后的重复全量运行。

以下情况目标上直接运行全量 `pnpm test:qa`，不要先运行 `pnpm test:affected`：

- 跨模块公共契约、进度、导航或游戏启动流程改动
- 关卡生成器、可解性搜索、难度筛选或随机回归改动
- 合并前、发布前或无法确认影响范围

响应式或浏览器兼容改动追加：

```bash
pnpm test:e2e:cross-browser
```

`pnpm test:qa` 与 `pnpm test:affected` 是互斥验证层；发布前只需追加 `pnpm build:pages`，不重复运行两套测试。

当前已知限制由 ticket 19 跟踪：

- `test:core` 尚未排除 `tests/e2e/**`，`pnpm test:qa` 会在 Vitest 收集 Playwright spec 时退出。
- `scripts/test-affected.mjs` 的生成器影响匹配仍针对目录整理前路径，`levels/` 下改动可能漏跑随机回归。

ticket 19 完成前需要全量验证时，分别运行：

```bash
pnpm exec vitest run --exclude tests/random-regression.test.ts --exclude 'tests/e2e/**'
pnpm test:random
pnpm test:e2e
```

## 源码路径

Vite 与 TypeScript 统一使用 `@/* → src/*`。源码和测试中的项目内部 import 使用 `@/...`；Node 内置模块、npm 包、CSS/静态资源 URL 不受该 alias 约束。

## GitHub Pages

`pnpm build:pages` 生成 `/gamebox/` base 的静态 `dist/`。推送 `main` 后，`.github/workflows/deploy-pages.yml` 自动构建并发布 GitHub Pages；也支持在 Actions 页面手动触发。首次启用需在仓库 Settings → Pages → Build and deployment → Source 选择 `GitHub Actions`。公开地址：<https://dongbanban.github.io/gamebox/>。

## 静态 SVG CDN

`public/assets/dog-icons-square/*.svg` 支持 CDN 前缀。生产默认配置在 `.env.production`，狗图资源与目录封面从 `https://gamebox-assets.pages.dev` 加载；本地开发继续使用当前站点路径。

本地构建：

```bash
VITE_ASSET_CDN_BASE_URL=https://cdn.example.com/gamebox/v1 pnpm build:pages
```

GitHub Pages 优先使用仓库 Variables 中的 `ASSET_CDN_BASE_URL`；未设置时回退到 `https://gamebox-assets.pages.dev`。`public/_headers` 为狗图 SVG 设置一年长期缓存。CDN 需返回 `Content-Type: image/svg+xml`、HTTPS、`Access-Control-Allow-Origin`。修改同名 SVG 时需更新资源版本或清理 CDN 缓存。

## 音乐素材

`public/audio/levelmusicloop-tigrun.ogg` 来自 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop) 中的 `happy_theme_0.ogg`，作者 gilzoide，页面标注为 CC0；项目在首次用户交互后本地循环播放该轻快主题，背景音量低于选取/三消反馈，音效开关同时控制音乐与交互音效。

随机回归未显式提供 seed 时使用固定 `random-regression-default-v1`，并由该 seed 确定连续前缀长度。失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本。按报告单关重放：

```bash
DOG_RANDOM_TEST_SEED=<testSeed> \
DOG_RANDOM_LEVEL_NUMBER=<levelNumber> \
pnpm test:random
```

压力档默认运行 100 关；需要完整上限时设置 `DOG_STRESS_LEVEL_COUNT=1000`。

跨浏览器 smoke 需要先安装 Playwright WebKit（Safari 引擎）：

```bash
pnpm exec playwright install webkit
pnpm test:e2e:cross-browser
```

该模式覆盖 Chromium、Safari（Playwright WebKit）与移动 Chromium 视口。
