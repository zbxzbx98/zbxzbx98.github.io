# 胜利女神：NIKKE 装备洗练计算器

> Gear Affix Reroll Calculator for NIKKE (Godess of Victory)

基于随机装备洗练机制的最优策略计算器：给定当前装备与目标词条，计算期望消耗的「石头/秘钥」，并给出下一步最优操作。

An optimal-strategy calculator for the gear-affix reroll system: given your current gear and target affixes, it computes the expected stone/key cost and suggests the optimal next action.

---

## 中文

### 功能

#### 1. 单装备词条计算

- 输入当前装备 3 个栏位的状态（词条、阶数、是否锁定；每件装备最多锁定 2 栏）。
- 目标词条：每行下拉可**多选词条合并为同一目标**——抽中其中任意一个（达到期望阶数）即算该目标达标，等价于把多个词条的概率权重合并（例如 暴击伤害+暴击率 11 阶 = `bsbj11`）。不同行目标需同时满足；所有词条全局不可重复。
- 计算结果：
  - **全石头期望**：完全不用秘钥时的期望石头消耗；
  - **秘钥策略石头期望 / 秘钥期望**：允许使用秘钥锁时的期望消耗；
  - **下一步操作**：锁定/变更效果/变更数值/解锁的具体步骤（秘钥锁为一次性、石头锁为永久，解锁免费）。
- **对比变更**：把洗练后得到的词条填入，对比变更前后期望，确认后一键替换原装备。
- **期望攒资源时间**：按国服（3.402 石头/天、18 秘钥/天）与国际服（4.21 石头/天、18 秘钥/天）的每日产出，估算攒够资源所需天数。
- **秘钥使用概率阈值 p**（0~1，默认 0.1）：秘钥策略下，仅当本次洗练有**超过 p 的概率**到达更优状态时才使用秘钥锁，否则回退为石头锁/直接洗练；p 越大越省秘钥。

#### 2. 角色装备词条计算

- 四件装备分别输入状态，目标按四件装备**合计**计算（最多 5 个目标，单个总阶数 ≤ 60、全部总阶数 ≤ 180、按单栏最高 15 阶折算栏位 ≤ 12）。
- 采用**分装备近似分解**：把总目标分配到四件装备，每件用单装备精确求解器计算，总期望为各件期望之和（结果接近全局最优，页面会标注"近似"）。
- 支持对比变更、期望攒资源时间、秘钥阈值 p。

#### 3. 洗词条模拟器

- **随机模拟**：按游戏词条概率随机生成装备与目标。在原有获得词条概率基础上，每个目标有 20% 概率再与一个随机未使用词条合并成**双词条目标**（如 `gj+mz`）；只允许 2 词条合并，词条被前面目标用完时不再合并。
- **自定义模拟**：手动输入当前装备与目标（支持多选合并），可**读取云存档**（仅 toy 部署）。
- 实际洗练操作：变更效果/变更数值、石头锁/秘钥锁、保留或应用洗练结果，通关后与初始期望对比实际消耗。

#### 4. 云存档（仅 B站 toy 部署）

- 单装备/角色状态与目标保存到 B站 Toy 云存储（`affix_single_` / `affix_char_`），秘钥阈值单独存储（`affix_key_p`），登录用户跨设备同步；未登录使用默认值。

### 核心算法

#### 游戏数值模型

| 项目 | 数值 |
| --- | --- |
| 词条 | 9 种：优越代码伤害/攻击力/暴击伤害/防御力（权重 0.10）；蓄力伤害/蓄力速度/暴击率/命中率/最大装弹数（权重 0.12） |
| 阶数 | 1~15，出现概率：1~5 阶各 12%、6~10 阶各 7%、11~15 阶各 1% |
| 栏位获得概率 | 栏位1=100%、栏位2=50%、栏位3=30%（无放回抽取，词条不重复） |
| 洗练费用 | 0/1/2 锁对应 1/2/3 石头 |
| 石头锁 | 第 1/2 个锁 2/3 石头（永久，解锁免费） |
| 秘钥锁 | 第 1/2 个锁 20/30 秘钥（一次性，本次洗练后自动解除） |

#### 单装备：精确有限状态 MDP

1. **压缩状态空间**：目标词条只保留「未达标/已达标」两态；非目标词条按权重压缩为 O10/O12 组；**合并目标按成员计数**（10%/12% 权重类别分别计数）留在词条池中——抽走一个成员只减一个计数，组内其他成员仍可继续抽（与 O10/O12 压缩一致），避免大权重合并组清空词条池导致概率失真。
2. **动作枚举**：为每个状态枚举「锁定保护子集（≤2 栏）+ 变更效果 xg / 变更数值 sz」的所有合法动作；xg 时被锁词条从候选池剔除（无放回）。
3. **洗练结果分布**：按栏位顺序做无放回加权抽取，递归展开每个动作的转移概率；池子为空时该栏位必为空（概率完整保留）。
4. **价值迭代**（Gauss-Seidel 风格 Bellman 迭代）：
   - 全石头策略：标量价值 = 期望石头；
   - 允许秘钥策略：字典序价值 (期望石头, 期望秘钥)，先最小化石头、再最小化秘钥；
   - 自环通过 `V = (C + ΣpV') / (1 - p_self)` 解析处理；
   - 收敛精度 epsilon = 1e-9。
5. **秘钥阈值过滤**：秘钥锁动作仅在「本次洗练后到达更优状态的概率 > p」时允许（以全石头策略价值为参照）；石头锁动作始终可用——因此 p=1 时秘钥策略自动退化为全石头策略。
6. **动作输出**：将内部动作翻译为人类可读步骤（免费解锁 uN、秘钥锁 sN、石头锁 SN、变更效果 xg、变更数值 sz）。

#### 角色版：分装备近似分解（默认）

- 用概率加权成本表决定每个目标「拆给几件装备」最划算，优先摊薄单件装备的高阶需求（高阶档位概率仅 1%）；
- 每件装备用单装备精确求解器求其子目标的最优策略；
- 总期望 = 各装备期望之和（洗练互不影响、可任意交错），下一步操作取剩余需求最大装备的子策略首步；
- 另有 `exact` 精确全局 MDP 路径（四件装备组合状态，默认不启用，用于小规模目标）。

#### 工程实现

- 计算运行在 **Web Worker**（`src/workers/affix.worker.js`）中，避免阻塞页面，支持进度回调与取消。
- 算法文件：`src/affix_solver.js`（单装备）、`src/affix_4gear_solver.js`（角色）。
- 页面：`src/views/AffixCalc.vue`；模拟器：`src/components/AffixSimulator.vue`。

---

## English

### Features

#### 1. Single Gear Calculator

- Input the current gear's 3 slots (affix, tier, lock status; at most 2 slots can be locked).
- **Target affixes**: each row's dropdown supports **multi-select to merge affixes into one target** — hitting any selected affix at the required tier satisfies that target, equivalent to merging their probability weights (e.g. Crit Damage + Crit Rate at tier 11 = `bsbj11`). Different rows must all be satisfied; no affix may repeat across targets.
- Results:
  - **All-stone expectation**: expected stones without using any keys;
  - **Key-strategy stone/key expectation**: expected cost when key locks are allowed;
  - **Next action**: concrete steps (lock / reroll effect `xg` / reroll value `sz` / unlock). Key locks are one-time, stone locks are permanent, unlocking is free.
- **Compare change**: fill in the affixes you actually rolled to compare expectation before/after, then apply with one click.
- **Expected saving time**: estimates days needed based on CN server (3.402 stones/day, 18 keys/day) and global server (4.21 stones/day, 18 keys/day).
- **Key usage probability threshold p** (0~1, default 0.1): in the key strategy, a key lock is only used when this wash has **more than p probability** of reaching a better state; otherwise it falls back to stone locks / direct washing. Larger p saves more keys.

#### 2. Character (4-Gear) Calculator

- Input all four gears; targets are summed across the whole character (up to 5 targets, each ≤ 60 tiers, total ≤ 180 tiers, slots ≤ 12).
- Uses **decomposed approximation**: split the total target among the four gears, solve each with the exact single-gear solver, and sum the expectations (close to global optimum; the page marks it as "approximate").
- Supports compare, expected saving time, and the key threshold p.

#### 3. Affix Reroll Simulator

- **Random simulation**: generates random gears and targets with game probabilities. On top of the previous affix-draw probabilities, each target has a **20% chance to merge with one random unused affix into a 2-affix target** (e.g. `gj+mz`); only 2-affix merges are allowed, and no merge is added once all affixes are used up.
- **Custom simulation**: manually input gears and targets (multi-select merging supported), with **cloud-save loading** (toy deployment only).
- Actual washing play: reroll effect/value, stone/key locks, keep or apply results, and compare actual spending against the initial expectation after clearing.

#### 4. Cloud Save (Bilibili Toy deployment only)

- Single/character gear states and targets are saved to Bilibili Toy cloud storage (`affix_single_` / `affix_char_`); the key threshold is stored separately (`affix_key_p`). Synced across devices for logged-in users; defaults are used when logged out.

### Core Algorithm

#### Game Value Model

| Item | Value |
| --- | --- |
| Affixes | 9 kinds: uy/gj/bs/fy (weight 0.10); xl/xs/bj/mz/dr (weight 0.12) |
| Tiers | 1–15; draw probabilities: tiers 1–5 each 12%, 6–10 each 7%, 11–15 each 1% |
| Slot acquisition | slot1=100%, slot2=50%, slot3=30% (drawing without replacement, no duplicate affixes) |
| Wash cost | 1/2/3 stones for 0/1/2 locks |
| Stone lock | 2/3 stones for the 1st/2nd lock (permanent, free to unlock) |
| Key lock | 20/30 keys for the 1st/2nd lock (one-time, auto-released after the wash) |

#### Single Gear: Exact Finite-State MDP

1. **Compressed state space**: targets keep only "not met / met" states; non-target affixes are compressed into O10/O12 weight groups; **merged targets stay in the pool by member counts** (10%/12% weight classes counted separately) — drawing one member decrements only that member, so other members of the same group remain drawable (same idea as the O10/O12 compression). This prevents a large merged group from emptying the pool and distorting probabilities.
2. **Action enumeration**: for every state, enumerate all legal actions of "lock subset (≤2 slots) + reroll effect `xg` / reroll value `sz`"; locked affixes are removed from the candidate pool during `xg` (no replacement).
3. **Wash outcome distribution**: weighted drawing without replacement slot by slot, expanding each action's transition probabilities recursively; an empty pool forces an empty slot (probability fully preserved).
4. **Value iteration** (Gauss–Seidel style Bellman iteration):
   - All-stone strategy: scalar value = expected stones;
   - Key-allowed strategy: lexicographic pair (expected stones, expected keys), minimizing stones first, then keys;
   - Self-loops are solved via `V = (C + ΣpV') / (1 - p_self)`;
   - Convergence tolerance epsilon = 1e-9.
5. **Key-threshold filter**: key-lock actions are allowed only when "probability of reaching a better state after this wash > p" (measured against the all-stone value function); stone-lock actions are always allowed — so at p=1 the key strategy degenerates into the all-stone strategy.
6. **Action output**: internal actions are translated into human-readable steps (free unlock `uN`, key lock `sN`, stone lock `SN`, reroll effect `xg`, reroll value `sz`).

#### Character Mode: Decomposed Approximation (default)

- A probability-weighted cost table decides how many gears should carry each target (spreading high-tier demand, since high tiers only have 1% probability);
- Each gear's sub-target is solved by the exact single-gear solver;
- Total expectation = sum of each gear's expectation (washes are independent and can interleave); the next action comes from the gear with the largest remaining demand;
- An `exact` global-MDP path also exists (combinatorial state space, disabled by default, for small targets).

#### Engineering

- Computation runs in a **Web Worker** (`src/workers/affix.worker.js`) to keep the UI responsive, with progress callbacks and cancellation.
- Solver files: `src/affix_solver.js` (single gear), `src/affix_4gear_solver.js` (character).
- Page: `src/views/AffixCalc.vue`; simulator: `src/components/AffixSimulator.vue`.
