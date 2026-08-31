# 05 — 死 helper、re-export 与无效绑定收口

**What to build:** 在前置契约清理完成后，删除剩余无调用 helper 和转发导出，清理源码与测试中的无效 import/参数，让仓库只保留可导航、可消费的名称。

**Blocked by:** 01、02、03、04

**Status:** ready-for-agent

- [ ] 删除无调用的随机选择、进度阶段、可解性和配置诊断 helper。
- [ ] 删除不再需要的转发 re-export，并保留仍由游戏目录、测试和运行时使用的入口。
- [ ] 清理源码和测试中的无效 import、参数与局部绑定，不改变测试 oracle 的独立性或测试意图。
- [ ] `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` 不再报告本次审计范围内的无效绑定。
- [ ] 代码库中不再存在被删除 API 的仓内调用或仅为旧路径保留的兼容分支。

