# 06 — 完整 QA 验收

**What to build:** 对清理后的代码库执行一次完整验证，确认代码量减少且游戏合集、关卡尝试、特殊机制、道具、游戏进度和浏览器流程没有行为回归。

**Blocked by:** 05 — 死 helper、re-export 与无效绑定收口

**Status:** done

- [x] `pnpm test:qa` 完整通过，不与 `pnpm test:affected` 叠加。
- [x] full profile 覆盖核心测试、Worker fallback、随机回归、Chromium、跨浏览器、页面构建、diff 检查和改动文件行数检查。
- [x] 相同 `runSeed` 的关卡生成与回放结果保持一致，1、6、16、31、99 关边界和特殊机制验证保持通过。
- [x] 游戏目录、游戏启动、固定 8 种道具集合与 3 种道具组、暂存槽、三消、锁槽、结果页、游戏进度和响应式流程保持通过。
- [x] 记录 no-unused 诊断、full QA 实际结果和最终代码行数变化，核对约 300 行减少的估算；不删除、替换或新增依赖与生成产物。

## Comments

- no-unused：`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 通过，0 个诊断。
- 聚焦检查：未运行 `pnpm test:focused`；本票是跨生成器、运行时、公共契约、游戏启动和浏览器流程的完整验收，spec 要求由完整 QA 直接替代。
- 完整 QA：`pnpm test:qa` 通过；full profile 依次完成 core（18 文件 / 260 测试）、Worker fallback（4）、随机回归（3，固定 `v13-full-a`）、Chromium（24）、Safari/移动 Chromium 跨浏览器（18）、Pages build、`git diff --check` 和改动文件行数检查。profile 固定覆盖关卡 1、2、3、6、16、31、99 与 `v13-full-a` / `v13-full-b`；未运行 `pnpm test:affected`。
- 相对清理开始前的 `8d7e29f`，`src`、`tests`、`scripts` 与 `public` 共 274 行新增、1169 行删除，净减 895 行，超过约 300 行的估算；`package.json` 与 `pnpm-lock.yaml` 无变化，未留下生成产物。
