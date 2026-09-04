# 03 — 道具运行时契约收缩

**What to build:** 让内置道具次数直接遵循 v13 配置，并将道具运行时快照收敛到当前 UI 和控制器实际使用的数据，同时保持道具组、目标选择和原子效果行为不变。

**Blocked by:** 01 — v13 配置与进度 helper 收缩

**Status:** done

- [x] 删除忽略关卡参数的内置道具次数 adapter；内置道具次数直接读取经过校验的 v13 规则。
- [x] 注入自定义运行时定义时继续保留必要的数值归一化和测试 seam。
- [x] 删除未被当前渲染器或控制器消费的道具图标、逐道具描述、逐道具目标类型、逐道具反馈、最大次数和目标图案数据。
- [x] 道具组编辑器继续使用配置文案和道具资源；道具摘要继续正确显示名称、剩余次数、可用状态和活动目标。
- [x] 固定 8 种道具集合、3 种道具组选择和已保存道具组的校验行为保持不变。
- [x] 道具取消、无效目标、动画完成、失败补偿、钥匙掉落及原子提交行为保持不变。
- [x] 现有道具运行时、道具组和 UI 测试更新为当前契约并通过。

## Comments

- 内置道具次数改为直接读取 `getDogV13ItemUses`；自定义运行时定义仍通过可选 `getUses` seam 并保留数值归一化。`DogItemState` 收敛为 ID、名称、剩余次数和可用状态；道具组编辑器继续从配置读取文案、从资源配置读取图标。
- 聚焦验证：`pnpm exec vitest run tests/item-runtime.test.ts tests/dog-loadout.test.ts tests/dog-lege-dog.test.ts tests/game-runtime-modules.test.ts tests/ui-rendering-modules.test.ts tests/special-ui.test.ts` — 6 个测试文件、83 个测试通过；`pnpm exec tsc --noEmit --pretty false` — 通过；`git diff --check` — 通过。
- `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 当前剩余 316 个诊断（源码 29、测试 287），较基线 322 个（源码 32、测试 290）减少 6 个；其余收口由 ticket 05 负责。`pnpm test:focused` 按 runner 规则因 runtime/public-contract 改动升级并拒绝，改跑 full profile。
- `pnpm test:qa` 最终通过：260 个 core 测试、4 个 Worker fallback 测试、3 个随机回归测试、24 个 Chromium E2E、18 个跨浏览器测试、pages build、diff check 与 19 个改动文件行数检查均通过。代码与测试 diff 为 26 行新增、101 行删除；未修改依赖或生成产物。
- code review：Standards 无硬性问题；Spec 发现的两个无消费者 re-export 已删除并重新验证。
