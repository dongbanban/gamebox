# 01 — 乱序方块入槽与待乱序状态

**What to build:** 在受控测试关卡中完成乱序方块从棋盘入槽到待乱序状态的可观察闭环。方块棋盘视觉与普通方块一致；入槽先完成普通三消；自身在首次结算中被移除时不触发机制；存活后显示持续槽内动效，并在完整结算后按有效容量 5/6/7/8 准确识别 3/4/5/5 阈值。该阶段只作为受控 seam，不进入正式随机关卡生成。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 新增乱序机制的配置与公共状态契约，支持单个乱序方块在受控关卡中进入暂存槽。
- [x] 入槽先执行已有机制转换与普通三消；乱序方块在首次三消或级联三消中被移除时按普通方块处理，不进入待乱序状态。
- [x] 乱序方块首次结算后仍在槽内时进入待乱序状态，持续动效只表达状态，不改变逻辑槽序。
- [x] 阈值按完整结算后的逻辑方块数与当前有效容量计算；有效容量为 5、6、7、8 时分别在 3、4、5、5 个逻辑方块到达后产生可供后续安全乱序消费的明确触发状态。
- [x] 锁槽解锁或容量提升改变有效容量后重新计算阈值；达到新阈值且乱序方块仍存活时在该次动作结算末尾触发状态。
- [x] 待乱序方块在达到阈值前被后续普通三消移除时失效，不产生乱序。
- [x] 棋盘不显示乱序特殊 class、边框、图标、遮罩、位置提示或常驻动效；槽内状态、输入锁与可访问反馈可观察。
- [x] 受控关卡 fixture、核心运行时测试与槽内 UI 测试覆盖上述状态转移；默认正式关卡配置保持关闭。

## Comments

- 2026-08-28：实现 `shuffle` 配置、`dormant → armed → triggerable` 状态、有效容量动态阈值、普通棋盘视觉、槽内持续动效、ARIA/data 状态。正式 v13 机制列表保持四类，shuffle 默认关闭；未进入生成器正式分配。
- 2026-08-28：代码审查后补齐关闭态机制计划 `counts.shuffle = 0`、shuffle 配置开关门禁、必需状态文案、配置驱动动效时长、可触发态 UI、立即达阈值与同动作后续三消边界测试。
- 2026-08-28：补齐 `test:affected` 对 `shuffle-block.ts` 与 `shuffle-ui.ts` 的入口、UI、高风险 profile 映射，避免 nested case 漏测。
- 验证：`pnpm exec vitest run tests/dog-config.test.ts tests/generation-profile.test.ts tests/v13-level-generation.test.ts tests/special-mechanism.test.ts tests/special-ui.test.ts`（70 passed）；`pnpm typecheck`（通过）；`pnpm test:qa`（full profile passed：core 240、worker/fallback 4、random 3、Chromium 21、cross-browser 9、pages build、diff、file-line）。
