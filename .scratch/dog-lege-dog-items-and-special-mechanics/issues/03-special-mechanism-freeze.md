# 03 — 特殊机制模型与冻结方块

**What to build:** 建立由游戏定义的特殊机制扩展模型，落地冻结方块；冻结方块可被点击，但不能直接参与三消，满足自然规则后自动融化。

**Blocked by:** 01 — 特殊方块分布必须绑定可复现的随机关卡尝试。

**Status:** done

- [x] 特殊机制由具体游戏定义；公共游戏框架只承载生命周期、生成、渲染和校验所需协议，不写死冻结或其他游戏效果。
- [x] 关卡配置固定允许出现的特殊机制类型，并为每种机制提供独立的数量 `min/max`；每次启用的机制至少生成 1 个特殊方块，数量受棋盘规模与难度约束。
- [x] 同一方块最多携带一种特殊机制；同一关允许冻结方块与其他特殊机制同时出现。
- [x] 每次新尝试随机决定冻结方块位置与对应图案；同一 `runSeed` 下位置、图案和状态稳定，不同尝试允许不同。
- [x] 冻结方块显示冻结特效，点击行为与普通方块一致，可以进入暂存槽；冻结状态随方块进入暂存槽。
- [x] 暂存槽中的冻结方块不参与普通三消；其他图案成功完成 2 次三消后，冻结方块自动融化并变为普通方块。
- [x] 冻结方块融化后按普通方块规则参与后续三消；三消不要求方块在暂存槽内相邻。
- [x] 无火把、无万能方块时，包含冻结方块的关卡仍存在可解通路；冻结自然融化属于无道具可解路径。
- [x] 增加冻结方块状态迁移、三消计数、自然融化、随机生成、视觉状态及无道具求解测试。

## Comments

- 2026-08-20：从 ticket 01 AC5 拆入冻结自然融化、冻结状态参与无道具求解及对应测试验收。依赖 ticket 01 已完成，当前 ticket 保持 `ready-for-agent`。
- 2026-08-21：完成游戏侧特殊机制协议、冻结配置与 seeded 生成、暂存槽状态迁移、自然融化、求解验证及冻结视觉；补充同图案三消不推进冻结计数的回归测试，并更新 E2E 通关启发式以排除冻结槽块。验证通过：`pnpm test:focused`（84 tests）、`pnpm exec vitest run --exclude 'tests/e2e/**' --exclude tests/random-regression.test.ts --reporter dot`（108 tests）、`pnpm test:random`（3 tests）、`pnpm test:e2e`（17 tests）、`pnpm test:ui`（42 tests）、`pnpm build`、`pnpm exec vitest run tests/special-mechanism.test.ts tests/game-session.test.ts --reporter dot`（12 tests）。`pnpm test:qa` 仍受仓库已知 `test:core` 误收集 `tests/e2e/**` 问题阻断，已按约定拆分完成核心、随机回归与 E2E 验证。
