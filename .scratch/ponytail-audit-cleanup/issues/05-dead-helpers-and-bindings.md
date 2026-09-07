# 05 — 死 helper、re-export 与无效绑定收口

**What to build:** 在前置契约清理完成后，删除剩余无调用 helper 和转发导出，清理源码与测试中的无效 import/参数，让仓库只保留可导航、可消费的名称。

**Blocked by:** 01、02、03、04

**Status:** done

- [x] 删除无调用的加权随机选择、进度阶段、安全选择计数和配置诊断 helper。
- [x] 删除不再需要的转发 re-export，并保留仍由游戏目录、测试和运行时使用的入口。
- [x] 清理源码和测试中的无效 import、参数与局部绑定，不改变测试 oracle 的独立性或测试意图。
- [x] `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` 从基线的 322 个诊断（32 个源码、290 个测试）降为零。
- [x] 代码库中不再存在被删除 API 的仓内调用或仅为旧路径保留的兼容分支。

## Comments

- 删除 `weightedPick`、进度阶段 wrapper/index helper、`countSafeChoices` 和无消费者的配置断言/诊断 helper；配置加载继续在冻结前收集并抛出原有诊断，狗游戏入口及现有运行时 seam 保持不变。
- no-unused 验证：`pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false` 通过，项目基线 322 个诊断（本票开始时前置清理已降至 314 个）收口为 0。
- 聚焦检查：未运行 `pnpm test:focused`；本票涉及公共契约、生成器、运行时和测试基础设施，按仓库规则由完整 QA 直接替代。
- 批量 QA：`pnpm test:qa` 通过（core 260、Worker fallback 4、随机回归 3、Chromium 24、跨浏览器 18、Pages build、diff check、49 个文件行数检查）。未运行 `pnpm test:affected`。
- 代码与测试 diff 为 16 行新增、635 行删除（净减 619 行）；未修改依赖清单或生成产物。
- Standards review 无问题；Spec 复验曾触发 `dog-lege-dog.test.ts` 单例 5 秒瞬时超时，随后重跑完整入口 21/21 通过，原失败用例耗时 2.482 秒；无需代码修复，ticket 状态保持 `done`。
