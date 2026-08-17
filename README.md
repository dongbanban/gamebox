# gamebox

## QA 命令

```bash
pnpm test              # 核心 Vitest 测试
pnpm test:random       # 1–100 随机回归、固定检查点、100–1000 压力档
pnpm test:e2e          # Chromium 浏览器流程
pnpm test:qa           # 核心 + 随机回归 + Chromium E2E
```

随机失败报告包含 `testSeed`、关卡号、关卡 seed、生成器版本。按报告单关重放：

```bash
DOG_RANDOM_TEST_SEED=<testSeed> \
DOG_RANDOM_LEVEL_NUMBER=<levelNumber> \
pnpm test:random
```

压力档默认运行 100 关；需要完整上限时设置 `DOG_STRESS_LEVEL_COUNT=1000`。

跨浏览器 smoke 需要先安装 Firefox、WebKit 浏览器：

```bash
PLAYWRIGHT_CROSS_BROWSER=1 pnpm test:e2e
```

该模式覆盖 Chromium、Firefox、WebKit 与移动 Chromium 视口。
