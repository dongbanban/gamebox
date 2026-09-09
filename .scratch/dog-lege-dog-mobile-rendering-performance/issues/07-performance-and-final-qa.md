# 07 — 联合性能复测与发布 QA

**What to build:** 发布者获得一套完成动效降载与增量 DOM 渲染后的联合证据，确认移动端持续负载和点击结构变化均已下降，同时所有游戏规则、浏览器流程和 Pages 构建保持可发布。

**Blocked by:** 01 — 收敛特殊方块常驻动效；04 — 幻化与冻结状态变化保持增量；05 — 磁吸与双生原子操作保持增量；06 — 乱序与复原保持暂存槽节点

**Status:** done

- [x] 使用同一关卡尝试与相同采样时长，在移动 Chromium 中记录优化后的常驻动画名称和数量、renderer/main-thread task time 及浏览器全进程 CPU time。
- [x] 性能结果与 spec 中的基线并列记录；百分比作为环境相关证据，不转换为实体手机固定温度或续航承诺。
- [x] 普通选择结构采样确认：只移除真实选择的棋盘方块，只更新目标暂存槽位，未变化节点不被移除后重新添加。
- [x] 三消、幻化、冻结、磁吸、双生、乱序、复原与全部道具路径不存在无条件棋盘或暂存槽全量重建。
- [x] 棋盘在移动竖屏、动态视口、桌面 resize 后继续正确缩放，完整暂存槽保持在可操作视口。
- [x] `prefers-reduced-motion`、键盘焦点、ARIA、输入锁、一次性动画、音效、粒子、通关、失败、重试和下一关行为保持正确。
- [x] ADR-0006、领域文档、集中配置和实际视觉行为一致，不残留已删除 pulse、切片、抖动或动画时长的死定义。
- [x] 运行一次 `pnpm test:qa` 并记录完整结果；此前 tickets 不补跑完整 QA。
- [x] 运行一次 `pnpm test:e2e:cross-browser` 并记录 Chromium、移动 Chromium 与 Safari/WebKit 结果。
- [x] 运行一次 `pnpm build:pages` 与 `git diff --check` 并记录结果，不与 `pnpm test:affected` 叠加。
- [x] 将本次批量 QA 结果关联回 tickets 01–06，使每个 ticket 都能定位最终验证记录。

## Comments

- 2026-09-09：可复查性能复测命令为先运行 `pnpm dev --host 127.0.0.1 --port 4173`，再运行 `DOG_PERFORMANCE_SOURCE_REVISION=working-tree-2349330-plus-focus-guard DOG_PERFORMANCE_SAMPLE_LABEL=optimized pnpm exec node scripts/dog-performance-sample.mjs`。runner 使用 Chromium 151.0.7922.34、headless、Pixel 5（393×727）、正常开启音效、固定 `runSeed=dog-performance-final-qa-2026-09-09`、首关同一关卡尝试与 8000ms 静置窗口。初始棋盘为 85 个物理方块、22 个特殊方块；常驻动画共 12 个，仅 `dog-illusion-mask` 6 个和 `dog-illusion-fuzzy-base` 6 个。CDP 增量：renderer `TaskDuration=0.011311s`、`ThreadTime=0.009722s`、`ProcessTime=0.373471s`；浏览器全进程 CPU `0.544161s`（GPU 0.108533s、audio 0.058615s、browser 0.003573s、network 0.000260s、renderer 0.373180s）。
- 2026-09-09：使用同一 runner、同一固定 seed、同一设备模式、同一音效设置与 8000ms 窗口，对比 pre-optimization commit `6840682`（临时 worktree 的 Vite 服务运行在 4174，并执行 `DOG_PERFORMANCE_URL=http://127.0.0.1:4174/ DOG_PERFORMANCE_SOURCE_REVISION=6840682 DOG_PERFORMANCE_SAMPLE_LABEL=baseline pnpm exec node scripts/dog-performance-sample.mjs`）：74 个常驻动画（`dog-freeze-*`、`dog-illusion-*`、`dog-magnetic-*`、`dog-special-shimmer`、`dog-twin-pulse`），`TaskDuration=1.102174s`、renderer `ProcessTime=1.643701s`、全进程 CPU `1.751465s`；普通选择结构累计棋盘直接子节点移除/添加 340/338、暂存槽 16/18。当前方案为 12 个动画、0.011311s、0.373471s、0.544161s、棋盘 1/0、暂存槽 0/0，分别低 83.78%、98.97%、77.28% 与 68.93%。这与 spec 历史基线（74 个动画、8 秒 main-thread task time 约 1.195s；完全停用约 0.003s；上一轮静态方案 34 个动画、task time 约低 99%、全进程 CPU 约低 59.6%）方向一致；所有百分比受浏览器、硬件和采样环境影响，不推导实体手机温度或续航。runner 的 `DOG_PERFORMANCE_URL`、`DOG_PERFORMANCE_SOURCE_REVISION` 与 `DOG_PERFORMANCE_SAMPLE_LABEL` 让两次采样使用同一测量逻辑并保留来源标识。
- 2026-09-09：同一固定尝试的普通选择结构采样选择 `level-1-block-14`：棋盘直接子节点移除 1、添加 0，且只移除该 ID；暂存槽直接子节点移除/添加均为 0，目标槽位复用，未变化棋盘节点复用；输入锁定期间为 true，动画后恢复为 false。
- 2026-09-09：公开入口的三消、幻化、冻结、磁吸、双生、乱序/复原与道具增量测试均通过；源码复核确认剩余 `dog-magnetic-attraction-effect__pulse` 仅为一次性吸引反馈，持续动画集合不含已删除 pulse、切片、抖动或旧乱序时长字段，集中配置使用 `shuffleFeedbackMs`。
- 2026-09-09：最终批量 QA（含焦点恢复与防抢焦点修复、reduced-motion 静态识别、Tab/Enter 键盘操作与跨浏览器退出覆盖、性能 runner）通过：`pnpm test:qa`（core 44 files / 287 tests、worker fallback 4 tests、random regression 3 tests、Chromium E2E 28 tests、cross-browser 30 tests、Pages build、diff check、4 个可检查文件的 500-line check）；独立 `pnpm test:e2e:cross-browser` 通过（30 tests，Chromium / mobile Chromium / Safari-WebKit）；`pnpm build:pages`、`git diff --check`、`pnpm typecheck` 与 35 个受影响核心测试通过。结果已关联回 tickets 01–06。
- 2026-09-09：按最终 Spec review 同步 ADR-0004 的过期视觉描述，明确静态特殊识别样式与机制标记遵循 ADR-0006；`git diff --check` 通过。其余为文档-only 收口，未重复运行测试。
