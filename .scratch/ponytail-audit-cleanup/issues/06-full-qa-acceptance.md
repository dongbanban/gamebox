# 06 — 完整 QA 验收

**What to build:** 对清理后的代码库执行一次完整验证，确认代码量减少且游戏合集、关卡尝试、特殊机制、道具、游戏进度和浏览器流程没有行为回归。

**Blocked by:** 05 — 死 helper、re-export 与无效绑定收口

**Status:** ready-for-agent

- [ ] `pnpm test:qa` 完整通过，不与 `pnpm test:affected` 叠加。
- [ ] full profile 覆盖核心测试、Worker fallback、随机回归、Chromium、跨浏览器、页面构建、diff 检查和改动文件行数检查。
- [ ] 相同 `runSeed` 的关卡生成与回放结果保持一致，1、6、16、31、99 关边界和特殊机制验证保持通过。
- [ ] 游戏目录、游戏启动、固定 8 种道具集合与 3 种道具组、暂存槽、三消、锁槽、结果页、游戏进度和响应式流程保持通过。
- [ ] 记录 no-unused 诊断、full QA 实际结果和最终代码行数变化，核对约 300 行减少的估算；不删除、替换或新增依赖与生成产物。
