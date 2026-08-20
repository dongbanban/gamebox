# Gamebox Vue 3 渐进迁移

Status: ready-for-agent

## Problem Statement

当前 Gamebox 已完成用户注册、游戏目录、活动关卡、通关、失败、游戏进度持久化与无限关卡闭环。关卡生成、可解验证、局内规则、游戏进度、音频、动画与粒子效果已经形成独立实现；应用 shell 仍通过原生 TypeScript 手动拼接 HTML、委托 DOM 事件、更新按钮、管理 History State，并负责活动游戏生命周期。

应用 shell 同时承担页面渲染、用户操作、游戏启动、通关奖励写入、下一关校验、音效同步、离开保护与浏览器历史恢复。新增页面、扩展游戏目录或调整交互时，需要维护较大的命令式实现与大量 DOM 查询。应用行为虽有较完整测试保护，但 UI implementation 的局部修改成本持续增长。

直接将整个项目重写为 Vue 会破坏已稳定的深模块，扩大回归范围，并把关卡生成、可解搜索、`GameSession`、`ProgressStore`、Canvas、音频与 Web Animations 等不需要框架的实现卷入迁移。一次性切换也会让导航、结果确认、奖励幂等、游戏销毁与离开保护同时失去旧实现作为对照，难以快速定位问题或回滚。

项目需要一条渐进、可验证、可回滚的 Vue 3 迁移路径：Vue 先接管应用 shell，既有游戏继续通过稳定的游戏启动 interface 挂载；新旧 shell 在生产切换前并行满足同一行为契约；切换稳定后再删除原生 shell。棋盘是否 Vue 化由后续实际收益决定，不作为本轮迁移前提。

## Solution

引入 Vue 3、Composition API、Single-File Components 与 Vue SFC 类型检查。Vue 只接管注册、游戏目录、活动游戏外壳、结果页及其导航状态。现有全局 CSS、DOM 语义、ARIA、可观察文案与浏览器流程保持不变。

保留 `mountApp(root, options)` 作为应用最高测试 seam。调用方继续只负责提供挂载根元素、可选的 `ProgressStore` 与游戏目录，并在结束时调用 `destroy()`。原生 shell 与 Vue shell 在迁移期同时实现这一个 interface；生产入口继续使用原生 shell，直到 Vue shell 通过共享行为契约、Chromium 流程、跨浏览器 smoke 与 Pages 构建验证。

保留现有 `GameDefinition`、`GameLauncher`、`GameLaunchContext` 与 `GameLaunchHandle`。Vue 活动游戏宿主只提供一个空 DOM 容器，在挂载时调用游戏 launcher，在卸载前调用游戏 handle 的 `destroy()`，在音效设置变化时调用可选的 `setSoundEnabled()`。棋盘、暂存槽、局内音频、Canvas 粒子与 Web Animations 继续由「狗了个狗」现有实现管理。

应用状态使用单一判别状态表达注册、游戏目录、活动游戏与结果四种页面。`ProgressStore` 保持非 Vue 的持久化深模块；每次写入后获取新 snapshot 替换视图状态，不增加 Pinia 转发层。当前导航继续使用 History State，不引入 Vue Router。retry 与下一关通过递增的启动身份强制创建全新局内状态，避免同一 game ID 与关卡号导致 Vue 复用旧宿主。

迁移采用并行 adapter 策略：先建立 Vue 工具链、稳定公共挂载 interface、整理共享行为契约，再按注册、游戏目录、活动游戏宿主、结果、导航与离开保护顺序实现 Vue shell。Vue shell 完整通过验证后，单独提交生产切换；原生 shell 保留一个提交周期作为快速回滚点，随后删除旧 implementation 与只覆盖旧内部结构的测试。

## User Stories

1. 作为首次访问用户，我希望 Vue 迁移后仍能完成匿名注册，以便立即进入游戏目录。
2. 作为回访用户，我希望有效游戏进度继续从当前浏览器恢复，以便迁移不丢失已完成关卡、最高解锁关卡、累计积分与设置。
3. 作为浏览器数据损坏的用户，我希望应用继续进入临时运行模式并显示持久化警告，以便框架迁移不会造成白屏。
4. 作为用户，我希望游戏目录继续按静态配置顺序展示游戏，以便迁移不改变发现游戏的方式。
5. 作为用户，我希望游戏目录继续展示游戏名称、简介、封面、最高解锁关卡与开始操作，以便页面信息保持一致。
6. 作为用户，我希望可以取消重置本地数据，以便误触不会清除用户、游戏进度、累计积分与设置。
7. 作为用户，我希望确认重置后回到注册页，以便重置行为在 Vue shell 中保持完整。
8. 作为用户，我希望点击可玩的游戏后进入当前最高解锁关卡，以便现有启动路径不变。
9. 作为用户，我希望不可玩的游戏继续不能启动，以便游戏目录约束不被 UI 迁移绕过。
10. 作为用户，我希望非法或未解锁关卡请求继续被拒绝，以便线性解锁规则不变。
11. 作为活动关卡用户，我希望棋盘、方块、暂存槽、三消、音频、动画与粒子反馈保持原体验，以便 shell 迁移不改变游玩规则。
12. 作为活动关卡用户，我希望切换音效后设置立即生效并持久化，以便刷新或重新进入时保持选择。
13. 作为活动关卡用户，我希望返回游戏目录时继续收到离开确认，以便避免误丢半局。
14. 作为活动关卡用户，我希望取消离开后保留当前棋盘、暂存槽与输入状态，以便当前关卡不会被重建。
15. 作为活动关卡用户，我希望确认离开后丢弃半局并回到游戏目录，以便游戏进度模型保持不保存半局的约定。
16. 作为活动关卡用户，我希望浏览器后退、刷新与关闭继续触发对应离开保护，以便不同离开方式行为一致。
17. 作为已确认通关或失败的用户，我希望离开保护立即解除，以便结果动画期间不会收到无效的半局提示。
18. 作为通关用户，我希望通关奖励在结果动画完成前可靠记录，以便刷新或页面变化不会丢失首次通关结果。
19. 作为通关用户，我希望重复结果回调不会重复增加累计积分，以便奖励保持幂等。
20. 作为通关用户，我希望结果页继续展示当前关卡、通关奖励、累计积分与下一关，以便迁移不减少反馈。
21. 作为通关用户，我希望可以直接进入刚解锁的下一关，以便连续推进无限关卡。
22. 作为失败用户，我希望结果页继续提供重新挑战与返回游戏目录操作，以便失败恢复路径不变。
23. 作为重试用户，我希望同一关创建全新棋盘与暂存槽状态，以便不会继承上一局过程。
24. 作为进入下一关的用户，我希望新关卡创建全新局内状态，以便上一关状态不会泄漏。
25. 作为用户，我希望关卡生成或游戏启动失败时安全返回游戏目录，以便异常不会造成空白页或残留离开保护。
26. 作为移动端用户，我希望迁移后棋盘与完整暂存槽继续位于可操作视口，以便无需页面滚动即可游玩。
27. 作为桌面端用户，我希望活动游戏布局、品牌、返回图标与音效入口位置保持一致，以便迁移不引入视觉回归。
28. 作为使用辅助技术的用户，我希望按钮、标题、状态与返回图标继续拥有正确语义和可访问名称，以便迁移不降低基础无障碍支持。
29. 作为 Safari 或移动 Chromium 用户，我希望注册、游戏目录与活动游戏继续可用，以便 Vue shell 不只适配桌面 Chromium。
30. 作为 GitHub Pages 用户，我希望所有脚本、样式、SVG、音乐与游戏封面继续从 `/gamebox/` 子路径正确加载，以便部署方式不变。
31. 作为维护者，我希望应用调用方继续只依赖 `mountApp()` 与 `destroy()`，以便 Vue implementation 不扩散到项目其他模块。
32. 作为维护者，我希望新增游戏继续只需提供游戏定义与 launcher，以便游戏可以使用原生 DOM、Canvas、Vue 或其他实现。
33. 作为维护者，我希望公共 shell 继续不知道“暂存槽”“三消”“可点击方块”等游戏专属规则，以便不同游戏复用相同 shell。
34. 作为维护者，我希望 `ProgressStore` 继续独立于 Vue，以便持久化、数据校验与临时运行降级可以通过现有 interface 测试。
35. 作为维护者，我希望关卡生成、可解搜索、难度、奖励与重放实现不导入 Vue，以便领域规则保持框架无关。
36. 作为维护者，我希望原生 shell 与 Vue shell 在切换前通过同一行为契约，以便差异可在生产切换前发现。
37. 作为维护者，我希望生产切换集中在一个小提交，以便出现问题时可以快速 revert。
38. 作为维护者，我希望 Vue shell 稳定后删除原生 shell，以便项目不长期维护双实现。
39. 作为维护者，我希望迁移测试观察用户行为而不是 Vue 内部实现，以便以后调整 SFC 结构不需要重写测试。
40. 作为测试者，我希望现有 `data-*`、ARIA、角色与用户可见文案在迁移期保持稳定，以便 Playwright 流程继续提供高层回归保护。
41. 作为测试者，我希望 Vue 异步 DOM 更新通过明确的 flush helper 处理，以便测试不会要求生产代码同步刷新视图。
42. 作为测试者，我希望游戏 launcher 的启动、音效同步与销毁次数得到行为验证，以便 Vue 生命周期不会造成重复事件、音频或 Canvas。
43. 作为开发者，我希望 Vue 不深度代理游戏定义、游戏 handle、DOM 与不可变关卡对象，以便避免不必要代理和性能成本。
44. 作为开发者，我希望全局 CSS 在首轮迁移中保持不变，以便框架迁移与视觉重构可以分别定位回归。
45. 作为开发者，我希望 Pinia 与 Vue Router 只在出现明确需求时引入，以便当前迁移不增加浅状态层与无收益路由抽象。
46. 作为开发者，我希望棋盘 Vue 化作为独立后续决策，以便先获得 shell 的维护收益，再用性能和变化频率判断第二阶段价值。
47. 作为发布者，我希望迁移完成前后都能运行权威 QA、跨浏览器验证与 Pages 构建，以便发布风险可量化。
48. 作为发布者，我希望记录迁移前后构建产物大小与关键流程结果，以便了解引入 Vue 的实际成本。

## Implementation Decisions

### Architecture

- 使用 Vue 3、Composition API、Single-File Components 与 `<script setup lang="ts">` 实现应用 shell。
- Vue shell 只负责注册、游戏目录、活动游戏外壳、结果页、应用级音效设置、导航、离开保护与游戏生命周期编排。
- `mountApp(root, options)` 是应用唯一最高公共 seam。其参数语义保持不变；返回值只保证 `destroy()`。
- 迁移期原生 shell 与 Vue shell 同时实现 `mountApp` 等价 interface。生产入口在 Vue 行为契约全部通过前继续使用原生 shell。
- `GameDefinition`、`GameLauncher`、`GameLaunchContext`、`GameLaunchHandle` 继续构成公共 shell 与具体游戏之间的 seam。
- Vue 游戏宿主只渲染空容器。具体游戏独占容器内部 DOM；Vue 不声明或更新其子节点。
- 游戏宿主挂载时启动游戏，卸载前销毁游戏。音效变化通过现有可选 handle 方法传递，不重新启动游戏。
- launcher 抛错时，Vue shell 清理残留 handle、导航状态与离开保护，然后安全返回游戏目录。
- retry、下一关及其他需要新局内状态的操作生成新的启动身份，禁止仅因 game ID 与关卡号相同而复用旧游戏宿主。

### State and Persistence

- 应用页面使用单一判别状态表达注册、游戏目录、活动游戏与结果，避免多个布尔值产生非法组合。
- `ProgressStore` 保持框架无关，不迁入 Pinia，不增加只做方法转发的状态层。
- `ProgressStore` 每次写入后重新读取 snapshot，并以 snapshot 替换方式更新 Vue 状态。
- storage schema、用户 ID、游戏进度结构、完成关卡记录、累计积分、音效设置与临时运行模式保持不变。
- 游戏定义、launcher、游戏 handle、DOM 元素与不可变关卡对象不进入深度 reactive；使用普通局部变量、只读值或浅引用。
- `pendingCompletion` 等价状态继续存在，确保结果确认与结果展示两个阶段之间不会重复记录通关奖励。
- 下一关目标继续校验 game ID、关卡号与最新最高解锁关卡，禁止伪造或陈旧操作进入未解锁关卡。

### Result and Lifecycle Semantics

- 保留 `onResultConfirmed` 与 `onResult` 两阶段契约。
- 结果确认发生时立即移除活动关卡离开保护；通关结果在该阶段写入游戏进度。
- 结果展示发生时才销毁游戏并显示通关或失败结果页，使现有结果动画可以完成。
- 重复结果确认或展示不产生重复奖励、重复页面跳转或重复销毁。
- 根应用 `destroy()` 必须销毁活动游戏、卸载 Vue、移除 `popstate` 与 `beforeunload` 监听，并清空挂载区域。
- 已销毁应用收到延迟动画或结果回调时不得重新写入视图。

### Navigation

- 本轮保留当前 History State 语义，不引入 URL 路径变化，不引入 Vue Router。
- 游戏目录与活动游戏仍使用同一页面 URL；History State 记录 catalog/game 及活动关卡身份。
- 活动关卡应用内返回、浏览器后退、刷新与关闭继续受离开保护。
- 用户取消浏览器后退时恢复当前活动关卡 History State，不销毁棋盘或暂存槽。
- 结果确认后立即禁用离开保护；注册页、游戏目录与结果页不注册 `beforeunload` 拦截。

### Rendering and Styling

- 首轮迁移复用当前全局 CSS、类名、DOM 顺序、`data-*`、ARIA 与可观察文案。
- 首轮 Vue SFC 不使用 scoped CSS，避免选择器改写影响现有全局样式或原生游戏 DOM。
- 品牌图案通过 Vue 模板和已存在的图案资源描述渲染，不使用 `v-html` 拼接应用 shell。
- 具体游戏现有字符串 renderer 可以继续使用内部静态资源字符串；其迁移不属于本轮 shell 范围。
- 框架迁移不与品牌重做、视觉改版、响应式重构或 CSS 拆分同时进行。

### Tooling

- 增加 Vue runtime、Vite Vue plugin 与 Vue SFC 类型检查工具。
- 构建使用 Vue SFC 类型检查覆盖现有 TypeScript 与新增 Vue 文件，再运行 Vite build。
- 保留现有 `@/*` alias、GitHub Pages base、Vitest、jsdom 与 Playwright。
- 本轮不要求 Vue Test Utils；现有 `mountApp` 高层 seam 足以在 jsdom 中挂载 Vue 并观察行为。若后续确有无法通过最高 seam 验证的视图行为，再单独评估测试库。
- 本轮不引入 Pinia、Vue Router、SSR、Nuxt 或额外 UI library。

### Migration Sequence

1. 先建立可靠 QA 基线，并解决当前全量命令误收集 E2E 的已知问题。
2. 记录 Vue shell ADR，明确覆盖旧 spec 中不引入 UI 框架的历史范围决定。
3. 引入 Vue 工具链，保持生产继续运行原生 shell。
4. 稳定 `mountApp()` 与 `destroy()` interface，使测试和入口不依赖原生 shell class。
5. 抽取可复用的 History State 操作，不改变导航行为。
6. 将现有应用行为整理为共享 contract，先只验证原生 shell。
7. 并行实现 Vue 注册页与持久化警告。
8. 并行实现 Vue 游戏目录与重置操作。
9. 实现原生游戏宿主 adapter，并验证 launcher、音效同步、异常和销毁。
10. 实现 Vue 活动游戏外壳及其返回、品牌与音效控制。
11. 实现结果确认、结果展示、通关奖励、失败、retry 与下一关状态转换。
12. 实现 History State、应用内返回、浏览器后退、刷新与关闭保护。
13. 让共享应用 contract 同时运行于原生 shell 与 Vue shell。
14. Vue shell 通过完整验证后，用单独提交切换生产 `mountApp()` implementation。
15. 保留原生 shell 一个提交周期作为快速回滚点。
16. 生产切换稳定后删除原生 shell、重复 helper 与只验证旧内部结构的测试。
17. 更新 ADR、README、迁移记录、构建成本与最终 QA 结果。

### Completion Criteria

- 生产应用 shell 使用 Vue 3。
- `mountApp()`、`MountAppOptions` 与 `destroy()` 对调用方保持兼容。
- 所有具体游戏继续通过 `GameLauncher` seam 启动。
- 关卡生成、可解搜索、局内规则、奖励、重放与游戏进度实现不导入 Vue。
- storage schema 与现有游戏进度无需迁移。
- 用户可见文案、DOM 语义、ARIA、基础布局与游戏行为保持一致。
- 原生应用 shell 已删除，项目不长期维护双 shell。
- Pinia 与 Vue Router 未引入。
- 权威 QA、跨浏览器验证、Pages 构建与 diff 检查全部通过。

## Testing Decisions

- 应用最高测试 seam 是 `mountApp(root, options)`。应用测试通过注入内存 storage、损坏 storage 与测试游戏定义，执行真实用户操作并观察 DOM、游戏进度、History State 与 launcher 行为。
- 游戏与应用 shell 的第二个既有 seam 是 `GameLauncher`。只验证启动参数、结果回调、音效同步、异常恢复与 `destroy()` 生命周期，不测试 Vue 内部 ref、watcher 或 SFC 层级。
- 迁移期共享应用 contract 同时运行于原生 shell 与 Vue shell。生产切换稳定并删除原生 shell 后，删除旧 adapter 专属执行，只保留同一高层 contract。
- 好测试只验证用户可观察行为与稳定 interface。更换 SFC 拆分、composable 名称、内部响应式实现或模板表达方式时，测试不应变化。
- 现有应用测试提供注册、游戏目录、重置、临时运行、游戏启动、结果、下一关、retry、音效、离开保护与自定义游戏定义的 prior art，应优先复用。
- 现有「狗了个狗」测试继续验证棋盘、方块、暂存槽、三消、输入锁、结果反馈、音效与销毁；本轮不因 Vue shell 重写这些测试。
- 现有 Playwright 流程继续作为注册、游戏目录、活动关卡、通关奖励、失败、retry、下一关、返回、后退、刷新保护、移动布局与跨浏览器行为的高层证据。
- Vue 事件导致的 DOM 更新按异步行为测试。测试 helper 在用户操作后等待 Vue 的下一次更新；生产代码不得为了旧同步断言强制同步渲染。
- 增加 launcher 生命周期测试：首次进入只启动一次；普通父视图更新不重复启动；音效变化不重启；retry 和下一关销毁旧 handle 并启动新 handle；根应用销毁时 handle 恰好销毁一次。
- 增加异常测试：launcher 抛错后返回游戏目录，不保留活动游戏、离开保护或失效的下一关目标。
- 增加结果幂等测试：重复确认、重复展示、延迟回调与销毁后回调不重复发放通关奖励或重复导航。
- 保留基础可访问性断言：标题层级、按钮语义、返回图标名称、音效 `aria-pressed`、状态 `role` 与持久化警告。
- 首轮保持既有 CSS 类和 DOM 定位，避免框架迁移同时重写 E2E selector。清理只移除旧 implementation 专属 selector，不删除仍表达用户行为的 selector。
- UI-only 阶段运行 `pnpm test:ui`。涉及公共契约、导航、游戏启动或生产切换时运行权威全量 QA，不与 `test:affected` 叠加。
- 响应式或浏览器兼容相关阶段追加 `pnpm test:e2e:cross-browser`。
- 发布切换与最终清理必须运行 `pnpm test:qa`、`pnpm test:e2e:cross-browser`、`pnpm build:pages` 与 `git diff --check`。
- 当前全量 QA 脚本已知会误收集 E2E；相关测试基础设施 ticket 完成前，核心 Vitest、随机回归与 Chromium E2E 必须分开运行，不能把脚本阻断误报为业务回归。
- 迁移前后记录构建产物大小、注册到游戏目录流程、完整首关流程、移动视口布局与跨浏览器结果。构建差异用于决策记录，不在缺少基线时设任意硬阈值。

## Out of Scope

- 本轮不将「狗了个狗」棋盘、方块、暂存槽或结果动画 renderer 改写为 Vue。
- 本轮不修改 `GameSession`、关卡生成器、可解搜索、难度、奖励、重放、层叠关系或随机算法。
- 本轮不修改 storage schema，不迁移已有用户或游戏进度，不保存半局。
- 本轮不新增游戏、关卡规则、道具、用户系统、后端、远程 DB 或在线同步。
- 本轮不引入 Pinia、Vue Router、Nuxt、SSR、PWA、UI library 或动画 framework。
- 本轮不增加真实 URL 深链接，不支持刷新恢复活动关卡，不改变 GitHub Pages 路由方式。
- 本轮不重做品牌、目录布局、活动游戏视觉、响应式规则、音频、SVG 或 Canvas 效果。
- 本轮不拆分或改名全部 CSS，不引入 scoped CSS，不同时进行设计 token 重构。
- 本轮不以 Vue 内部实现为测试面，不公开新的内部测试 interface。
- 本轮不顺带升级无关依赖或修复与迁移无关的关卡生成问题。
- 本轮不承诺棋盘最终 Vue 化。该决定必须由 shell 稳定后的维护成本、交互需求与性能测量驱动。

## Further Notes

- 当前 hardening spec 曾把“引入 UI 框架”列为范围外。开始实现前应新增 ADR，明确本 spec 只覆盖应用 shell，并说明为何现在重新打开该决定。
- 当前工作树存在游戏 renderer、应用测试、游戏测试与 E2E 的未提交改动。迁移实现开始前应先提交、转移或完成这些改动；不得覆盖用户工作。
- 新 feature effort ticket 11 是推荐前置项。至少应先修复权威 QA 命令边界，确保生产切换有单条可信验证入口；旧 hardening ticket 19 已归档。
- 迁移按小提交执行。每个提交必须可构建；生产切换独立成单提交；原生 shell 删除晚于生产切换，保证回滚简单。
- 推荐工作量：工具链与前置 1–2 天，Vue shell 并行实现 3–5 天，契约、E2E 与切换 2–3 天，清理与文档约 1 天。总计约 7–11 个熟悉项目的单人工作日。
- 后续若棋盘 UI 变化频繁、原生 renderer 成为维护瓶颈，或性能测量证明全量 DOM 更新存在问题，可另立 spec：抽取无 DOM 的游戏 runtime，让旧 renderer 与 Vue renderer 暂时实现同一 seam，再用共享游戏 contract 验证后切换。Canvas、音频与 Web Animations 仍应保留命令式 adapter。
