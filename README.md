# zbxzbx98.github.io — 个人工具集 / Personal Toolbox

基于 **Vue 3 + Vite + Element Plus** 的个人工具网站，部署于 GitHub Pages。当前包含以下工具：

A personal toolbox built with **Vue 3 + Vite + Element Plus**, deployed on GitHub Pages. It currently includes:

| 模块 / Module | 说明 / Description | 详细文档 / Details |
| --- | --- | --- |
| 胜利女神：NIKKE 装备洗练计算器 | 洗词条最优策略：期望石头/秘钥消耗与下一步操作 | [docs/affix-calc.md](docs/affix-calc.md) |
| 国服前哨基地资源产出计算器 | 按主线进度计算前哨基地产出，附芯尘（红球）表查询 | [docs/nikke-calc.md](docs/nikke-calc.md) |
| 在线数独求解器 | 9×9 数独候选剪枝 + 回溯求解 | [docs/sudoku.md](docs/sudoku.md) |

> 另有 `toy` 分支，用于打包成单 HTML 部署到 **B站 Toy 平台**（含云存档功能，仅含两个 NIKKE 计算器）。详见「分支说明」。

> There is also a `toy` branch packaged into a single HTML file for the **Bilibili Toy platform** (with cloud-save support; it contains only the two NIKKE calculators). See "Branches" below.

---

## 1. 装备洗练计算器 / Gear Affix Reroll Calculator

计算随机装备洗练的最优策略：给定当前装备与目标词条，输出**全石头期望**、**秘钥策略石头期望**与**秘钥期望**，并给出下一步最优操作（锁定/变更效果/变更数值/解锁）。

- 单装备 / 角色（四件合计）两种模式；
- 目标词条支持**多选合并**（如 `bsbj11` = 暴击伤害或暴击率 11 阶，抽中任意一个即达标）；
- **洗词条模拟器**：随机模拟（目标有 20% 概率合并成双词条）与自定义模拟；
- **秘钥使用概率阈值 p**、**期望攒资源时间**、**对比变更**；
- 核心算法：压缩状态空间 + Gauss-Seidel 价值迭代的精确 MDP（详见文档）。

详细说明（功能与核心算法）：[docs/affix-calc.md](docs/affix-calc.md)

## 2. 前哨基地资源产出计算器 / Outpost Resource Output Calculator

根据主线**普通关卡**与**困难关卡**进度计算当前前哨基地的资源产出速度（信用点/战斗数据辑/芯尘，含战术学院加成），并附**芯尘表**查询——方便查看打到哪一关才能获得新的红球（芯尘）速率提升。

- 支持国服等级修正、升/降序、显示/隐藏 .5 档；
- 多语言：简中 / 繁中 / 英 / 日 / 韩；
- 数据搬运自 [doro112 的 nikkeoutpost](https://nikkeoutpost.netlify.app)。

详细说明：[docs/nikke-calc.md](docs/nikke-calc.md)

## 3. 数独求解器 / Sudoku Solver

一个很小的功能：输入 9×9 数独盘面（空格填 0），点击求解即可得到答案。使用候选数剪枝 + DFS 回溯。

详细说明：[docs/sudoku.md](docs/sudoku.md)

---

## 技术栈 / Tech Stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) + [Element Plus](https://element-plus.org/)
- [vue-router](https://router.vuejs.org/)（main 用 history 模式 / toy 用 hash 模式）
- [three.js](https://threejs.org/) + [vanta](https://www.vantajs.com/)（页面背景动效）
- [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)（toy 分支打包为单 HTML）
- Web Worker（洗练计算，避免阻塞界面）
- B站 Toy SDK（toy 分支云存档）

## 分支说明 / Branches

| 分支 | 用途 | 路由 | 页面 | 云存档 |
| --- | --- | --- | --- | --- |
| `main` | GitHub Pages 部署 | history 模式 | 开始页 / 主页 / 数独 / 资源产出 / 装备洗练 | 无 |
| `toy` | 构建 B站 Toy（单 HTML 部署） | hash 模式 | 装备洗练 / 资源产出 | 有（Toy SDK 云存储） |

- `main` 分支由 GitHub Actions（`.github/workflows/pages.yml`）自动构建并部署到 GitHub Pages，并生成 `404.html` 支持前端路由刷新；
- `toy` 分支使用 `vite-plugin-singlefile` 把页面打包成**单个 HTML 文件**，上传到 B站 Toy 平台（`https://www.bilibili.com/toy/<slug>/index.html`）即可使用；
- 两个分支的装备计算器功能保持一致（除云存档外），请勿把 toy 的云存档相关改动与 main 搞混。

## 构建 / Build

```sh
npm install
npm run dev      # 本地开发
npm run build    # 生产构建（toy 分支输出单 HTML 到 dist/）
```

## 目录结构 / Structure

```
├─ src/
│  ├─ views/
│  │  ├─ AffixCalc.vue        # 装备洗练计算器（单装备/角色）
│  │  ├─ NikkeCalc.vue        # 前哨基地资源产出计算器
│  │  ├─ Solve.vue            # 数独求解器
│  │  ├─ Effect.vue           # 开始页
│  │  └─ Home.vue             # 主页
│  ├─ components/
│  │  └─ AffixSimulator.vue   # 洗词条模拟器
│  ├─ affix_solver.js         # 单装备精确 MDP 求解器
│  ├─ affix_4gear_solver.js   # 角色版求解器（分解近似 + 精确路径）
│  └─ workers/
│     └─ affix.worker.js      # 计算 Worker
├─ public/
│  └─ json/                   # chapters.json / outpost.json / languages.json
└─ docs/                      # 模块详细文档
```

## 免责声明 / Disclaimer

计算器仅用于估计词条期望和给出大致最优策略，不一定为绝对正确的策略；任何使用造成的石头/秘钥消耗由使用者自行承担。

The calculators are for estimation only and may not be perfectly optimal; any stone/key spending is at the user's own risk.

---

制作：zbxzbx98 ｜ Made by zbxzbx98
