# gamebox

## QA 命令

```bash
pnpm test:ui           # UI 单测：app + 狗了个狗渲染/交互/音效，快速反馈
pnpm test:affected     # 按 Git 改动选择快速 UI 或受影响验证
pnpm test              # 核心 Vitest 测试
pnpm test:random       # 1–100 随机回归、固定检查点、100–1000 压力档
pnpm test:e2e          # Chromium 浏览器流程
pnpm test:qa           # 核心 + 随机回归 + Chromium E2E
pnpm build:pages       # 生成 GitHub Pages /gamebox/ 路径产物
```

## Ticket 验收规则

UI 文案、DOM、渲染器、样式、视觉资源或游戏音效改动运行 `pnpm test:ui`；该命令不触发随机回归、浏览器 E2E 或构建。`test:ui` 已包含 `app`、`dog-lege-dog` 与 `sound-effects` 三组单测。

普通实现 ticket 运行 `pnpm test:affected`。命令会先识别纯 UI 改动并只运行 `pnpm test:ui`，避免重复触发相关测试、E2E 与构建；其他改动才依据 Vitest import graph 选择核心测试，并按影响范围追加随机回归、Chromium E2E，最后只运行一次 `build`，其内部已包含 `tsc --noEmit`。已经手动运行 `test:ui` 后，不要再叠加 `test:affected`。

测试失败后立即停止后续步骤，避免错误后的重复全量运行。

以下情况直接运行全量 `pnpm test:qa`，不要先运行 `pnpm test:affected`：

- 跨模块公共契约、进度、导航或游戏启动流程改动
- 关卡生成器、可解性搜索、难度筛选或随机回归改动
- 合并前、发布前或无法确认影响范围

响应式或浏览器兼容改动追加：

```bash
pnpm test:e2e:cross-browser
```

`pnpm test:qa` 与 `pnpm test:affected` 是互斥验证层；发布前只需追加 `pnpm build:pages`，不重复运行两套测试。

## GitHub Pages

`pnpm build:pages` 生成 `/gamebox/` base 的静态 `dist/`。推送 `main` 后，`.github/workflows/deploy-pages.yml` 自动构建并发布 GitHub Pages；也支持在 Actions 页面手动触发。首次启用需在仓库 Settings → Pages → Build and deployment → Source 选择 `GitHub Actions`。公开地址：<https://dongbanban.github.io/gamebox/>。

## 音乐素材

`public/audio/levelmusicloop-tigrun.ogg` 来自 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop) 中的 `happy_theme_0.ogg`，作者 gilzoide，页面标注为 CC0；项目在首次用户交互后本地循环播放该轻快主题，背景音量低于选取/三消反馈，音效开关同时控制音乐与交互音效。

随机失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本。按报告单关重放：

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
