# 01 — 拆分关卡生成器深模块

**What to build:** 在不改变现有关卡可观察结果的前提下，拆分关卡生成器职责并建立统一关卡提供器，使后续不规则逻辑轮廓、长方形可见棋盘、部分重叠与可解搜索改造可以在明确模块边界内完成。

**Blocked by:** None — can start immediately.

**Status:** done

- [x] 形状/轮廓、摆放、难度、可解搜索、重放与稳定随机职责形成独立深模块。
- [x] 对外继续保留单一 `LevelGenerator` seam；调用者无需理解内部模块。
- [x] 第 1 关与后续关卡统一通过关卡提供器取得，暂不改变现有可观察关卡内容。
- [x] 生成器不再为识别第 1 关而反向依赖固定关卡实现。
- [x] 游戏身份、生成器版本与默认 seed 拥有单一配置来源。
- [x] 相同关卡号、seed 与生成器版本产生与拆分前一致的棋盘和重放信息。
- [x] 核心测试、随机回归、类型检查与生产构建保持通过。

## Comments

- 拆分：`game-config`、`level-shapes`、`level-placement`、`level-difficulty`、`level-solvability`、`level-replay`、`level-random`、`level-provider`。`LevelGenerator` 保留对外 seam。
- 首关 canonical 配置继续由 provider 返回稳定生成结果，不保留独立固定布局；显式首关 seed/version 继续走生成器并可 replay，避免吞掉请求身份。
- 验证：`pnpm test:core`（48 tests）、`pnpm test:random`（3 tests）、`pnpm typecheck`、`pnpm build`。
