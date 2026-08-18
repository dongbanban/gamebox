# 08 — 按关卡难度发放通关奖励

**What to build:** 让用户首次完成不同难度关卡时获得确定、可配置且随难度变化的通关奖励，同时保持重复完成幂等。

**Blocked by:** 04 — 建立通用游戏定义与结果展示契约；07 — 修复安全选择三态搜索与难度筛选

**Status:** done

- [x] 「狗了个狗」通过纯奖励策略根据公开关卡难度计算非负整数奖励。
- [x] 奖励不依赖用户、当前时间或本局用时。
- [x] 相同关卡身份、生成器版本与奖励配置版本产生相同奖励。
- [x] 第 1 关可以保留基准奖励；更高阶段不能全部固定为同一数值。
- [x] 首次完成立即记录实际奖励、完成历史与下一关解锁。
- [x] 重玩已完成关卡奖励为 0，累计积分不增加，最高解锁关卡不降低。
- [x] 通关结果页展示本关实际奖励与最新累计积分。
- [x] 临时运行模式继续完成游戏，但明确提示刷新后奖励可能丢失。
- [x] 测试通过公开关卡与完成记录观察奖励，不锁定私有公式实现。

## Comments

- 新增版本化 `DOG_LEVEL_REWARD_CONFIG` 与纯 `calculateDogLevelReward`；生成关卡、结果与 replay metadata 使用同一奖励版本。首关奖励保持 100，高阶段按公开难度字段变化；配置值校验并限制为非负 safe integer。
- 完成记录继续由 `ProgressStore` 保证首次奖励幂等、累计积分与下一关解锁；结果页显示实际奖励、累计积分；临时运行警告保持。
- 验证通过：`pnpm typecheck`、`pnpm build`、`pnpm test:core`（63 tests）、受影响 Vitest（4 tests + ProgressStore/App 3 tests + generation failure 1 test）、`DOG_RANDOM_LEVEL_COUNT=1 DOG_STRESS_LEVEL_COUNT=100 pnpm test:random`（3 tests）、`pnpm test:e2e`（12 tests）。
