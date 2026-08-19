# 16 — 收敛游戏目录卡片与愉快音频反馈

**What to build:** 将游戏目录卡片改为紧凑的左右布局，左侧使用狗主题卡通涂鸦封面并撑满卡片高度，右侧按缩小后的游戏名、简介、最高解锁关卡与开始游戏顺序排列；目录卡片不展示累计积分、不展示绿色状态提示；替换为更轻快的本地开源循环音乐，降低背景音量并强化选取方块与三消成功音效的听感层次。

**Related to:** 15 — 天空蓝活动页视觉、音乐与 Pages 发布收敛

**Status:** done

## Acceptance Criteria

- [x] 游戏目录卡片在桌面与移动布局中均保持左图右文；卡片整体高度收敛，左侧封面完整撑满卡片高度。
- [x] 封面使用项目内的狗主题 SVG 卡通涂鸦资源，不依赖第三方运行时 CDN。
- [x] 卡片右侧按缩小后的游戏名、简介、最高解锁关卡与开始游戏顺序渲染；最高解锁关卡与开始游戏位于同一行。
- [x] 游戏目录卡片不渲染累计积分；累计积分仍可在通关结果页展示。
- [x] 最高解锁关卡与开始游戏动作行显式清除 `dl` 默认外边距，避免右侧 grid 行高被浏览器默认样式拉伸。
- [x] 开始游戏按钮只展示文字，不附加箭头等装饰图标；移动端缩略图使用覆盖模式撑满左侧区域。
- [x] 卡片不渲染绿色可玩状态圆点或等价状态提示。
- [x] 背景音乐替换为本地 CC0、可循环、偏轻快的音频资源；不依赖第三方运行时 CDN。
- [x] 背景音乐音量低于交互音效；进入活动游戏时沿用户启动点击链初始化，首次方块操作可重试，暂停/恢复与持久化行为保持不变。
- [x] 选取方块与三消成功音效使用更清晰的多音符/旋律反馈，且不阻塞游戏流程。
- [x] UI 单测覆盖目录卡片结构与状态提示移除；现有游戏公开行为与音效开关测试继续通过。
- [x] 更新 spec.md 与 01–15 ticket 中发现的过期展示、音乐来源和测试命令描述。

## Verification

- `pnpm test:ui`
- `pnpm build:pages`
- `pnpm test:e2e:cross-browser`
- `git diff --check`

## Comments

- 需求来源：2026-08-19 首页卡片与游戏音频反馈；附图只作为视觉参考。
- 音频候选：OpenGameArt 的 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop)，选用 `happy_theme_0.ogg`；来源页标注 CC0。
- 实现：目录卡片改为桌面/移动均为左图右文；移除 category 与绿色状态圆点；开始按钮统一为“开始游戏”；封面改为项目内第 10 项“傻狗” SVG 涂鸦资源。
- 音频：保留 `audio/levelmusicloop-tigrun.ogg` 运行时路径以避免部署引用漂移，替换文件内容为 `happy_theme_0.ogg`；背景音量降至 `0.1`，选取/三消/通关/失败改为多音符 profile。
- 验证：`pnpm test:ui` 通过（3 files、28 tests）；`pnpm build:pages` 通过；`pnpm test:e2e:cross-browser` 通过（Chromium、mobile Chromium、Safari 3/3）；`git diff --check` 通过。
- 后续视觉调整：目录卡片移除累计积分；最高解锁关卡与开始游戏同排；游戏名缩小；卡片高度压缩；左侧缩略图随卡片高度撑满。验证：`pnpm test:ui` 通过（3 files、28 tests）；`pnpm build:pages` 通过；`pnpm test:e2e:cross-browser` 通过（Chromium、mobile Chromium、Safari 3/3）；`git diff --check` 通过。
- 行高异常修复：重置 `.catalog-item__level` 的 user-agent `dl` 外边距，动作行在 390×844 视口回归中从 104px 收敛到 72px；保留 Playwright 几何断言。
- 本轮专项验证：`pnpm exec playwright test tests/e2e/register-catalog.spec.ts --grep "动作行" --project=chromium` 通过；`pnpm test:e2e:cross-browser` 通过（Chromium、mobile Chromium、Safari 3/3）。完整 `register-catalog.spec.ts` 另有既存暂存槽边框断言失败，与本次目录卡片行高改动无关。
- 后续视觉修正：移动端缩略图改为 `object-fit: cover`；“开始游戏”移除箭头图标；回归测试锁定 cover 覆盖模式与按钮纯文字。
- 本轮验证：`pnpm exec playwright test tests/e2e/register-catalog.spec.ts --grep "动作行" --project=chromium` 通过（1/1）；`pnpm test:ui` 通过（3 files、28 tests）；`pnpm build:pages` 通过；`pnpm test:e2e:cross-browser` 通过（Chromium、mobile Chromium、Safari 3/3）；`git diff --check` 通过。
- 后续修复见 ticket 18：默认开启音乐在活动游戏 `start()` 内立即初始化；暂存槽图案缩入槽内完整展示；旧的独立方块面积放大与 z 方向二维平移移除，避免视觉覆盖比例偏离逻辑 `1/2`、`1/4`。ticket 16 编号与历史验证记录保留。
