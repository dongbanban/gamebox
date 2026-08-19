# 04 — 建立通用游戏定义与结果展示契约

**What to build:** 让公共层通过游戏定义和结果展示契约渲染目录与结果，不再理解「狗了个狗」的暂存槽、三消或专属文案，为后续新增游戏保留稳定边界。

**Blocked by:** 03 — 拆分游戏控制器、渲染器与图案资源

**Status:** done

- [x] 游戏定义统一提供稳定身份、名称、类别、简介、封面、可玩状态、启动器与结果展示元数据。
- [x] 游戏结果向公共层提供关卡号、状态、奖励与游戏侧展示信息。
- [x] 公共层不按游戏身份分支判断暂存槽、三消、棋盘或专属失败原因。
- [x] 「狗了个狗」通关与失败结果继续展示正确的游戏名、关卡、奖励与操作。
- [x] 公共层可以通过测试用游戏定义渲染不同结果文案，无需新增实际可玩游戏。
- [x] 游戏目录顺序、开始游戏、进度读取与结果持久化行为保持不变。
- [x] 公共结果契约为下一关、重试与返回目录动作保留通用表达。

## Comments

- 新增 `GameDefinition`、`GameResultDisplay`、`GameResultAction` 公共契约；`GameboxApp` 支持注入测试目录并按通用动作渲染结果。
- Dog 通关结果持久化后提供 `next-level` 与 `catalog`；失败提供 `retry` 与 `catalog`。下一关按最新进度校验。
- 验证通过：`pnpm typecheck`、`pnpm build`、`pnpm test:core`（53 tests）、`pnpm test:random`（3 tests）、`pnpm test:e2e`（12 tests）。
