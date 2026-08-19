# 17 — 收敛游戏目录卡片与愉快音频反馈

**What to build:** 将游戏目录卡片改为紧凑的左右布局，左侧使用狗主题卡通涂鸦封面，右侧按游戏名、简介、关卡/积分、开始游戏顺序排列并移除绿色状态提示；替换为更轻快的本地开源循环音乐，降低背景音量并强化选取方块与三消成功音效的听感层次。

**Related to:** 16 — 天空蓝活动页视觉、音乐与 Pages 发布收敛

**Status:** done

## Acceptance Criteria

- [x] 游戏目录卡片在桌面与移动布局中均保持左图右文；封面不再占据整张卡片的主要高度。
- [x] 封面为代码内嵌的狗主题卡通涂鸦形象，不新增运行时图片依赖。
- [x] 卡片右侧按游戏名、简介、最高解锁关卡/累计积分、开始游戏顺序渲染。
- [x] 卡片不渲染绿色可玩状态圆点或等价状态提示。
- [x] 背景音乐替换为本地 CC0、可循环、偏轻快的音频资源；不依赖第三方运行时 CDN。
- [x] 背景音乐音量低于交互音效；音乐开关、首次用户交互初始化、暂停/恢复与持久化行为保持不变。
- [x] 选取方块与三消成功音效使用更清晰的多音符/旋律反馈，且不阻塞游戏流程。
- [x] UI 单测覆盖目录卡片结构与状态提示移除；现有游戏公开行为与音效开关测试继续通过。
- [x] 更新 spec.md 与 01–16 ticket 中发现的过期展示、音乐来源和测试命令描述。

## Verification

- `pnpm test:ui`
- `pnpm build:pages`
- `git diff --check`

## Comments

- 需求来源：2026-08-19 首页卡片与游戏音频反馈；附图只作为视觉参考。
- 音频候选：OpenGameArt 的 [Party and Gameover loop](https://opengameart.org/content/party-and-gameover-loop)，选用 `happy_theme_0.ogg`；来源页标注 CC0。
- 实现：目录卡片改为桌面/移动均为左图右文；移除 category 与绿色状态圆点；开始按钮统一为“开始游戏”；封面改为天空蓝狗主题代码内嵌涂鸦 SVG。
- 音频：保留 `audio/levelmusicloop-tigrun.ogg` 运行时路径以避免部署引用漂移，替换文件内容为 `happy_theme_0.ogg`；背景音量降至 `0.1`，选取/三消/通关/失败改为多音符 profile。
- 验证：`pnpm test:ui` 通过（3 files、27 tests）；`pnpm build:pages` 通过；`git diff --check` 通过。
