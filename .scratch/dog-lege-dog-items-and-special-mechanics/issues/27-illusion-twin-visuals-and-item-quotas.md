# 27 — 幻化/双生视觉收口与道具次数规则

**What to build:** 幻化方块、双生方块在棋盘与机制说明缩略图恢复原有持续特殊视觉动效；幻化保留伪装图案、mask/fuzzy，双生保留双生标记；机制 data attrs、暂存槽视觉与入槽揭示/分裂反馈保持不变；非钥匙道具统一为每关一次。

**Blocked by:** 22 — 规则配置；25 — 游戏运行时边界；26 — 渲染与样式 seam。

**Status:** done

- [x] 幻化方块在棋盘与机制说明缩略图显示伪装图案，并恢复特殊边框、阴影、mask/fuzzy 与持续识别动效；机制 data attrs 保留。
- [x] 双生方块在棋盘与机制说明缩略图恢复特殊边框、阴影、持续识别动效与“2”标记；暂存槽视觉不变。
- [x] 幻化直接点击后先按现有时序飞入暂存槽，飞行期间保持伪装图案且不显现真实图案，入槽完成后再揭示真实图案；检测仪继续支持原位揭示。
- [x] 双生进入暂存槽后继续播放分裂反馈，并生成两个相邻普通方块；磁吸吸入双生时沿用该反馈。
- [x] 道具三消移除、容量提升、万能方块、火把、检测仪、消磁仪每关最多成功使用 1 次；取消、无效目标与失败不扣次。
- [x] 钥匙仍以锁槽数量为本局次数上限，初始 0，按已确认掉落规则增加；钥匙不受统一 1 次限制。
- [x] 道具摘要、机制说明、棋盘持续动效、入槽反馈与 UI 单测覆盖新规则；`prefers-reduced-motion` 继续关闭非必要动画。

## Comments

- 2026-08-27：棋盘方块增加 `dog-block--board` scope，仅停用幻化/双生根识别 pulse；fuzzy、mask、共享 shimmer、其他样式与入槽反馈保留。机制说明缩略图改用真实普通图案，不带特殊视觉 class/icon。
- 2026-08-27：按当前 ticket/spec 修正 CONTEXT 与 ADR-0006；旧 ADR 的“移除 fuzzy/mask/常驻视觉”表述已不再适用。v13 非钥匙次数测试删除旧机制 bonus 断言，保留 legacy adapter。
- 2026-08-27：`pnpm test:focused` 14 files / 207 tests 通过；`pnpm test:ui` 57/57 通过；`pnpm typecheck` 通过。`pnpm test:qa` 核心 236/236、fallback 1/1、随机回归 3/3 通过；首次 Chromium 因沙箱禁止 `127.0.0.1:4173` 监听中止，权限外重跑 `pnpm test:e2e` 19/19、`pnpm test:e2e:cross-browser` 9/9、`pnpm build:pages`、`git diff --check` 与文件行数检查均通过。
- 2026-08-27：需求改为棋盘普通视觉收口：幻化/双生不输出特殊视觉 class，不显示特殊边框/阴影/遮罩、fuzzy、常驻动效或机制图标；机制 data attrs、幻化伪装图案、暂存槽揭示/分裂反馈保留。代码仅调整 UI renderer/CSS 与 UI 断言，不改规则逻辑。
- 2026-08-27：最新实现移除 board renderer 上幻化/双生 special class、fuzzy/mask 入口与常驻图标伪元素；保留机制 data attrs、幻化伪装图案、暂存槽揭示/分裂反馈。`pnpm test:ui` 7 files / 74 tests 通过；未运行逻辑、随机、E2E、构建测试。
- 2026-08-27：补正文案时序：幻化飞行期间只显示伪装图案，入槽完成后才显现真实图案；同步 UI 机制说明、CONTEXT、ADR 与测试标题/断言。
- 2026-08-27：修正机制说明文案与相关上下文：删除“飞行过程中显现真实图案”，统一为“入槽完成后显现”；`pnpm test:ui` 7 files / 74 tests 通过。
- 2026-09-07：需求调整为恢复幻化/双生在棋盘与机制说明缩略图中原有的持续特殊视觉动效；复用既有 special class、mask/fuzzy、pulse 与双生标记，不改变机制规则、幻化揭示时序或双生分裂时序。
- 2026-09-07：`pnpm test:ui` 7 files / 90 tests、`pnpm exec tsc --noEmit --pretty false` 与 `git diff --check` 通过；未运行逻辑、随机、E2E 或构建测试。
