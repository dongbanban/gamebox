# 01 — 注册与游戏目录首条闭环

**What to build:** 首次访问用户可以完成一次点击注册，进入纵向游戏目录并看到「狗了个狗」游戏卡片；回访用户跳过注册；用户可以重置本地数据。

**Blocked by:** None — can start immediately.

**Status:** done

- [x] 首次访问展示注册页；点击注册生成匿名 UUID，并创建版本化本地状态。
- [x] 已有有效 `userId` 时跳过注册页，直接进入游戏目录。
- [x] 游戏目录采用单列纵向滚动；「狗了个狗」卡片固定排在第一位。
- [x] 游戏卡片展示封面、名称、简介、最高解锁关卡与进入操作；累计积分在通关结果页展示。
- [x] 重置操作经过确认，清除用户、游戏进度、积分与应用设置，并返回注册页。
- [x] 本地状态缺失、损坏或不可写时不白屏；显示无法持久化提示并允许临时运行。
- [x] 建立 `pnpm` 项目运行与基础 Vitest/Playwright 测试入口。

## Comments

- `ProgressStore` 提供版本化本地状态、UUID 注册、回访读取、确认重置与临时运行降级。
- 原生 DOM/CSS 实现注册页、单列游戏目录、首个游戏目录项与可用游戏入口 shell。
- 验证通过：`pnpm test`（7 tests）、`pnpm typecheck`、`pnpm build`、`pnpm test:e2e`（Chromium 2 tests）。
