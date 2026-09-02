# 05 — 重玩本关入口与新尝试

**What to build:** 在关卡数同一行最右侧增加「重玩本关」按钮。按钮点击后直接结束当前局内状态，按既有重试生命周期为同一关生成新的 `runSeed`，重新验证并展示新棋盘。当前道具组与跨关进度保留，所有旧局内状态清空。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 关卡数行最右侧显示「重玩本关」文字按钮，与关卡编号、特殊机制说明入口保持同一行；窄屏下文案与点击区域完整。
- [x] 按钮在当前关卡准备态、进行态可用；生成中、道具选择、目标选择、动画结算、结果页、销毁状态与输入锁定期间禁用或不渲染。
- [x] 点击后不弹二次确认，直接结束旧局并创建同一关的新尝试与新 `runSeed`；重复点击只处理一次。
- [x] 重玩清空暂存槽、已选方块、局内道具次数、乱序状态、复原快照、动画、反馈与计时；当前已确认的道具组保持不变。
- [x] 重玩不改变已完成关卡、奖励、最高解锁关卡、用户设置或其他跨关进度；旧 `runSeed` 与旧局内状态不保留。
- [x] 新棋盘完成验证前显示统一加载态；Worker 失败沿用同步 fallback，验证失败显示生成错误与重试入口，不展示未验证棋盘。
- [x] 新 `runSeed` 写入回放元数据；UI、生命周期、窄屏布局、可访问标签与状态重建测试覆盖上述行为。

## Comments

- 2026-09-02：关卡行新增配置驱动的「重玩本关」按钮；仅在 ready/playing 显示可用，加载、道具选择、目标选择、动画与终局期间原生禁用，保持窄屏点击区域与可访问名称。
- 2026-09-02：活动重玩复用现有 `disposeActiveGame` + `renderGameEntry` 生命周期，销毁旧局并生成同关新 `runSeed`；保留已确认道具组与进度，生成期间显示加载态，失败沿用 fallback/错误重试与回放元数据校验。
- 2026-09-02：新增 UI、活动重玩 guard/状态重建与响应式 E2E 覆盖；快速重复激活只处理一次，300ms guard 后允许下一次主动重玩。
- 2026-09-02：终版 review 后将重复激活窗口改为可重置的时间 guard，离开/重进不会继承旧请求；快速激活回归通过。
- 验证：`pnpm test:ui`（7 files、86 passed）；`pnpm typecheck`；`pnpm test:qa`（full profile passed：core 256、Worker/fallback 4、random 3、Chromium 21、cross-browser 9、Pages build、diff-check、file-line-check）；`git diff --check`；`node scripts/check-file-lines.mjs --changed --max-lines 500`。
