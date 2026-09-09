# 02 — 普通选择增量更新棋盘与暂存槽

**What to build:** 玩家选择一个不触发三消的普通方块时，游戏只移除真实离开棋盘的方块并只更新目标暂存槽位，未变化方块和槽位保持原有 DOM 节点与交互状态。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 首次启动或进入全新关卡时仍可创建完整游戏 DOM，同一关卡尝试内后续更新改为按稳定方块 ID 增量同步。
- [x] 最新游戏状态继续是 DOM 的唯一事实来源；点击处理器不直接假设或补写最终棋盘与暂存槽结果。
- [x] 普通选择后只移除被选择的棋盘方块，所有仍存在且视觉身份未变化的棋盘方块复用原节点。
- [x] 暂存槽新增一个普通方块时只更新对应槽位，其他已填充、空闲或锁定槽位保持原节点。
- [x] 输入锁阶段与动画完成阶段原地同步方块的 `disabled`、目标状态、机制属性及 ARIA 名称，不通过节点重建切换状态。
- [x] 被选择方块下方新暴露的方块立即获得正确可点击状态，其他不可点击方块保持禁用。
- [x] 两阶段动画编排、飞入反馈、音效、Pointer Events 与根节点事件委托保持不变，一次触摸不会重复选择。
- [x] 棋盘适配只在首次渲染、视口 resize 或棋盘几何实际变化时运行，普通选择与输入锁切换不强制读取布局。
- [x] 简单选择的结构性回归测试确认：未变化棋盘和暂存槽节点不被移除后重新添加，且最终公开状态和 DOM 正确。
- [x] 实现使用原生 DOM 与现有 renderer seam，不引入 Vue、第三方 DOM diff、虚拟 DOM 或逐方块监听器。
- [x] 运行 `pnpm test:ui` 并记录结果；本 ticket 不运行完整 QA、affected 或 focused profile。

## Comments

- 2026-09-08：首次渲染保留完整 DOM；后续棋盘按稳定方块 ID 增量删除/同步，暂存槽按方块 ID 和槽位顺序复用槽位节点，并在原地同步交互、目标、机制 data attrs 与 ARIA 状态；棋盘适配增加几何变化守卫。
- 2026-09-08：新增公开 `startDogLegeDogGame` 结构回归测试，确认普通选择阶段只移除被选棋盘方块，未变化棋盘/暂存槽节点保持身份，输入锁与动画完成后可点击状态及公开 session snapshot 正确。
- 2026-09-08：`pnpm test:ui` 通过（17 files / 91 tests）；`pnpm exec tsc --noEmit --pretty false` 通过；`git diff --check` 通过；另行验证普通选择结构测试（1/1）、board UI（4/4）与 torch UI（5/5）通过。按本 ticket 要求未运行完整 QA、`pnpm test:affected` 或 `pnpm test:focused`。
- 2026-09-09：关联最终联合 QA ticket 07：`pnpm test:qa`、独立 `pnpm test:e2e:cross-browser`、`pnpm build:pages` 与 `git diff --check` 均通过；性能采样、普通选择与棋盘/暂存槽节点复用证据见 [07-performance-and-final-qa.md](07-performance-and-final-qa.md)。
