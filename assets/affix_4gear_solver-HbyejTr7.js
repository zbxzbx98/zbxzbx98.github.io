'use strict';

/**
 * 4件装备、角色总属性目标的随机洗词条最优策略求解器。
 *
 * 这是“精确有限状态 MDP”版本：
 * - 每件装备洗练独立；
 * - 角色终止条件由4件装备目标词条阶数总和决定；
 * - 全石头：最小化期望石头；
 * - 允许秘钥：按字典序最小化 (期望石头, 期望秘钥)；
 * - 已有 1 锁按“永久石头锁”处理；
 * - 允许秘钥模式下，新 sN 按“一次性秘钥锁”处理，洗练后自动解除；
 * - 永久锁可以在下一次洗练前免费解锁，输出 e.g. 2u1；
 * - 达标直接输出 d0。
 *
 * 重要复杂度说明：
 * 4件装备 + 总和目标会产生指数级全局状态空间。
 * 该实现使用：
 *   1) 非目标词条 O10/O12 无损压缩；
 *   2) 目标词条保留实际贡献阶数；
 *   3) 每个目标的单槽贡献上限截断到 min(15, 目标总需求)；
 *   4) 四件同规则装备按局部状态排序，消除装备排列对称；
 *   5) 仅从当前输入状态向外构造可达状态图；
 *   6) 对相同局部状态的装备只枚举一次动作。
 *
 * 对很高维目标仍可能非常大，因此提供 maxGlobalStates / maxTransitionsPerAction 保护。
 */

const EFFECTS = [
  ['uy', 0.10],
  ['gj', 0.10],
  ['bs', 0.10],
  ['fy', 0.10],
  ['xl', 0.12],
  ['xs', 0.12],
  ['bj', 0.12],
  ['mz', 0.12],
  ['dr', 0.12],
];

const EFFECT_INDEX = new Map(EFFECTS.map((x, i) => [x[0], i]));

const SLOT_GET = [1.0, 0.5, 0.3];

const TIER_P = [
  0,
  0.12, 0.12, 0.12, 0.12, 0.12,
  0.07, 0.07, 0.07, 0.07, 0.07,
  0.01, 0.01, 0.01, 0.01, 0.01,
];

const WASH_STONE = [1, 2, 3];
const LOCK_STONE = [2, 3];
const LOCK_KEY = [20, 30];

function popcount(x) {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

function maskBits(mask) {
  const a = [];
  for (let i = 0; i < 3; i++) {
    if (mask & (1 << i)) a.push(i);
  }
  return a;
}

function approxEq(a, b, eps) {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
}

function solveCharacter(currentStr, targetStr, options = {}) {
  const epsilon = options.epsilon ?? 1e-9;
  const maxIterations = options.maxIterations ?? 20000;
  const tieEps = options.tieEps ?? 1e-10;
  const digits = options.digits ?? 6;
  const maxGlobalStates = options.maxGlobalStates ?? 200000;
  const maxTransitionsPerAction = options.maxTransitionsPerAction ?? 300000;
  const progress = typeof options.onProgress === 'function' ? options.onProgress : null;

  /**
   * 秘钥使用概率阈值 p（0~1，默认 0.1）。
   *
   * 秘钥策略下，只有当本次洗练有超过 p 的概率
   * 到达一个“更优”的状态时才允许使用秘钥锁；
   * 否则该动作视为不可用，直接使用石头洗练。
   */
  const keyP =
    typeof options.p === 'number' && options.p >= 0 && options.p <= 1
      ? options.p
      : 0.1;

  /**
   * 是否启用“更精确策略计算”（改进分配候选对比）。
   * 默认开启；关闭后使用原始快速启发式分配（更快，但在已有高阶词条时
   * 分配可能不是最优，甚至比空装备更贵）。
   */
  const usePrecise = options.usePrecise !== false;

  /* ========================================================
   * 1. 解析目标
   * ======================================================== */

  const targetTokens = targetStr.trim()
    ? targetStr.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const targets = [];
  const seenEffect = new Set();

  // 词条 -> 目标编号；合并目标的所有成员映射到同一目标
  const targetIndexByEffect = new Map();

  for (const tok of targetTokens) {
    /**
     * 支持合并目标（同一行多选）：
     *   uy13          单个词条
     *   bsbj22        暴击伤害 或 暴击率，角色总阶数 >= 22
     */
    const mm = tok.match(/^((?:uy|gj|bs|fy|xl|xs|bj|mz|dr)+)(\d+)$/);
    if (!mm) throw new Error('非法目标词条: ' + tok);

    const names = mm[1].match(/uy|gj|bs|fy|xl|xs|bj|mz|dr/g);
    const req = Number(mm[2]);

    if (!Number.isInteger(req) || req < 1 || req > 60) {
      throw new Error(`目标 ${names.join('')} 的角色总阶数必须为 1..60`);
    }

    // 所有词条不允许重复（含合并目标内部的成员）
    const dup = names.find(n => seenEffect.has(n));
    if (dup !== undefined) throw new Error('目标词条重复: ' + dup);
    for (const n of names) seenEffect.add(n);

    const weight = names.reduce((s, n) => s + EFFECTS[EFFECT_INDEX.get(n)][1], 0);
    const j = targets.length;
    for (const n of names) targetIndexByEffect.set(EFFECT_INDEX.get(n), j);

    targets.push({
      // 展示名/子目标代号：成员代号直接拼接（如 bsbj）
      name: names.join(''),
      names,
      req,
      eidx: EFFECT_INDEX.get(names[0]),
      weight,
      // 成员按权重类别计数（抽词条时按成员逐个进入词条池）
      members10: names.filter(n => EFFECTS[EFFECT_INDEX.get(n)][1] === 0.10).length,
      members12: names.filter(n => EFFECTS[EFFECT_INDEX.get(n)][1] === 0.12).length,
      cap: Math.min(15, req),
      tierBuckets: null,
    });
  }

  // 最大可行性快速检查：每个效果每件装备最多出现一次，每件装备3栏，总共12栏。
  const minRequiredSlots = targets.reduce((s, t) => s + Math.ceil(t.req / 15), 0);
  if (minRequiredSlots > 12) {
    throw new Error(
      `目标不可能完成：按15阶计算至少需要 ${minRequiredSlots} 个目标词条栏位，但4件装备总共只有12栏。`
    );
  }

  const m = targets.length;
  // targetIndexByEffect 已在解析目标时由合并目标的所有成员共同构建

  // 将阶数分布压缩成对目标总和真正有意义的贡献值。
  // 若某目标总需求 <= 15，则单槽贡献超过需求的部分没有额外价值，可以合并。
  for (const t of targets) {
    const map = new Map();
    for (let tier = 1; tier <= 15; tier++) {
      const v = Math.min(tier, t.cap);
      map.set(v, (map.get(v) || 0) + TIER_P[tier]);
    }
    t.tierBuckets = [...map.entries()].map(([value, p]) => ({ value, p }));
  }

  /* ========================================================
   * 2. 局部栏位编码
   *
   * 0                 = wd
   * 1 + j*15 + (v-1)  = 目标j，贡献v（v=1..cap_j）
   * O10 / O12          = 非目标10%组 / 12%组
   * ======================================================== */

  const TARGET_CODE_BASE = 1;
  const TARGET_CODE_WIDTH = 15;
  const O10 = TARGET_CODE_BASE + m * TARGET_CODE_WIDTH;
  const O12 = O10 + 1;

  function targetCode(j, value) {
    return TARGET_CODE_BASE + j * TARGET_CODE_WIDTH + (value - 1);
  }

  function isTargetCode(code) {
    return code >= TARGET_CODE_BASE && code < O10;
  }

  function decodeTargetCode(code) {
    const x = code - TARGET_CODE_BASE;
    return {
      j: Math.floor(x / TARGET_CODE_WIDTH),
      value: (x % TARGET_CODE_WIDTH) + 1,
    };
  }

  let nonTarget10 = 0;
  let nonTarget12 = 0;
  for (let e = 0; e < EFFECTS.length; e++) {
    if (targetIndexByEffect.has(e)) continue;
    if (EFFECTS[e][1] === 0.10) nonTarget10++;
    else nonTarget12++;
  }

  function validLocalSlots(slots) {
    let c10 = 0;
    let c12 = 0;

    for (const code of slots) {
      if (code === 0) continue;

      if (isTargetCode(code)) {
        const { j, value } = decodeTargetCode(code);
        if (j < 0 || j >= m) return false;
        if (value < 1 || value > targets[j].cap) return false;
        // 合并目标的不同成员（如 bs 和 bj）可同时出现在一件装备上，
        // 因此同一目标可以重复出现。
      } else if (code === O10) {
        c10++;
      } else if (code === O12) {
        c12++;
      } else {
        return false;
      }
    }

    return c10 <= nonTarget10 && c12 <= nonTarget12;
  }

  function occupiedMask(slots) {
    let mask = 0;
    for (let i = 0; i < 3; i++) {
      if (slots[i] !== 0) mask |= (1 << i);
    }
    return mask;
  }

  /* ========================================================
   * 3. 动态局部状态池
   * ======================================================== */

  const localStates = [];
  const localIdByKey = new Map();

  function localKey(slots, lock) {
    return `${lock}|${slots[0]},${slots[1]},${slots[2]}`;
  }

  function internLocal(slots, lock) {
    if (!validLocalSlots(slots)) {
      throw new Error('内部错误：非法局部状态 ' + JSON.stringify({ slots, lock }));
    }

    const occ = occupiedMask(slots);
    if ((lock & ~occ) !== 0) {
      throw new Error('内部错误：空栏位被锁定');
    }
    if (popcount(lock) > 2) {
      throw new Error('内部错误：锁定栏位超过2个');
    }

    const key = localKey(slots, lock);
    let id = localIdByKey.get(key);
    if (id !== undefined) return id;

    id = localStates.length;
    localStates.push({
      id,
      slots: slots.slice(),
      lock,
      key,
    });
    localIdByKey.set(key, id);
    return id;
  }

  /* ========================================================
   * 4. 解析4件装备输入
   * ======================================================== */

  function parseOneGear(text) {
    const toks = text.split(',').map(s => s.trim());
    if (toks.length !== 3) {
      throw new Error('每件装备必须恰好包含3个栏位: ' + text);
    }

    const seenEffect = new Set();
    const slots = [];
    let lock = 0;

    for (let i = 0; i < 3; i++) {
      const tok = toks[i];
      const mm = tok.match(/^([01])(wd|uy|gj|bs|fy|xl|xs|bj|mz|dr)(\d+)$/);
      if (!mm) throw new Error('非法栏位: ' + tok);

      const lk = Number(mm[1]);
      const name = mm[2];
      const tier = Number(mm[3]);

      if (name === 'wd') {
        if (tier !== 0) throw new Error('wd 的阶数必须为0: ' + tok);
        // 锁定空栏没有意义；永久锁可免费解锁，因此规范化为不锁。
        slots.push(0);
        continue;
      }

      if (!Number.isInteger(tier) || tier < 1 || tier > 15) {
        throw new Error('词条阶数必须为1..15: ' + tok);
      }
      if (seenEffect.has(name)) {
        throw new Error('同一件装备内词条不能重复: ' + name);
      }
      seenEffect.add(name);

      const eidx = EFFECT_INDEX.get(name);
      const tj = targetIndexByEffect.get(eidx);

      if (tj !== undefined) {
        const contribution = Math.min(tier, targets[tj].cap);
        slots.push(targetCode(tj, contribution));
      } else {
        slots.push(EFFECTS[eidx][1] === 0.10 ? O10 : O12);
      }

      if (lk) lock |= (1 << i);
    }

    if (popcount(lock) > 2) {
      throw new Error('每件装备最多锁2个栏位');
    }

    return internLocal(slots, lock);
  }

  const gearTexts = currentStr.split('/').map(s => s.trim());
  if (gearTexts.length !== 4) {
    throw new Error('角色状态必须恰好包含4件装备，并使用 / 分隔');
  }

  // 保留输入顺序，用于最终输出装备编号。
  const originalStartLocalIds = gearTexts.map(parseOneGear);

  /* ========================================================
   * 5. 全局状态规范化
   *
   * 四件装备规则相同，价值函数对装备排列对称。
   * 内部使用排序后的4个localId作为全局状态。
   * ======================================================== */

  function canonicalGearIds(ids) {
    const x = ids.slice();
    x.sort((a, b) => a - b);
    return x;
  }

  function globalKey(ids) {
    return `${ids[0]}/${ids[1]}/${ids[2]}/${ids[3]}`;
  }

  function contributionTotals(ids) {
    const totals = new Int16Array(m);

    for (const localId of ids) {
      const st = localStates[localId];
      for (const code of st.slots) {
        if (!isTargetCode(code)) continue;
        const { j, value } = decodeTargetCode(code);
        const next = totals[j] + value;
        totals[j] = Math.min(next, targets[j].req);
      }
    }
    return totals;
  }

  function isGoalGlobalIds(ids) {
    if (m === 0) return true;
    const totals = contributionTotals(ids);
    for (let j = 0; j < m; j++) {
      if (totals[j] < targets[j].req) return false;
    }
    return true;
  }

  const canonicalStart = canonicalGearIds(originalStartLocalIds);

  // 如果输入本身已达标，直接返回，不构图。
  if (isGoalGlobalIds(canonicalStart)) {
    return {
      cost: '0/0-0',
      action: 'd0',
      text: '0/0-0|d0',
      stoneOnlyAction: 'd0',
      expected: {
        stoneOnly: 0,
        withKeysStone: 0,
        withKeysKeys: 0,
      },
      graph: {
        stoneOnlyStates: 1,
        withKeysStates: 1,
      },
    };
  }

  /* ========================================================
   * 6. 分装备近似分解求解（默认路径）
   *
   * 精确全局 MDP 的状态空间 = 4件装备局部状态的组合（数量级
   * C(L+3,4)），即使最小目标也会超过 maxGlobalStates。因此
   * 默认改为“分解式”近似：
   *
   *   1) 把每个目标的总需求分配到4件装备：每件装备最多承担
   *      3 个不同目标词条，单目标单件最多 15 阶；优先摊薄，
   *      使各装备单栏需求尽量低（高需求档位概率只有1%）。
   *   2) 对每件装备用“单装备精确求解器”求其子目标的最优策略；
   *   3) 总期望消耗 = 各装备期望之和（洗练互不影响，可任意交错）；
   *   4) 下一步操作取“剩余需求最大”装备的子策略首步。
   *
   * 该策略是可行策略，其期望成本是全局最优的上界，通常非常接近。
   * 需要单装备求解器：优先用 options.solve，否则在 Node/CommonJS
   * 环境下自动 require('./affix_solver.js')。
   * ======================================================== */

  function getSingleSolver() {
    if (typeof options.solve === 'function') return options.solve;
    if (typeof require === 'function') {
      return require('./affix_solver.js').solve;
    }
    throw new Error('缺少单装备求解器：请通过 options.solve 传入 affix_solver 的 solve 函数。');
  }

  function solveCharacterDecomposed() {
    const solveGear = getSingleSolver();
    const n = originalStartLocalIds.length;
    const digitsOpt = options.digits ?? 6;

    // 每件装备当前对各目标的贡献（同一目标多槽位时累加）
    const cur = originalStartLocalIds.map(localId => {
      const st = localStates[localId];
      const row = new Array(m).fill(0);
      for (const code of st.slots) {
        if (!isTargetCode(code)) continue;
        const { j, value } = decodeTargetCode(code);
        row[j] += value;
      }
      return row;
    });

    const curSum = new Array(m).fill(0);
    for (let g = 0; g < n; g++) {
      for (let j = 0; j < m; j++) curSum[j] += cur[g][j];
    }
    const deficit = targets.map((t, j) => Math.max(0, t.req - curSum[j]));

    const d0result = {
      cost: '0/0-0',
      action: 'd0',
      text: '0/0-0|d0',
      stoneOnlyAction: 'd0',
      expected: { stoneOnly: 0, withKeysStone: 0, withKeysKeys: 0 },
      approx: true,
      graph: { mode: 'decomposed', gears: n, perGearSolves: 0 },
    };
    if (deficit.every(d => d <= 0)) return d0result;

    // ==================== 候选分配（改进版） ====================

    // 每件装备已有目标词条的“真实阶数”（不受角色目标需求 cap 影响）：
    // 局部状态编码会把贡献截断到 min(15, 需求)，但装备上实际挂着的是真实阶数，
    // 例如需求 dr5 时装备的 dr12 只会被记成 5，若用截断值评估会严重低估该装备
    // 的保留负担，导致分配把新词条塞给它。
    const gearTargetTiers = gearTexts.map(txt => {
      const map = new Map();
      for (const tok of txt.split(',')) {
        const mm = tok.trim().match(/^([01])(uy|gj|bs|fy|xl|xs|bj|mz|dr)(\d+)$/);
        if (!mm) continue;
        const name = mm[2];
        const tier = Number(mm[3]);
        if (name === 'wd') continue;
        const tj = targetIndexByEffect.get(EFFECT_INDEX.get(name));
        if (tj !== undefined) map.set(tj, tier);
      }
      return map;
    });

    // 装备状态系数：在该装备上新增洗练工作的相对代价
    // （高阶已有目标难动、空槽/低阶可洗的便宜）。
    // 注意：非目标（无关）词条在洗练时会被直接洗掉，与空栏位等价，
    // 不应计入“保留负担”——否则会误导分配，把新目标塞给必须保留
    // 目标词条、栏位紧张的装备，抬高期望成本。
    function gearFactor(g) {
      let f = 1;
      for (const [, tier] of gearTargetTiers[g]) {
        if (tier >= 11) f += 1.4;
        else if (tier >= 6) f += 0.6;
        else f += 0.2;
      }
      return Math.max(0.5, f);
    }

    /**
     * 改进分配：
     * 1) 每个目标摊薄到尽量 ≤11 阶（11 阶以上进入 1% 概率档，代价陡增），
     *    至少覆盖“已有 ≥11 阶贡献”的承诺载体；
     * 2) 选择承担装备时考虑装备状态（便宜的优先，贵重的尽量不动），
     *    已有该目标的装备优先保留现有贡献；
     * 3) 允许把低价值现有贡献洗掉重新分配（sub 可低于 cur）。
     *
     * 返回 sub 矩阵；槽位不足等不可行情况返回 null（调用方回退到原始分配）。
     */
    function buildAllocationImproved() {
      const factors = [];
      for (let g = 0; g < n; g++) factors.push(gearFactor(g));

      // kBest：每件目标 ≤ 11 阶，且至少覆盖 committed 载体，总槽位 ≤ 12
      const kBest = new Array(m).fill(0);
      for (let j = 0; j < m; j++) {
        if (deficit[j] > 0) {
          let committed = 0;
          for (let g = 0; g < n; g++) if (cur[g][j] >= 11) committed++;
          kBest[j] = Math.max(committed, Math.ceil(targets[j].req / 11));
          if (kBest[j] > 4) kBest[j] = 4;
          continue;
        }
        // 已有合计已 ≥ 需求：不新增承担装备，但需保留足够多的已有贡献
        // 使合计仍覆盖需求（否则 rem 无处摊分，分配会失败）。
        const contribs = [];
        for (let g = 0; g < n; g++) if (cur[g][j] > 0) contribs.push([cur[g][j], g]);
        contribs.sort((a, b) => b[0] - a[0]);
        let acc = 0;
        for (const [v] of contribs) {
          acc += v;
          kBest[j]++;
          if (acc >= targets[j].req) break;
        }
      }
      if (kBest.reduce((a, b) => a + b, 0) > 3 * n) return null;

      // 分配承担装备：按需求降序，每目标选 kBest[j] 件
      const A = cur.map(row => row.map(() => false));
      const cnt = new Array(n).fill(0);
      const order = targets.map((_, j) => j).sort((a, b) => targets[b].req - targets[a].req);
      for (const j of order) {
        let need = kBest[j];
        let guard = 0;
        while (need > 0) {
          if (++guard > 64) return null;
          let best = -1;
          let bestScore = Infinity;
          for (let g = 0; g < n; g++) {
            if (A[g][j] || cnt[g] >= 3) continue;
            let score = factors[g];
            if (cur[g][j] > 0) score -= 1.5;
            if (cur[g][j] >= 11) score -= 1;
            if (score < bestScore) { bestScore = score; best = g; }
          }
          if (best === -1) return null;
          A[best][j] = true;
          cnt[best]++;
          need--;
        }
      }

      // 阶数：已承担目标先保留现有贡献，其余缺口摊分
      const sub = cur.map(row => row.slice());
      for (let g = 0; g < n; g++) {
        for (let j = 0; j < m; j++) {
          if (!A[g][j]) sub[g][j] = 0;
        }
      }
      const rem = targets.map((t, j) => t.req - sub.reduce((s, row) => s + row[j], 0));
      for (let j = 0; j < m; j++) {
        let left = rem[j];
        let guard = 0;
        while (left > 0) {
          if (++guard > 300) return null;
          let best = -1;
          let bestScore = Infinity;
          for (let g = 0; g < n; g++) {
            if (!A[g][j] || sub[g][j] >= 15) continue;
            const score = sub[g][j] * 100 + sub[g].reduce((a, b) => a + b, 0);
            if (score < bestScore) { bestScore = score; best = g; }
          }
          if (best === -1) return null;
          sub[best][j]++;
          left--;
        }
      }
      return trimExcessSub(sub);
    }

    // 释放超额保留：若某目标现有贡献合计已超过需求（例如最大装弹数已由一件
    // 装备单独满足），其它装备上“多余”的该词条并不需要强制保留——强制保留只会
    // 迫使这些装备在洗其它词条时锁定/保护它，显著抬高期望成本。这里只保留
    // “合计刚好覆盖需求”的若干最大贡献者，其余装备对该目标的子目标清零
    // （多余词条允许被洗掉，反正不影响达标）。
    function trimExcessSub(subArr) {
      for (let j = 0; j < m; j++) {
        const req = targets[j].req;
        let total = 0;
        for (let g = 0; g < n; g++) total += subArr[g][j];
        if (total <= req) continue;
        const idxs = [];
        for (let g = 0; g < n; g++) if (subArr[g][j] > 0) idxs.push(g);
        idxs.sort((a, b) => subArr[b][j] - subArr[a][j]);
        const keep = new Array(n).fill(false);
        let acc = 0;
        for (const g of idxs) {
          keep[g] = true;
          acc += subArr[g][j];
          if (acc >= req) break;
        }
        for (let g = 0; g < n; g++) if (!keep[g]) subArr[g][j] = 0;
      }
      return subArr;
    }

    // 改进候选：仅当启用了精确策略且当前状态存在“有价值的现有目标”（≥11 阶）时
    // 才考虑；空装备/低阶状态原始分配已足够好，避免无谓的候选对比开销
    const hasHighExisting = (() => {
      for (let g = 0; g < n; g++) {
        for (let j = 0; j < m; j++) {
          if (cur[g][j] >= 11) return true;
        }
      }
      return false;
    })();
    const improvedSub = usePrecise && hasHighExisting ? buildAllocationImproved() : null;

    // 分配：A[g][j] = 装备 g 是否承担目标 j（已有贡献的装备固定保留）
    const A = cur.map(row => row.map(v => v > 0));

    // 1) 概率加权成本表决定每个目标“拆给几件装备”最划算
    //
    // 单装备从空状态洗到“某效果 ≥ t 阶”的期望石头成本（由单装备
    // 精确求解器预计算）：下标 = 阶数 - 1。
    //   COST10：10% 权重组（优越代码伤害/攻击力/暴击伤害/防御力）
    //   COST12：12% 权重组（蓄力伤害/蓄力速度/暴击率/命中率/最大装弹数）
    // 对目标 j 而言，用 k 件装备承担、每件需求 ceil(req/k) 的估计总成本
    // 为 k * COST(ceil(req/k))，取使该值最小的 k 作为承担装备数。
    // 低阶目标集中在1件装备更省，高阶目标摊薄更省。
    const COST10 = [
      5.5104, 5.6468, 5.8262, 6.0729, 6.4335, 7.0104, 7.5407,
      8.3566, 9.7736, 12.8438, 24.5104, 29.5104, 37.8438, 54.5104, 104.5104,
    ];
    const COST12 = [
      4.655, 4.7914, 4.9708, 5.2175, 5.5781, 6.155, 6.6853,
      7.5012, 8.9182, 11.9884, 23.655, 28.655, 36.9884, 53.655, 103.655,
    ];

    const curCnt = j => A.reduce((a, row) => a + (row[j] ? 1 : 0), 0);
    const proxyCost = (j, k) => {
      const w = targets[j].weight;
      let C = COST10;
      if (w === 0.12) C = COST12;
      else if (w !== 0.10) {
        // 合并目标（权重 > 0.12）：期望次数约与权重成反比，按比例缩放
        C = COST10.map(c => c * 0.10 / w);
      }
      return k * C[Math.ceil(targets[j].req / k) - 1];
    };

    // 每个目标至少 ceil(req/15) 件装备才能承载其总阶数（容量下界）。
    // 已有贡献的装备（cur>0）固定保留，容量缺口 = 新增装备数 × 15，
    // 故 kBest[j] ≥ ceil(req/15) 时容量必然足够。
    const kBest = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      if (deficit[j] <= 0) {
        kBest[j] = curCnt(j);
        continue;
      }
      const minK = Math.max(curCnt(j), Math.ceil(targets[j].req / 15));
      let best = minK;
      let bestCost = Infinity;
      for (let k = minK; k <= 4; k++) {
        const c = proxyCost(j, k);
        if (c < bestCost - 1e-9) {
          bestCost = c;
          best = k;
        }
      }
      kBest[j] = best;
    }

    // 总栏位预算 12：超出时逐次砍掉“边际损失最小”的目标
    let totalAssign = kBest.reduce((a, b) => a + b, 0);
    while (totalAssign > 3 * n) {
      let bestJ = -1;
      let bestPenalty = Infinity;
      for (let j = 0; j < m; j++) {
        const minK = Math.max(curCnt(j), Math.ceil(targets[j].req / 15));
        if (kBest[j] <= minK) continue;
        const pen = proxyCost(j, kBest[j] - 1) - proxyCost(j, kBest[j]);
        if (pen < bestPenalty) {
          bestPenalty = pen;
          bestJ = j;
        }
      }
      if (bestJ === -1) break;
      kBest[bestJ]--;
      totalAssign--;
    }

    // 2) 一次性分配装备：回溯搜索给每个目标选定 kBest[j] 件装备。
    //    不再“先按容量、再按 kBest 扩张”两步贪心——两步贪心会互相
    //    抢占栏位，对可行目标误报“栏位不足”。放不下时逐步回退到容量
    //    下界（minRequiredSlots ≤ 12 时必然可行，不会误报）。
    const factorsForAssign = [];
    for (let g = 0; g < n; g++) factorsForAssign.push(gearFactor(g));

    function tryAssign(needArr) {
      const mat = cur.map(row => row.map(v => v > 0));
      const cnt = new Array(m).fill(0);
      for (let g = 0; g < n; g++) for (let j = 0; j < m; j++) if (mat[g][j]) cnt[j]++;
      const freeSlots = mat.map((row, g) => 3 - row.reduce((s, x) => s + (x ? 1 : 0), 0));

      // 缺口大的目标优先，其次按总需求降序
      const order = targets.map((_, j) => j).sort((a, b) =>
        (Math.max(0, needArr[b] - cnt[b]) - Math.max(0, needArr[a] - cnt[a])) ||
        (targets[b].req - targets[a].req)
      );

      function dfs(k) {
        if (k === m) return true;
        const j = order[k];
        if (cnt[j] >= needArr[j]) return dfs(k + 1);
        const cands = [];
        for (let g = 0; g < n; g++) {
          if (!mat[g][j] && freeSlots[g] > 0) cands.push(g);
        }
        // 优先剩余栏位多、洗练代价低的装备
        cands.sort((a, b) =>
          (freeSlots[b] - freeSlots[a]) ||
          (factorsForAssign[a] - factorsForAssign[b]) ||
          (a - b)
        );
        for (const g of cands) {
          mat[g][j] = true; freeSlots[g]--; cnt[j]++;
          if (dfs(k)) return true;
          mat[g][j] = false; freeSlots[g]++; cnt[j]--;
        }
        return false;
      }
      return dfs(0) ? mat : null;
    }

    let assigned = tryAssign(kBest);
    if (!assigned) {
      // 从 kBest 逐步回退（优先砍“多拆一件边际收益最小”的目标），最坏退到容量下界
      const minNeed = targets.map((t, j) =>
        deficit[j] <= 0 ? curCnt(j) : Math.max(curCnt(j), Math.ceil(t.req / 15))
      );
      const curNeed = kBest.slice();
      while (!assigned) {
        let bestJ = -1;
        let bestPenalty = Infinity;
        for (let j = 0; j < m; j++) {
          if (curNeed[j] <= minNeed[j]) continue;
          const pen = proxyCost(j, curNeed[j] - 1) - proxyCost(j, curNeed[j]);
          if (pen < bestPenalty) { bestPenalty = pen; bestJ = j; }
        }
        if (bestJ === -1) break;
        curNeed[bestJ]--;
        assigned = tryAssign(curNeed);
      }
      if (!assigned) assigned = tryAssign(minNeed);
    }

    if (!assigned) {
      throw new Error('目标词条栏位不足：4件装备共12栏无法承载当前目标，请降低目标。');
    }
    for (let g = 0; g < n; g++) for (let j = 0; j < m; j++) A[g][j] = assigned[g][j];

    // 4) 逐级分配阶数：同一目标在承担它的装备间尽量摊平
    //    （优先降低每件装备该目标的需求值，避免把某件装备推到
    //      13~15 阶这类 1% 概率的高档位；次级再按总负载破平局）
    const sub = cur.map(row => row.slice());
    for (let j = 0; j < m; j++) {
      let rem = deficit[j];
      let guard = 0;
      while (rem > 0) {
        if (++guard > 200) break;
        let best = -1;
        let bestScore = Infinity;
        for (let g = 0; g < n; g++) {
          if (!A[g][j] || sub[g][j] >= 15) continue;
          const score = sub[g][j] * 100 + sub[g].reduce((a, b) => a + b, 0);
          if (score < bestScore) {
            bestScore = score;
            best = g;
          }
        }
        if (best === -1) break;
        sub[best][j]++;
        rem--;
      }
      if (rem > 0) {
        throw new Error('目标阶数分配失败，请检查目标是否可行。');
      }
    }
    // 释放超额保留（已有贡献超出需求的部分不再强制保留）
    trimExcessSub(sub);

    // 5) 候选评估：宽松精度快速排序，胜者再用精确精度求解用于展示
    const gearCostCache = new Map();
    const LOOSE_EPS = 1e-3;

    // 求解单件装备子目标；已满足/无子目标时直接 0 成本（不调用求解器）
    function evalGear(g, subArr, eps) {
      const subs = [];
      let work = 0;
      for (let j = 0; j < m; j++) {
        if (subArr[g][j] > 0) subs.push(targets[j].name + subArr[g][j]);
        work += Math.max(0, subArr[g][j] - cur[g][j]);
      }
      if (subs.length === 0 || work === 0) {
        return {
          cost: '0/0-0',
          action: 'd0',
          stoneOnlyAction: 'd0',
          preUnlock: [],
          stoneOnlyPreUnlock: [],
          expected: { stoneOnly: 0, withKeysStone: 0, withKeysKeys: 0 },
        };
      }
      const key = (eps < 1e-6 ? 'L' : 'P') + g + '|' + subs.join(',');
      if (gearCostCache.has(key)) return gearCostCache.get(key);
      // 仅精确求解阶段上报装备进度（宽松评估阶段不打扰用户）
      if (progress && eps < 1e-6) progress({ phase: 'gear', gear: g + 1, total: n });
      const r = solveGear(gearTexts[g], subs.join(','), {
        epsilon: eps,
        maxIterations: options.maxIterations ?? 10000,
        digits: eps < 1e-6 ? 4 : digitsOpt,
        // 秘钥使用概率阈值透传给单装备求解器
        p: options.p ?? 0.1,
      });
      gearCostCache.set(key, r);
      return r;
    }

    function stoneOf(r) {
      const mm = String(r.cost || '').match(/^([\d.]+)\/([\d.]+)-([\d.]+)$/);
      return mm ? parseFloat(mm[1]) : 0;
    }

    // 生成候选（原始分配 sub + 改进候选 improvedSub）
    const candidates = improvedSub ? [sub, improvedSub] : [sub];
    const candidatesDiffer = candidates.length > 1 && JSON.stringify(improvedSub) !== JSON.stringify(sub);

    // 选最优候选：候选不同时用宽松精度快速排序，胜者再用精确精度求解展示
    let bestSub = sub;
    if (candidatesDiffer) {
      if (progress) progress({ phase: 'compare' });
      const looseTotals = candidates.map(cand => {
        let t = 0;
        for (let g = 0; g < n; g++) t += stoneOf(evalGear(g, cand, LOOSE_EPS));
        return t;
      });
      let bestIdx = 0;
      for (let i = 1; i < candidates.length; i++) {
        if (looseTotals[i] < looseTotals[bestIdx] - 0.5) bestIdx = i;
      }
      // 两个候选差距很小（<5 石头）时用精确值复核，避免宽松精度误判
      if (Math.abs(looseTotals[0] - looseTotals[1]) < 5) {
        const p0 = (() => { let t = 0; for (let g = 0; g < n; g++) t += stoneOf(evalGear(g, candidates[0], 1e-9)); return t; })();
        const p1 = (() => { let t = 0; for (let g = 0; g < n; g++) t += stoneOf(evalGear(g, candidates[1], 1e-9)); return t; })();
        bestIdx = p1 < p0 - 1e-9 ? 1 : 0;
      }
      bestSub = candidates[bestIdx];
    }

    const fmtCost = x => {
      if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
      return x.toFixed(digitsOpt).replace(/0+$/, '').replace(/\.$/, '');
    };

    let totalStone = 0;
    let totalKeyStone = 0;
    let totalKeys = 0;
    const detail = [];
    const gearResults = [];
    let chosen = -1;
    let chosenWork = -1;

    for (let g = 0; g < n; g++) {
      const subs = [];
      let work = 0;
      for (let j = 0; j < m; j++) {
        if (bestSub[g][j] > 0) subs.push(targets[j].name + bestSub[g][j]);
        work += Math.max(0, bestSub[g][j] - cur[g][j]);
      }
      const r = evalGear(g, bestSub, 1e-9);
      gearResults[g] = r;
      const mm = String(r.cost || '').match(/^([\d.]+)\/([\d.]+)-([\d.]+)$/);
      totalStone += mm ? parseFloat(mm[1]) : 0;
      totalKeyStone += mm ? parseFloat(mm[2]) : 0;
      totalKeys += mm ? parseFloat(mm[3]) : 0;
      detail.push({
        gear: g + 1,
        current: gearTexts[g],
        subTargets: subs.join(','),
        cost: r.cost || '0/0-0',
        action: r.action || 'd0',
      });
      if (work > chosenWork) {
        chosenWork = work;
        chosen = g;
      }
    }

    if (chosen === -1 || !gearResults[chosen]) {
      return d0result;
    }

    const keyRes = gearResults[chosen];
    const keyTokens = [];
    for (const u of keyRes.preUnlock || []) keyTokens.push(`${chosen + 1}u${u}`);
    for (const t of String(keyRes.action || '').split(',').map(s => s.trim()).filter(Boolean)) {
      keyTokens.push(`${chosen + 1}${t}`);
    }

    const stoneTokens = [];
    for (const u of keyRes.stoneOnlyPreUnlock || []) stoneTokens.push(`${chosen + 1}u${u}`);
    for (const t of String(keyRes.stoneOnlyAction || '').split(',').map(s => s.trim()).filter(Boolean)) {
      stoneTokens.push(`${chosen + 1}${t}`);
    }

    const costStr =
      `${fmtCost(totalStone)}/` +
      `${fmtCost(totalKeyStone)}-` +
      `${fmtCost(totalKeys)}`;

    return {
      cost: costStr,
      action: keyTokens.join(','),
      text: `${costStr}|${keyTokens.join(',')}`,
      stoneOnlyAction: stoneTokens.join(','),
      expected: {
        stoneOnly: totalStone,
        withKeysStone: totalKeyStone,
        withKeysKeys: totalKeys,
      },
      approx: true,
      detail,
      graph: {
        mode: 'decomposed',
        gears: n,
        perGearSolves: gearResults.filter(Boolean).length,
      },
    };
  }

  // 默认使用分解近似；如需原精确全局 MDP，可传 options.exact = true
  if (options.exact !== true) {
    return solveCharacterDecomposed();
  }

  /* ========================================================
   * 6. 局部洗练概率分布（精确路径）
   * ======================================================== */

  const localOutcomeCache = new Map();

  function slotsSig(slots) {
    return `${slots[0]},${slots[1]},${slots[2]}`;
  }

  function xgOutcomeDistribution(localId, protectMask, nextLock) {
    const st = localStates[localId];
    const key = `xg|${localId}|${protectMask}|${nextLock}`;
    const cached = localOutcomeCache.get(key);
    if (cached) return cached;

    const out = [0, 0, 0];
    // 每个目标 j 剩余可抽的成员数（10% / 12% 权重类别）
    const rem10 = targets.map(t => t.members10);
    const rem12 = targets.map(t => t.members12);
    let r10 = nonTarget10;
    let r12 = nonTarget12;

    // 被保护的现有效果从无放回候选池删除。
    for (let i = 0; i < 3; i++) {
      if (!(protectMask & (1 << i))) continue;
      const code = st.slots[i];
      out[i] = code;

      if (isTargetCode(code)) {
        // 目标 j 的一个成员被保护：从对应权重类别减掉一个成员
        // （具体是哪个成员未知，同类成员概率相等，误差可忽略）
        const { j } = decodeTargetCode(code);
        if (rem10[j] > 0) rem10[j]--;
        else if (rem12[j] > 0) rem12[j]--;
      } else if (code === O10) {
        r10--;
      } else if (code === O12) {
        r12--;
      }
    }

    const agg = new Map();

    function add(prob) {
      if (prob <= 0) return;
      const id = internLocal(out, nextLock);
      agg.set(id, (agg.get(id) || 0) + prob);
      if (agg.size > maxTransitionsPerAction) {
        throw new Error(
          `单个 xg 动作产生超过 ${maxTransitionsPerAction} 个不同结果；` +
          '请提高 maxTransitionsPerAction，或使用近似算法。'
        );
      }
    }

    function recurse(pos, prob, rr10, rr12) {
      if (pos === 3) {
        add(prob);
        return;
      }

      if (protectMask & (1 << pos)) {
        recurse(pos + 1, prob, rr10, rr12);
        return;
      }

      const acquire = SLOT_GET[pos];

      // 计算剩余候选池总权重。
      let totalWeight = rr10 * 0.10 + rr12 * 0.12;
      for (let j = 0; j < m; j++) {
        totalWeight += rem10[j] * 0.10 + rem12[j] * 0.12;
      }

      // 候选池已空：本栏位必然拿不到词条（wd），概率必须完整保留，不能丢弃。
      if (totalWeight <= 0) {
        out[pos] = 0;
        recurse(pos + 1, prob, rr10, rr12);
        return;
      }

      // 没获得效果。
      if (acquire < 1) {
        out[pos] = 0;
        recurse(pos + 1, prob * (1 - acquire), rr10, rr12);
      }

      // 抽到目标词条 j（按成员计数逐个抽），再抽阶数。
      for (let j = 0; j < m; j++) {
        const buckets = targets[j].tierBuckets;

        // 抽到一个 10% 权重成员。
        if (rem10[j] > 0) {
          const pEffect = acquire * rem10[j] * 0.10 / totalWeight;
          rem10[j]--;
          for (const tb of buckets) {
            out[pos] = targetCode(j, tb.value);
            recurse(pos + 1, prob * pEffect * tb.p, rr10, rr12);
          }
          rem10[j]++;
        }

        // 抽到一个 12% 权重成员。
        if (rem12[j] > 0) {
          const pEffect = acquire * rem12[j] * 0.12 / totalWeight;
          rem12[j]--;
          for (const tb of buckets) {
            out[pos] = targetCode(j, tb.value);
            recurse(pos + 1, prob * pEffect * tb.p, rr10, rr12);
          }
          rem12[j]++;
        }
      }

      // 抽到一个10%组非目标。
      if (rr10 > 0) {
        const pGroup = acquire * (rr10 * 0.10) / totalWeight;
        out[pos] = O10;
        recurse(pos + 1, prob * pGroup, rr10 - 1, rr12);
      }

      // 抽到一个12%组非目标。
      if (rr12 > 0) {
        const pGroup = acquire * (rr12 * 0.12) / totalWeight;
        out[pos] = O12;
        recurse(pos + 1, prob * pGroup, rr10, rr12 - 1);
      }
    }

    recurse(0, 1, r10, r12);

    const dist = [...agg.entries()].map(([id, p]) => ({ id, p }));
    localOutcomeCache.set(key, dist);
    return dist;
  }

  function szOutcomeDistribution(localId, protectMask, nextLock) {
    const st = localStates[localId];
    const key = `sz|${localId}|${protectMask}|${nextLock}`;
    const cached = localOutcomeCache.get(key);
    if (cached) return cached;

    const out = st.slots.slice();
    const agg = new Map();

    function add(prob) {
      const id = internLocal(out, nextLock);
      agg.set(id, (agg.get(id) || 0) + prob);
      if (agg.size > maxTransitionsPerAction) {
        throw new Error(
          `单个 sz 动作产生超过 ${maxTransitionsPerAction} 个不同结果；` +
          '请提高 maxTransitionsPerAction。'
        );
      }
    }

    function recurse(pos, prob) {
      if (pos === 3) {
        add(prob);
        return;
      }

      const code = st.slots[pos];

      // 锁住 / 空栏 / 非目标词条：对角色目标贡献状态不变。
      if ((protectMask & (1 << pos)) || code === 0 || !isTargetCode(code)) {
        recurse(pos + 1, prob);
        return;
      }

      const { j } = decodeTargetCode(code);
      const old = out[pos];

      for (const tb of targets[j].tierBuckets) {
        out[pos] = targetCode(j, tb.value);
        recurse(pos + 1, prob * tb.p);
      }

      out[pos] = old;
    }

    recurse(0, 1);

    const dist = [...agg.entries()].map(([id, p]) => ({ id, p }));
    localOutcomeCache.set(key, dist);
    return dist;
  }

  /* ========================================================
   * 7. 单件装备动作枚举
   * ======================================================== */

  const localActionCache = {
    stone: new Map(),
    key: new Map(),
  };

  function enumerateLocalActions(localId, mode) {
    const cache = localActionCache[mode];
    const cached = cache.get(localId);
    if (cached) return cached;

    const st = localStates[localId];
    const occ = occupiedMask(st.slots);
    const result = [];

    for (let protect = 0; protect < 8; protect++) {
      if ((protect & ~occ) !== 0) continue;
      if (popcount(protect) > 2) continue;

      const keepPermanent = st.lock & protect;
      const newMask = protect & ~st.lock;
      const retained = popcount(keepPermanent);
      const added = popcount(newMask);
      const totalProtected = popcount(protect);

      // 石头锁变体：新增锁用永久石头锁，始终可用
      let stoneV = WASH_STONE[totalProtected];
      // 秘钥锁变体：新增锁用一次性秘钥锁，需满足秘钥阈值 p
      let keyV = 0;

      for (let k = 0; k < added; k++) {
        const before = retained + k;
        stoneV += LOCK_STONE[before];
        keyV += LOCK_KEY[before];
      }

      for (const wash of ['xg', 'sz']) {
        if (wash === 'sz') {
          // sz 只会改变未锁定目标词条的阶数。
          // 锁非目标栏位不会影响任何目标随机变量，只会增加成本，因此严格劣化。
          let hasUnlockedTarget = false;
          let protectsNonTarget = false;

          for (let i = 0; i < 3; i++) {
            const bit = 1 << i;
            const code = st.slots[i];

            if ((protect & bit) && code !== 0 && !isTargetCode(code)) {
              protectsNonTarget = true;
              break;
            }

            if (!(protect & bit) && isTargetCode(code)) {
              hasUnlockedTarget = true;
            }
          }

          if (protectsNonTarget || !hasUnlockedTarget) {
            continue;
          }
        }

        // 石头锁动作（永久锁，洗练后锁保留）
        const stoneDist = wash === 'xg'
          ? xgOutcomeDistribution(localId, protect, protect)
          : szOutcomeDistribution(localId, protect, protect);

        // 若100%回到同一个局部状态，则这个动作只消耗资源，没有任何价值。
        if (
          !(
            stoneDist.length === 1 &&
            stoneDist[0].id === localId &&
            approxEq(stoneDist[0].p, 1, 1e-14)
          )
        ) {
          result.push({
            protect,
            wash,
            stoneCost: stoneV,
            keyCost: 0,
            localDist: stoneDist,
            useKey: false,
          });
        }

        // 秘钥锁动作（一次性锁，洗练后锁自动解除）
        if (mode === 'key' && added > 0) {
          const keyDist = wash === 'xg'
            ? xgOutcomeDistribution(localId, protect, keepPermanent)
            : szOutcomeDistribution(localId, protect, keepPermanent);

          if (
            !(
              keyDist.length === 1 &&
              keyDist[0].id === localId &&
              approxEq(keyDist[0].p, 1, 1e-14)
            )
          ) {
            result.push({
              protect,
              wash,
              stoneCost: WASH_STONE[totalProtected],
              keyCost: keyV,
              localDist: keyDist,
              useKey: true,
            });
          }
        }
      }
    }

    cache.set(localId, result);
    return result;
  }

  /* ========================================================
   * 8. 构造某一模式下的“从当前状态可达”全局状态图
   * ======================================================== */

  function buildGraph(mode) {
    const nodes = [];
    const idByKey = new Map();
    const queue = [];

    function internGlobal(ids) {
      const canonical = canonicalGearIds(ids);
      const key = globalKey(canonical);
      let id = idByKey.get(key);
      if (id !== undefined) return id;

      if (nodes.length >= maxGlobalStates) {
        throw new Error(
          `全局可达状态超过 maxGlobalStates=${maxGlobalStates}。` +
          '4件装备总和目标的精确MDP状态空间可能非常大；' +
          '可提高上限，或改用近似/分层算法。'
        );
      }

      id = nodes.length;
      nodes.push({
        id,
        gearIds: canonical,
        goal: isGoalGlobalIds(canonical),
        actions: null,
      });
      idByKey.set(key, id);
      queue.push(id);
      return id;
    }

    const startId = internGlobal(canonicalStart);

    let qHead = 0;
    while (qHead < queue.length) {
      const sid = queue[qHead++];
      const node = nodes[sid];

      if (node.goal) {
        node.actions = [];
        continue;
      }

      const actions = [];
      const seenLocalId = new Set();

      // 对同样的局部装备状态只需要洗其中任意一件。
      for (let pos = 0; pos < 4; pos++) {
        const localId = node.gearIds[pos];
        if (seenLocalId.has(localId)) continue;
        seenLocalId.add(localId);

        for (const la of enumerateLocalActions(localId, mode)) {
          const agg = new Map();

          for (const lo of la.localDist) {
            const next = node.gearIds.slice();
            next[pos] = lo.id;
            const nid = internGlobal(next);
            agg.set(nid, (agg.get(nid) || 0) + lo.p);
          }

          const trans = [...agg.entries()].map(([id, p]) => ({ id, p }));

          // 100%全局自环动作没有意义。
          if (
            trans.length === 1 &&
            trans[0].id === sid &&
            approxEq(trans[0].p, 1, 1e-14)
          ) {
            continue;
          }

          actions.push({
            localId,
            protect: la.protect,
            wash: la.wash,
            stoneCost: la.stoneCost,
            keyCost: la.keyCost,
            trans,
          });
        }
      }

      node.actions = actions;

      if (progress && qHead % 1000 === 0) {
        progress({ phase: `build-${mode}`, expanded: qHead, states: nodes.length });
      }
    }

    return { nodes, idByKey, startId };
  }

  /* ========================================================
   * 9. Bellman 最优方程
   *
   * 全石头：标量 Vstone
   * 秘钥模式：字典序 pair (Vstone, Vkey)
   * ======================================================== */

  function pairBetter(aS, aK, bS, bK, useKeys) {
    if (!Number.isFinite(bS)) return true;

    const tolS = tieEps * Math.max(1, Math.abs(aS), Math.abs(bS));
    if (aS < bS - tolS) return true;
    if (aS > bS + tolS) return false;

    if (!useKeys) return false;

    const tolK = tieEps * Math.max(1, Math.abs(aK), Math.abs(bK));
    return aK < bK - tolK;
  }

  function solveGraph(graph, mode) {
    const useKeys = mode === 'key';
    const n = graph.nodes.length;
    const vs = new Float64Array(n);
    const vk = useKeys ? new Float64Array(n) : null;

    let converged = false;
    let iterations = 0;

    // 从0开始的Gauss-Seidel价值迭代。
    // 所有非终止动作石头成本 >= 1，且目标可达时属于标准SSP。
    for (iterations = 0; iterations < maxIterations; iterations++) {
      let maxRel = 0;

      // 逆序通常对从起点向外构造的图稍有帮助。
      for (let sid = n - 1; sid >= 0; sid--) {
        const node = graph.nodes[sid];
        if (node.goal) continue;

        const oldS = vs[sid];
        const oldK = useKeys ? vk[sid] : 0;

        let bestS = Infinity;
        let bestK = Infinity;

        for (const a of node.actions) {
          /**
           * 秘钥阈值过滤：
           *
           * 秘钥模式下，仅当本次洗练有超过 p 的概率
           * 到达更优状态的动作才允许使用秘钥；
           * 否则该动作不可用（回退到石头锁动作）。
           */
          if (useKeys && a.keyCost > 0) {
            const tol = tieEps * Math.max(1, Math.abs(vs[sid]));
            let pImp = 0;
            for (const tr of a.trans) {
              if (tr.id !== sid && vs[tr.id] < vs[sid] - tol) pImp += tr.p;
            }
            if (pImp <= keyP) continue;
          }

          let pSelf = 0;
          let numS = a.stoneCost;
          let numK = a.keyCost;

          for (const tr of a.trans) {
            if (tr.id === sid) {
              pSelf += tr.p;
            } else {
              numS += tr.p * vs[tr.id];
              if (useKeys) numK += tr.p * vk[tr.id];
            }
          }

          const den = 1 - pSelf;
          if (den <= 1e-14) continue;

          const qS = numS / den;
          const qK = useKeys ? numK / den : 0;

          if (pairBetter(qS, qK, bestS, bestK, useKeys)) {
            bestS = qS;
            bestK = qK;
          }
        }

        if (!Number.isFinite(bestS)) {
          throw new Error(`状态 ${sid} 没有可用的proper动作，无法求解。`);
        }

        vs[sid] = bestS;
        if (useKeys) vk[sid] = bestK;

        const relS = Math.abs(bestS - oldS) / Math.max(1, Math.abs(bestS));
        if (relS > maxRel) maxRel = relS;

        if (useKeys) {
          const relK = Math.abs(bestK - oldK) / Math.max(1, Math.abs(bestK));
          if (relK > maxRel) maxRel = relK;
        }
      }

      if (progress && iterations % 100 === 0) {
        progress({ phase: `value-${mode}`, iteration: iterations, residual: maxRel });
      }

      if (maxRel < epsilon) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      throw new Error(
        `价值迭代在 ${maxIterations} 轮内未收敛；` +
        '可提高 maxIterations 或适当放宽 epsilon。'
      );
    }

    return {
      vs,
      vk,
      iterations: iterations + 1,
      stone: vs[graph.startId],
      keys: useKeys ? vk[graph.startId] : 0,
    };
  }

  /* ========================================================
   * 10. 在“原始输入装备顺序”上恢复下一步动作
   * ======================================================== */

  function evaluateActionAgainstValue(rawGearIds, gearIndex, la, graph, values, mode) {
    const useKeys = mode === 'key';
    const canonicalCurrentKey = globalKey(canonicalGearIds(rawGearIds));
    const sid = graph.idByKey.get(canonicalCurrentKey);
    if (sid === undefined) throw new Error('内部错误：起始状态不在图中');

    const agg = new Map();
    for (const lo of la.localDist) {
      const next = rawGearIds.slice();
      next[gearIndex] = lo.id;
      const k = globalKey(canonicalGearIds(next));
      const nid = graph.idByKey.get(k);
      if (nid === undefined) {
        throw new Error('内部错误：起始动作后继状态未进入图');
      }
      agg.set(nid, (agg.get(nid) || 0) + lo.p);
    }

    let pSelf = 0;
    let numS = la.stoneCost;
    let numK = la.keyCost;

    // 与 solveGraph 相同的秘钥阈值过滤
    if (useKeys && la.keyCost > 0) {
      const tol = tieEps * Math.max(1, Math.abs(values.vs[sid]));
      let pImp = 0;
      for (const [nid, p] of agg) {
        if (nid !== sid && values.vs[nid] < values.vs[sid] - tol) pImp += p;
      }
      if (pImp <= keyP) return null;
    }

    for (const [nid, p] of agg) {
      if (nid === sid) {
        pSelf += p;
      } else {
        numS += p * values.vs[nid];
        if (useKeys) numK += p * values.vk[nid];
      }
    }

    const den = 1 - pSelf;
    if (den <= 1e-14) return null;

    return {
      qS: numS / den,
      qK: useKeys ? numK / den : 0,
    };
  }

  function actionTokensForRaw(localId, gearIndex, la) {
    const st = localStates[localId];
    const equip = gearIndex + 1;

    const unlockMask = st.lock & ~la.protect;
    const newLockMask = la.protect & ~st.lock;

    const tokens = [];

    // 免费解锁先执行。
    for (const slot of maskBits(unlockMask)) {
      tokens.push(`${equip}u${slot + 1}`);
    }

    // 新锁：小写 s = 秘钥锁，大写 S = 永久石头锁。
    for (const slot of maskBits(newLockMask)) {
      tokens.push(`${equip}${la.useKey ? 's' : 'S'}${slot + 1}`);
    }

    // 洗练。
    tokens.push(`${equip}${la.wash}`);
    return tokens;
  }

  function pickRawStartAction(graph, values, mode) {
    const useKeys = mode === 'key';
    let best = null;
    let bestS = Infinity;
    let bestK = Infinity;

    // 这里不去重：因为输出必须映射回用户输入的 1..4 号装备。
    // 若两件装备状态完全相同，则枚举顺序会自然选择编号更小的一件。
    for (let gearIndex = 0; gearIndex < 4; gearIndex++) {
      const localId = originalStartLocalIds[gearIndex];

      for (const la of enumerateLocalActions(localId, mode)) {
        const ev = evaluateActionAgainstValue(
          originalStartLocalIds,
          gearIndex,
          la,
          graph,
          values,
          mode
        );
        if (!ev) continue;

        if (pairBetter(ev.qS, ev.qK, bestS, bestK, useKeys)) {
          bestS = ev.qS;
          bestK = ev.qK;
          best = {
            gearIndex,
            localId,
            la,
          };
        }
      }
    }

    if (!best) throw new Error('无法恢复起始状态最优动作');

    return {
      action: actionTokensForRaw(best.localId, best.gearIndex, best.la).join(','),
      equipment: best.gearIndex + 1,
      wash: best.la.wash,
      unlockSlots: maskBits(localStates[best.localId].lock & ~best.la.protect).map(x => x + 1),
      newLockSlots: maskBits(best.la.protect & ~localStates[best.localId].lock).map(x => x + 1),
      lockMaterial: best.la.useKey ? 'key' : 'stone',
      qStone: bestS,
      qKeys: bestK,
    };
  }

  /* ========================================================
   * 11. 两种资源模式分别精确求解
   * ======================================================== */

  const stoneGraph = buildGraph('stone');
  const stoneValues = solveGraph(stoneGraph, 'stone');
  const stonePlan = pickRawStartAction(stoneGraph, stoneValues, 'stone');

  const keyGraph = buildGraph('key');
  const keyValues = solveGraph(keyGraph, 'key');
  const keyPlan = pickRawStartAction(keyGraph, keyValues, 'key');

  /* ========================================================
   * 12. 输出格式
   * ======================================================== */

  function fmt(x) {
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  const cost = `${fmt(stoneValues.stone)}/${fmt(keyValues.stone)}-${fmt(keyValues.keys)}`;

  return {
    cost,

    // 默认下一步：允许秘钥，先最小化石头，再最小化秘钥。
    action: keyPlan.action,

    text: `${cost}|${keyPlan.action}`,

    // 完全不用秘钥时的下一步。
    stoneOnlyAction: stonePlan.action,

    expected: {
      stoneOnly: stoneValues.stone,
      withKeysStone: keyValues.stone,
      withKeysKeys: keyValues.keys,
    },

    next: {
      withKeys: keyPlan,
      stoneOnly: stonePlan,
    },

    graph: {
      stoneOnlyStates: stoneGraph.nodes.length,
      withKeysStates: keyGraph.nodes.length,
      localStates: localStates.length,
      stoneOnlyIterations: stoneValues.iterations,
      withKeysIterations: keyValues.iterations,
    },
  };
}

module.exports = {
  solveCharacter,
};
