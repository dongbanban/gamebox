# 03 — 拆分游戏控制器、渲染器与图案资源

**What to build:** 在不改变用户体验的前提下分离「狗了个狗」的状态编排、DOM 渲染与图案资源，使后续控制区、文案与移动布局调整不再集中修改单一巨型入口。

**Blocked by:** None — can start immediately.

**Status:** done

- [x] 游戏控制器只编排 `GameSession`、输入锁、动画、音效、结果确认与生命周期。
- [x] 渲染器只根据公开游戏状态生成游戏页面，不直接修改局内规则状态。
- [x] 十种狗主题 SVG 图案与展示元数据从控制器和渲染流程中独立。
- [x] 游戏继续暴露单一启动、状态读取、方块选择与销毁 seam。
- [x] Pointer Events、程序化选择、动画取消与销毁后的行为保持一致。
- [x] 点击、三消、通关、失败音效与粒子反馈保持可用。
- [x] 现有游戏公开行为测试、浏览器流程、类型检查与构建保持通过。

## Comments

- 拆分 `game-controller.ts`、`game-renderer.ts`、`game-assets.ts` 与 `game-types.ts`；`index.ts` 保留原公开入口与导出。
- controller runtime 收束状态组装；移除恒为 `true` 的音频初始化参数与无附加语义的粒子转发。
- 验证通过：`pnpm typecheck`、`pnpm build`、`pnpm test:qa`（core 51 tests、random 3 tests、E2E 12 tests）。
