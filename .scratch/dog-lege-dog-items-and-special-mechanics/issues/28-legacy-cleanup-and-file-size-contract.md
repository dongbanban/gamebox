# 28 — 废弃逻辑、旧测试与兼容分支清理

**What to build:** 在 v13 行为稳定后清除旧生成策略、固定首关入口、重复 adapter、过时公共 API 与冲突测试；项目文件保持可导航、可测试、约 500 行以内。

**Blocked by:** 20 — v13 机制与难度收口；24 — 关卡模块迁移；25 — 运行时迁移；26 — UI/样式迁移；27 — 最新视觉与次数规则。

**Status:** done

- [x] 删除 v1–v12 生成兼容分支、固定首关常量、旧 replay 模式与不再使用的公共 wrapper。
- [x] 删除与 v13 规则冲突的单元测试、随机回归、视觉断言、旧动画时序断言与重复测试 helper。
- [x] 所有源码、测试与样式大文件拆分到约 500 行以内；行数守卫在后续改动中持续生效。
- [x] 保留 v13 runSeed 诊断、回放入口、奖励公式、公共进度隔离与当前领域契约。
- [x] 清理后 focused、smoke、full profile 均能定位到最新实现；不存在仅为兼容旧实现而保留的死代码。

## Comments

- 2026-08-27：删除 v1–v12 生成策略、固定首关入口、旧 replay/兼容 wrapper 与死配置；拆分配置、生成、测试模块，统一当前 v13 seam；保留 runSeed、replay metadata、奖励、进度隔离与领域契约。
- 2026-08-27：`pnpm typecheck`、`pnpm test:profile:unit`（5/5）、`pnpm test:focused`（192/192）通过。
- 2026-08-27：`pnpm test:smoke` 通过：core 217/217、fallback 1/1、随机 3/3、Chromium 1/1；`pnpm test:qa` 通过：core 217/217、fallback 1/1、随机 3/3、Chromium 19/19、跨浏览器 9/9、pages build、diff 与行数检查。
- 2026-08-27：全部当前 `src`、`tests`、`scripts` 文件 167 个均不超过 500 行；修复 nested test 受影响路径匹配，复核 Standards/Spec findings。
