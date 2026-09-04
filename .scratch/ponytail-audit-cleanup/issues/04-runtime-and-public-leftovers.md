# 04 — 游戏运行时与公共遗留清理

**What to build:** 删除没有消费者的游戏计时/debug 状态和剩余公共遗留，使游戏启动、结果呈现、动画协调和通用游戏契约只保留当前使用的 seam。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 删除 `debug.elapsedMs`、`startedAt`、`endedAt` 及其相关运行时记录和赋值。
- [x] 删除没有仓内消费者的公共容量/视觉常量、类型别名、单方法控制器类型声明和 no-op 引用。
- [x] 保留仍被游戏目录、app、动画协调器、渲染器和测试使用的公共入口与契约。
- [x] 游戏启动、输入锁、动画生命周期、音效、结果回调和游戏目录导航行为保持不变。
- [x] 现有游戏控制器、渲染器、动画和公共契约测试更新为当前 API 并通过。

## Comments

- 删除运行时耗时投影、计时记录、无消费者的容量/视觉导出、冗余类型别名、`DogInputController` 单方法接口和 v13 配置 no-op 引用；保留当前目录、启动、结果、渲染和动画契约。
- 聚焦验证：`pnpm typecheck`、`pnpm test:ui`（7 个入口、90 个测试）、`git diff --check` 均通过；`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 仍报告 314 条（源码 29、测试 285），属于 ticket 05 的剩余绑定。
- 批量 QA：`pnpm test:qa` 通过（core 260、Worker fallback 4、随机回归 3、Chromium 24、跨浏览器 18、Pages build、diff-check、19 个文件行数检查）。Standards/Spec review 无未解决问题。
