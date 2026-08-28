# 11 — 生成加载、后台预生成与最终 QA

**What to build:** 将 v13 已验证生成接入第一关、重开、重试与下一关流程；提供加载态、后台预生成、Worker/同步重试与严格错误恢复；完成最新道具、特殊机制、模块拆分与测试 profile 的全链路 QA。

**Blocked by:** 20 — v13 机制与难度收口；23 — 测试 profile 与生成流程控制；26 — App/渲染/样式迁移；28 — 废弃逻辑与旧测试清理。

**Status:** done

## Implementation alignment

- 仓库当前关卡上限为 99；随机回归范围统一为连续前缀 1–99。
- 原有 full profile 勾选项只验证生成器 fallback，尚未验证 Worker 生命周期；两项改为本票实施后再勾选。

## V13 current acceptance
- [x] 进入第一关、重开、重试及进入随机下一关时，在验证完成前显示加载态，不展示未验证棋盘。
- [x] 生成期间主界面保持可响应；优先使用 Worker 或等效后台执行，避免主线程长时间阻塞。
- [x] Worker 失败后执行严格同步重试；两条路径都失败时显示可恢复错误并保留 runSeed、生成器版本与失败诊断，不展示未验证候选。
- [x] 当前关卡完成后后台预生成下一关；候选只有通过完整结构、组合、可解性、难度与回放验证后才能复用，失败候选自动丢弃。
- [x] 重试、刷新、道具组变更与预生成保持生命周期语义：新尝试使用新 runSeed；失败换组沿用原尝试；通关换组作用于下一关。
- [x] 端到端覆盖普通方块、冻结、幻化、火把、万能方块、检测仪、三消移除、容量提升、双生、磁吸、消磁仪、锁槽、钥匙与多机制组合。
- [x] 视觉 QA 覆盖普通棋盘视觉下的幻化/双生、幻化入槽揭示、检测仪原位揭示、双生分裂、磁吸吸引、消磁、锁槽解锁、钥匙掉落、道具反馈与输入锁。
- [x] 动画时序、输入锁与结果状态来自 v13 集中配置；不继续把旧 240ms、620ms、360ms 基线当作当前验收硬编码。
- [x] full profile 完成核心、随机、Chromium、WebKit、移动 Chromium、Worker/fallback、页面构建、diff 与文件行数检查；Worker/fallback 生命周期验证由本票补齐，ticket 记录实际命令、结果与失败修复。
- [x] full profile 覆盖排除 E2E/随机回归的核心 Vitest、随机 1–99 前缀、关键边界、Chromium、WebKit、移动 Chromium、Worker/fallback、页面构建、diff 检查与文件行数检查；随机回归校验 `floor(N × 0.30)`、四类数量随 `N` 增长、双生权重与密度不超上限。
## Historical pre-v13 acceptance (superseded)
- [ ] 进入第一关、重开、重试及进入随机下一关时，在验证完成前显示加载态，不展示未验证棋盘。
- [ ] 生成耗时期间主界面保持可响应；优先使用 worker 或等效后台执行，避免主线程长时间阻塞。
- [ ] 玩家完成当前关卡后后台预生成下一关候选；预生成结果通过完整验证后才能复用，失败候选自动丢弃。
- [ ] 生成异常或达到尝试上限时提供可恢复流程，并保留可复现的 `runSeed`、生成器版本和失败诊断信息；不得展示未验证死局。
- [ ] 重试、刷新、切换道具组与预生成流程保持已确认生命周期语义：新尝试使用新 `runSeed`；道具组只在准备态或挑战结束后更换；失败换组沿用原 `runSeed`，通关换组作用于下一关。
- [ ] 完成普通方块、冻结、幻化、火把、万能方块、检测仪、三消移除、容量提升、双生、磁吸、消磁仪、锁槽、钥匙与多机制组合的端到端流程验证。
- [ ] 完成视觉 QA：所有特殊机制持续静态识别；幻化揭示、检测仪原位揭示、磁吸吸引、消磁、双生分裂、锁槽解锁、钥匙掉落、万能方块高亮、火把融化与三消补充均有可观察反馈；不新增必须显示的文字状态。
- [ ] 沿用现有动画基线进行校验：方块飞行约 240ms、三消效果约 620ms、道具初始反馈约 360ms；胜负结算不被并发输入打断。
- [ ] 完成随机回归、生成器/核心测试、UI 测试、端到端测试及跨浏览器测试；覆盖逻辑方块单位、锁槽有效容量、独立随机流、钥匙掉落与特殊机制原子失败；ticket 记录实际命令与结果，生成器/跨模块验证使用 `pnpm test:qa`，UI 改动使用 `pnpm test:ui`，响应式改动追加 `pnpm test:e2e:cross-browser`。

## Shared QA Contract

以下条目承接旧 hardening ticket 19；本 ticket 完成后，ticket 19 不再作为独立实现入口。

- [x] `test:core` 明确排除 `tests/e2e/**` 与随机回归；`pnpm test:qa` 按核心 Vitest → 随机回归 → Chromium E2E 顺序执行，任一步失败立即退出。
- [x] `test:affected` 的生成器路径匹配适配当前 `src/games/dog-lege-dog/levels/` 目录与 `@/*` import graph；生成器、特殊机制、可解性或难度改动不会漏跑随机回归。
- [x] 测试共用内存 storage、不可用 storage、几何 oracle、首关/随机尝试通关驱动、浏览器对话框、道具组流程与关卡流程助手，不保留行为相同的重复实现。
- [x] 随机回归使用版本化固定 `testSeed` 生成 1–99 个连续前缀并固定覆盖关键关卡；每个尝试显式记录 `runSeed`，失败报告包含 `testSeed`、`runSeed`、关卡号、生成器版本与单关重放入口。
- [x] 相同 `runSeed` 与生成器版本完整复现关卡；不同 `runSeed` 验证随机尝试确实可变化；公共进度不保存棋盘、暂存槽、次数、半局状态或 `runSeed`。
- [x] `pnpm test:e2e:cross-browser` 覆盖 Safari（Playwright WebKit）与移动 Chromium；`pnpm build:pages`、`git diff --check` 与实际测试数/失败修复记录同步更新。

## Comments

- 2026-08-25：按 v13 升级方案重写为最终集成与 QA 门槛。旧视觉与动画基线保留在 Historical 区域；当前验收以集中配置、普通幻化/双生棋盘视觉、入槽反馈、Worker/fallback 与 full profile 为准。文档-only 同步，未运行测试。
- 2026-08-26：承接 ticket 23 移交的 full profile 端到端执行与 v13 生成断言，待 ticket 24 完成生成器迁移后统一验证。
- 2026-08-26：ticket 24 完成生成器迁移后，`pnpm test:qa` 全量通过：核心 14 files/227 tests、随机 3/3、Chromium 19/19、跨浏览器 9/9、页面构建、diff 与 37 文件行数检查。其余加载态、Worker/fallback 生命周期与视觉集成验收仍待本票完成。
- 2026-08-28：完成 Worker 优先生成、严格同步 fallback、双路径诊断、同 `runSeed` 恢复重试、加载态、离开时 abort、通关后下一关预生成与已验证候选复用；Dog 公开直接启动也在发布前执行 replay verification。浏览器视觉检查确认生成后普通棋盘、道具组、暂存槽与机制层正常渲染。
- 2026-08-28：TDD 目标验证先红 2 项（普通启动异常被误报为生成错误、直接启动未执行 replay），修复后 `pnpm exec vitest run tests/app.test.ts tests/dog-lege-dog.test.ts` 为 2 files/51 tests 全绿；`pnpm exec vitest run tests/generation-lifecycle.test.ts` 为 4/4。
- 2026-08-28：首轮 `pnpm test:qa` 在 Chromium 暴露 6 项旧 E2E 竞态：共享 `confirmDogLoadout` 在异步生成期间提前返回。修复为等待道具组面板或摘要后，`pnpm exec playwright test tests/e2e/register-catalog.spec.ts --project=chromium` 为 10/10。
- 2026-08-28：最终 `pnpm test:qa` 全绿：核心 18 files/230 tests、Worker/fallback 4/4、随机 1–99 前缀/关键边界/99 关压力 3/3、Chromium 21/21、Safari WebKit 与移动 Chromium 9/9、Pages build、`git diff --check`、28 个变更文件行数检查。
