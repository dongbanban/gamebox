# 10 — 统一活动关卡离开保护

**What to build:** 让活动关卡在应用返回、浏览器后退、刷新或关闭时提供一致的离开保护，同时保证结果页和非活动页面不出现陈旧提示。

**Blocked by:** 04 — 建立通用游戏定义与结果展示契约

**Status:** done

- [x] 应用返回与浏览器后退在活动关卡中显示“当前关卡不会保存”确认。
- [x] 取消应用返回或浏览器后退后，当前棋盘、暂存槽与输入状态保持不变。
- [x] 确认离开后丢弃半局并返回游戏目录，不写入局内过程。
- [x] 活动关卡刷新或关闭时启用平台标准 `beforeunload` 提示。
- [x] 通关、失败、返回目录、游戏销毁与应用销毁后移除浏览器离开保护。
- [x] 注册页、游戏目录与结果页刷新或关闭不出现活动关卡提示。
- [x] 刷新或重新打开后从游戏目录开始，游戏进度与设置继续恢复，半局不恢复。
- [x] E2E 覆盖确认、取消、刷新、关闭与结果页无陈旧提示。

## Comments

- `GameboxApp` 在活动关卡启动后动态注册 `beforeunload`；应用返回、浏览器后退共用离开确认。结果确认立即撤销保护，目录、结果、游戏销毁与应用销毁路径统一清理。
- 单测验证活动关卡离开保护生命周期、取消离开后棋盘/暂存槽/输入状态保持、通关与失败结果确认后的即时清理。
- E2E 验证应用返回确认与取消、浏览器后退确认与取消、刷新/关闭平台提示、半局不恢复，以及注册页、目录、结果页无陈旧提示。
- 验证通过：`pnpm typecheck`、`pnpm build`、`pnpm exec vitest run tests/app.test.ts --testTimeout=15000`（17 tests）、`pnpm exec vitest run --exclude tests/random-regression.test.ts --exclude tests/level-generator.test.ts --testTimeout=15000`（46 tests）、Chromium E2E（12 tests）。
