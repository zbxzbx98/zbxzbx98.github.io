# 国服前哨基地资源产出计算器

> CN Server Outpost Resource Output Calculator

根据主线**普通关卡**与**困难关卡**的进度，计算当前前哨基地（Outpost）的资源产出速度，并提供**芯尘表**查询功能——方便查看打到哪一关才能获得新的红球（芯尘）速率提升。

Calculates the Outpost resource output rate from your **Normal** and **Hard** campaign progress, and provides a **Core Dust table** to find which stage unlocks the next core-dust (red ball) rate increase.

---

## 中文

### 功能

#### 1. 防御前哨基地产出

- **输入**：
  - 国服等级修正（默认 3）：因国服个人关卡进度可能有 1~2 关误差，调整该值使显示的等级进度与游戏内一致后再使用其他功能；
  - 普通模式关卡进度（级联选择器，选择即代表已通关）；
  - 困难模式关卡进度。
- **输出**：
  - 基地防御等级与进度（每 5 关升 1 级，`x/5` 进度条）；
  - **基础每 1 小时产出**：信用点、战斗数据辑、芯尘；
  - **学院加成后每 1 小时产出**（战术学院加成后的数值）。

#### 2. 芯尘表（战术学院满级）

- 选择普通模式进度后，列出困难章节 → 等级 → 芯尘速率（学院加成后），可切换**升序/降序**、**显示/隐藏 .5 档**；
- 用于方便地查询：打到哪一关才能获得新的红球（芯尘）速率提升。

#### 3. 其他

- 多语言支持：简体中文 / 繁体中文 / English / 日本語 / 한국어；
- 数值可能存在 ±0.01 显示误差；
- 由 zbxzbx98 搬运自 [doro112 的 nikkeoutpost](https://nikkeoutpost.netlify.app)。

### 算法

- **基地防御等级** = `floor((普通关卡进度差 + 困难关卡进度差 + 国服等级修正) / 5) + 1`，进度 = 差值对 5 取余；普通进度以 2-12 为基准、困难以 0-1 为基准。
- **资源产出**：按基地等级查表（`public/json/outpost.json`，含每级基础值与学院加成值）。
- **芯尘表**：从所选普通模式进度对应位置开始，遍历困难章节，输出每关对应的等级与芯尘速率（`core_dust_mul`），按需求排序/过滤。

### 数据文件

| 文件 | 内容 |
| --- | --- |
| `public/json/chapters.json` | 主线章节/关卡结构（普通与困难） |
| `public/json/outpost.json` | 每级基地的每小时产出（信用点/战斗数据辑/芯尘，基础值与学院加成值） |
| `public/json/languages.json` | 多语言文案 |

页面：`src/views/NikkeCalc.vue`（数据随时间/服务器更新，版本见 json 中的 `version` 字段）。

---

## English

### Features

#### 1. Outpost Defense Output

- **Input**:
  - CN level correction (default 3): CN personal stage progress may differ by 1–2 stages; adjust this so the displayed level progress matches in-game before using other features;
  - Normal campaign progress (cascader; selecting a stage means it is cleared);
  - Hard campaign progress.
- **Output**:
  - Outpost defense level and progress (1 level per 5 stages, with an `x/5` progress bar);
  - **Base output per hour**: Credit, Battle Data Set, Core Dust;
  - **Output per hour after academy bonus**.

#### 2. Core Dust Table (Max Tactics Academy)

- After selecting normal progress, lists Hard chapter → level → core-dust rate (after academy bonus), with **asc/desc** sorting and **show/hide .5 tiers**;
- Conveniently answers: which stage unlocks the next core-dust (red ball) rate increase.

#### 3. Others

- Multi-language: 简体中文 / 繁體中文 / English / 日本語 / 한국어;
- Values may have a ±0.01 display error;
- Ported by zbxzbx98 from [doro112's nikkeoutpost](https://nikkeoutpost.netlify.app).

### Algorithm

- **Outpost defense level** = `floor((normal progress diff + hard progress diff + CN level correction) / 5) + 1`, progress = diff mod 5; normal progress is measured from 2-12, hard from 0-1.
- **Resource output**: looked up by level from `public/json/outpost.json` (base and academy-bonus values per level).
- **Core Dust table**: starting from the selected normal progress, iterates hard chapters and outputs the level and core-dust rate (`core_dust_mul`) for each stage, sorted/filtered as requested.

### Data Files

| File | Content |
| --- | --- |
| `public/json/chapters.json` | Main-story chapter/stage structure (normal & hard) |
| `public/json/outpost.json` | Hourly output per outpost level (credit / battle data set / core dust, base & academy values) |
| `public/json/languages.json` | Multi-language strings |

Page: `src/views/NikkeCalc.vue` (data updates with server/version — see the `version` field in the JSON files).
