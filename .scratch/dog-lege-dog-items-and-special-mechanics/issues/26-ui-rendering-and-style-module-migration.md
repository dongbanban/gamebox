# 26 — App、渲染、资源与样式拆分

**What to build:** 让 App 生命周期、棋盘/暂存槽/道具渲染、动画资源、音效资源与样式保持小模块协作；界面行为不因拆分变化，并为 v13 视觉验收提供稳定 seam。

**Blocked by:** 25 — 运行时状态与动画协调边界必须先稳定。

**Status:** done

- [x] App、游戏渲染、动画效果、资源/音效映射与样式拆分为约 500 行以内的模块或样式片段。
- [x] 视觉、资源、音效与文案中的可调字段全部读取集中配置。
- [x] 棋盘、暂存槽、道具摘要、机制说明、加载态与结果页保持现有用户流程。
- [x] 渲染层提供普通方块、幻化/双生入槽反馈与机制说明缩略图的独立验收 seam。
- [x] 每个拆分模块有可定位测试；样式、DOM 与动画改动可由 UI profile 单独验证。

## Implementation notes

- Starting commit: `f689f65d28639b339194033c5389f0fb49798b1d`。
- App、render、tray/loadout、mechanism thumbnail、animation lifecycle/timing/effects、asset/audio 与 CSS 已拆分；visual metrics 位于中立 seam。
- `DOG_V13_CONFIG` 承担 visual、asset、audio、copy、animation/particle 可调字段；默认文案与资源行为保持兼容。
- 新增 `tests/ui-rendering-modules.test.ts`，runtime tests 覆盖 animation timing 与 custom audio；`test:affected` UI profile 覆盖新模块。
- illusion/twin 的棋盘持久视觉标记由 ticket 27 收口为普通方块视觉；本 ticket 保留 reveal/split 入槽反馈 seam。
- 验证：`pnpm test:focused` 14 files / 207 tests；`pnpm test:ui` 5 files / 57 tests；`pnpm test:qa` full profile 通过（core 235、fallback 1、random 3、Chromium 19、cross-browser 9）；`pnpm typecheck`、`pnpm build`、`pnpm build:pages`、`git diff --check`、file-line check 通过。
