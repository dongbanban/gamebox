# 06 — 乱序与重玩综合收口

**What to build:** 收口乱序方块、动态阈值、复原哨与「重玩本关」的跨流程行为。验证锁槽/容量变化、动画、输入锁、事务快照、重新生成、回放、Worker/fallback、响应式布局与现有结果页重试之间没有状态竞态。补充机制恢复 ADR，完成发布前全量 QA。

**Blocked by:** 02 — 安全乱序与二次结算；03 — 乱序正式关卡生成、求解与回放；04 — 复原哨恢复乱序事务；05 — 重玩本关入口与新尝试

**Status:** done

- [x] 综合流程覆盖：乱序触发动画中点击重玩、复原动画中点击重玩、复原后重玩、重玩生成中重复点击与生成失败后重试。
- [x] 所有流程保持输入锁、旧计时器、旧动画、旧 Worker、旧快照与旧回放事件清理，不出现重复回调或旧局结果覆盖新局。
- [x] 乱序、复原哨、重玩本关与失败结果页重新挑战之间的文案、按钮状态、回放元数据与进度语义一致。
- [x] 响应式与跨浏览器流程验证关卡行按钮、槽内动效、复原反馈、加载态与结果态布局。
- [x] 新增 ADR，明确复原哨是乱序事务专属恢复，不是普通方块选择的通用撤销。
- [x] 运行 `pnpm test:qa`，包含核心、随机回归、Worker/fallback、Chromium、跨浏览器、构建、diff 与文件行数检查。

## Comments

- 2026-09-02：在应用关卡启动边界为已取消的关卡尝试隔离结果、进度、道具组与音效回调；重玩生成失败沿用失败 `runSeed` 重试。乱序触发与复原动画期间重玩按钮保持禁用，销毁关卡尝试时清理冻结融化计时器。复原哨事务边界沿用已存在的 ADR-0008。
- 聚焦验证：`pnpm test:focused` 按高风险改动规则拒绝并提示运行 full profile；定向 app、shuffle UI、restore UI 与 Chromium 检查通过；`pnpm typecheck` 通过。
- 批量 QA：最终 `pnpm test:qa` 通过：core 260、Worker/fallback 4、random 3、Chromium 24、cross-browser 18、Pages build、`git diff --check` 与 `node scripts/check-file-lines.mjs --changed --max-lines 500`（10 个文件）。
