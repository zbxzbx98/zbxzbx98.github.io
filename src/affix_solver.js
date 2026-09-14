'use strict';

/**
 * 随机装备洗词条最优策略求解器
 *
 * 主入口：
 *
 *   solve(currentState, target, options?)
 *
 * 示例：
 *
 *   const result = solve(
 *     '0gj11,1uy11,0wd0',
 *     'gj13,uy13,dr13'
 *   );
 *
 *   console.log(result.cost);
 *   console.log(result.action);
 *
 * 当前状态格式：
 *
 *   0gj11,1uy11,0wd0
 *
 * 每个栏位：
 *
 *   [锁定状态][词条代号][阶数]
 *
 *   0 = 未锁
 *   1 = 石头永久锁
 *
 * 目标格式：
 *
 *   gj13,uy13,dr13
 *
 * 表示：
 *
 *   攻击力 >= 13
 *   优越代码伤害 >= 13
 *   最大装弹数 >= 13
 *
 * options.p（可选，默认 0.1）：
 *
 *   秘钥使用概率阈值。秘钥策略下，只有当本次洗练有超过 p 的概率
 *   到达一个“更优”的状态时才允许使用秘钥锁；否则回退到石头锁动作
 *   （p=1 时秘钥策略退化为全石头策略）。
 *
 * 返回：
 *
 * {
 *   cost: "全石头期望/允许秘钥后的石头期望-秘钥期望",
 *   action: "s1,s2,xg",
 *
 *   // 如果需要先免费解除已有永久锁，会列在这里
 *   preUnlock: [1],
 *
 *   // 允许秘钥策略中新增加的秘钥锁
 *   keyLockSlots: [2],
 *
 *   stoneOnlyAction: "...",
 *   stoneOnlyPreUnlock: [...],
 *
 *   expected: {
 *      stoneOnly: ...,
 *      withKeysStone: ...,
 *      withKeysKeys: ...
 *   }
 * }
 */


/* ============================================================
 * 基础配置
 * ============================================================ */

const EFFECTS = [
  ['uy', 0.10], // 优越代码伤害
  ['gj', 0.10], // 攻击力
  ['bs', 0.10], // 暴击伤害
  ['fy', 0.10], // 防御力

  ['xl', 0.12], // 蓄力伤害
  ['xs', 0.12], // 蓄力速度
  ['bj', 0.12], // 暴击率
  ['mz', 0.12], // 命中率
  ['dr', 0.12], // 最大装弹数
];

const EFFECT_INDEX = new Map(
  EFFECTS.map((x, i) => [x[0], i])
);


/**
 * 进行“变更效果”时：
 *
 * 栏位1：100% 获得词条
 * 栏位2：50%
 * 栏位3：30%
 */
const SLOT_GET = [
  1.0,
  0.5,
  0.3,
];


/**
 * 阶数概率
 *
 * 下标就是阶数。
 */
const TIER_P = [
  0,

  0.12, // 1
  0.12, // 2
  0.12, // 3
  0.12, // 4
  0.12, // 5

  0.07, // 6
  0.07, // 7
  0.07, // 8
  0.07, // 9
  0.07, // 10

  0.01, // 11
  0.01, // 12
  0.01, // 13
  0.01, // 14
  0.01, // 15
];


/**
 * 当前锁定栏位数 -> 洗练石头消耗
 *
 * 0锁：1
 * 1锁：2
 * 2锁：3
 */
const WASH_STONE = [
  1,
  2,
  3,
];


/**
 * 当前已有锁数 -> 新增石头锁费用
 *
 * 0锁 -> 第1锁：2
 * 1锁 -> 第2锁：3
 */
const LOCK_STONE = [
  2,
  3,
];


/**
 * 当前已有锁数 -> 新增秘钥锁费用
 *
 * 0锁 -> 第1锁：20
 * 1锁 -> 第2锁：30
 */
const LOCK_KEY = [
  20,
  30,
];


/* ============================================================
 * 工具函数
 * ============================================================ */

function popcount(x) {
  let n = 0;

  while (x) {
    x &= x - 1;
    n++;
  }

  return n;
}


function bits(mask) {
  const result = [];

  for (let i = 0; i < 3; i++) {
    if (mask & (1 << i)) {
      result.push(i);
    }
  }

  return result;
}


/**
 * 获得 >= t 阶的概率
 */
function tierGoodProb(t) {
  let sum = 0;

  for (let i = t; i <= 15; i++) {
    sum += TIER_P[i];
  }

  return sum;
}


/* ============================================================
 * 主求解函数
 * ============================================================ */

function solve(currentStr, targetStr, options = {}) {

  /**
   * Bellman 价值迭代精度
   */
  const epsilon =
    options.epsilon ?? 1e-10;

  /**
   * 最大迭代轮数
   */
  const maxIterations =
    options.maxIterations ?? 10000;

  /**
   * 判断两个策略石头期望“相同”的误差
   */
  const tieEps =
    options.tieEps ?? 1e-11;


  /**
   * 秘钥使用概率阈值 p（0~1，默认 0.1）。
   *
   * 秘钥策略下，只有当本次洗练有超过 p 的概率
   * 到达一个“更优”的状态时才允许使用秘钥锁；
   * 否则该动作视为不可用，直接使用石头洗练。
   *
   * “更优”以全石头策略的期望价值（refVs）为参照。
   */
  const keyP =
    typeof options.p === 'number' && options.p >= 0 && options.p <= 1
      ? options.p
      : 0.1;


  /* ==========================================================
   * 解析目标
   * ========================================================== */

  const targetTokens =
    targetStr.trim()
      ? targetStr
          .split(',')
          .map(s => s.trim())
      : [];


  if (targetTokens.length > 3) {
    throw new Error(
      '目标词条超过 3 个，装备只有 3 个栏位。'
    );
  }


  const targets = [];

  const seenEffect = new Set();

  /**
   * 原始 effect index
   * ->
   * 目标编号
   *
   * 合并目标（同一行多选）的所有成员
   * 都映射到同一个目标编号。
   */
  const tIndexByEffect =
    new Map();


  for (const tok of targetTokens) {

    /**
     * 支持合并目标：
     *
     *   uy13          单个词条
     *   bsbj11        暴击伤害 或 暴击率 >= 11
     *
     * 合并目标 = 同一行选中的多个词条按权重合并，
     * 抽中其中任意一个即达标。
     */
    const m = tok.match(
      /^((?:uy|gj|bs|fy|xl|xs|bj|mz|dr)+)(\d+)$/
    );


    if (!m) {
      throw new Error(
        '非法目标词条: ' + tok
      );
    }


    const names =
      m[1].match(
        /uy|gj|bs|fy|xl|xs|bj|mz|dr/g
      );


    const th = Number(m[2]);


    if (th < 1 || th > 15) {
      throw new Error(
        '目标阶数必须为 1..15: ' + tok
      );
    }


    /**
     * 所有词条不允许重复
     * （包括合并目标内部的成员）。
     */
    const dup =
      names.find(
        n => seenEffect.has(n)
      );


    if (dup !== undefined) {
      throw new Error(
        '目标词条重复: ' + dup
      );
    }


    for (const n of names) {
      seenEffect.add(n);
    }


    /**
     * 合并权重：
     *
     * 多个词条合并后相当于一个
     * “权重 = 各成员权重之和”的词条。
     */
    const weight =
      names.reduce(
        (s, n) =>
          s +
          EFFECTS[
            EFFECT_INDEX.get(n)
          ][1],
        0
      );


    const j =
      targets.length;


    for (const n of names) {
      tIndexByEffect.set(
        EFFECT_INDEX.get(n),
        j
      );
    }


    targets.push({

      /**
       * 展示名：成员代号直接拼接（如 bsbj）。
       */
      name:
        names.join(''),

      /**
       * 成员代号数组。
       */
      names,

      th,

      eidx:
        EFFECT_INDEX.get(
          names[0]
        ),

      weight,

      /**
       * 成员按权重类别计数：
       *
       * 抽词条时按成员逐个进入词条池
       * （与 O10/O12 非目标组一致）。
       */
      members10:
        names.filter(
          n =>
            EFFECTS[
              EFFECT_INDEX.get(n)
            ][1] === 0.10
        ).length,

      members12:
        names.filter(
          n =>
            EFFECTS[
              EFFECT_INDEX.get(n)
            ][1] === 0.12
        ).length,

      /**
       * 每次重新随机阶数以后，
       * 直接达到目标阶数的概率。
       *
       * 所有词条的阶数分布相同，
       * 所以合并目标直接沿用。
       */
      q:
        tierGoodProb(th),

    });

  }


  const m =
    targets.length;


  /* ==========================================================
   * 洗练规则版本
   *
   * 'cn'（默认，国服版）：
   *   xg 可以重复获得本栏原词条；阶数可以重复抽到原阶数。
   *
   * 'global'（国际服版）：
   *   ① xg 时本栏不会重复获得改造前的原词条
   *      （先判定是否获得词条，再在“排除本栏原词条”的词条池里抽取）；
   *   ② xg / sz 后本栏不会获得与改造前相同的阶数
   *      （在剩余阶数上按 TIER_P 归一化后抽取）。
   *
   * 国服版路径与改动前完全一致：band 维度恒为 0，阶数结果只有
   * “达标 / 未达标”两种，缓存键也与原来相同。
   * ========================================================== */

  const globalRules =
    options.ruleVersion === 'global';


  /**
   * 国际服版：未达标目标词条的阶数“档位”。
   *
   * “不会获得原阶数”的归一化系数取决于原阶数：原阶数的 TIER_P 越大
   * （即阶数越低），排除它以后重新抽到目标阶数的概率提升越明显。
   *
   * 低档 = 1~10 阶；高档 = 11 阶以上（仅 th>=12 时存在）。
   * 是否把“低档 / 高档”作为状态的一部分由 bandTierMode 决定：
   *   跟踪档位可以区分“1 阶洗目标 15 阶”与“11 阶洗目标 15 阶”，
   *   但会让状态空间成倍增长；状态空间过大时退回“按条件分布平均”，
   *   此时未达标词条不再区分档位（期望差异通常只有千分之一量级）。
   */
  const tierSetOfTarget =
    targets.map(
      t => {

        const th =
          t.th;

        const badLow = [];
        const badHigh = [];
        const badAll = [];
        const good = [];

        for (
          let x = 1;
          x <= 15;
          x++
        ) {

          if (x >= th) good.push(x);
          else {

            badAll.push(x);

            if (x <= 10) badLow.push(x);
            else badHigh.push(x);

          }

        }

        return { badLow, badHigh, badAll, good };

      }
    );


  /**
   * 阶数集合的 TIER_P 总质量（用于按条件分布加权）。
   */
  const tierMassCache =
    new Map();

  function tierMass(
    set
  ) {

    const key =
      set.join('.');

    const hit =
      tierMassCache.get(key);

    if (hit !== undefined) return hit;

    let s = 0;

    for (const x of set) s += TIER_P[x];

    tierMassCache.set(key, s);

    return s;

  }


  /**
   * 某个目标词条栏位的“原阶数集合”。
   *
   * 返回值同时用作缓存键的一部分：
   *   null        = 空栏（没有原阶数，不需要排除）
   *   'marginal'  = 非目标词条（原阶数未知，按 TIER_P 边缘分布平均）
   *   数组         = 目标词条（原阶数在该集合内等可能）
   */
  function oldTierSetAt(
    slots,
    bands,
    pos
  ) {

    const c =
      slots[pos];

    if (c === 0) return null;

    if (c === O10 || c === O12) return 'marginal';

    const j =
      targetOfCode(c);

    const sets =
      tierSetOfTarget[j];

    if (isGoodCode(c)) return sets.good;

    if (!bandTierMode) return sets.badAll;

    return bands[pos] === 1
      ? sets.badHigh
      : sets.badLow;

  }


  /** 阶数集合的缓存键。 */
  function tierSetKey(set) {

    if (set === null) return 'none';
    if (set === 'marginal') return 'marg';

    return set.join('.');

  }


  /**
   * 抽到目标 j 的一员时，阶数结果的分布（国际服版会排除原阶数）。
   *
   * 国服版直接返回原来的“达标 / 未达标”两种结果（band 恒为 0），
   * 保证行为与改动前逐位一致。
   */
  const tierOutcomeCache =
    new Map();

  function tierOutcomes(
    j,
    oldSet
  ) {

    if (!globalRules) {

      const q =
        targets[j].q;

      return [
        { good: true, band: 0, p: q },
        { good: false, band: 0, p: 1 - q },
      ];

    }

    const key =
      `${j}|${tierSetKey(oldSet)}`;

    const hit =
      tierOutcomeCache.get(key);

    if (hit) return hit;

    const sets =
      tierSetOfTarget[j];

    const out = [];

    /**
     * 把某个阶数集合的“新阶数概率”累加出来。
     *
     * 新阶数在该集合内取 x，概率 = 原阶数 o 上的平均：
     *   P(x | o) = TIER_P[x] / (1 - TIER_P[o])   （x != o）
     */
    const push =
      (good, band, set) => {

        let p = 0;

        for (const x of set) {

          if (oldSet === null) {

            p += TIER_P[x];

          }

          else if (oldSet === 'marginal') {

            for (let o = 1; o <= 15; o++) {

              if (o === x) continue;

              p +=
                TIER_P[o] *
                TIER_P[x] /
                (1 - TIER_P[o]);

            }

          }

          else {

            /**
             * 原阶数在该集合内：按 TIER_P 在该集合上的条件分布平均
             * （单档位集合内 TIER_P 相同，等价于集合内等可能）。
             */
            const norm =
              tierMass(oldSet);

            for (const o of oldSet) {

              if (o === x) continue;

              p +=
                (TIER_P[o] / norm) *
                TIER_P[x] /
                (1 - TIER_P[o]);

            }

          }

        }

        if (p > 0) out.push({ good, band, p });

      };

    push(true, 0, sets.good);

    if (bandTierMode) {

      if (sets.badLow.length) push(false, 0, sets.badLow);

      if (sets.badHigh.length) push(false, 1, sets.badHigh);

    }

    else if (sets.badAll.length) {

      push(false, 0, sets.badAll);

    }

    tierOutcomeCache.set(key, out);

    return out;

  }


  /**
   * 空装备首次变更效果：本次获得的词条阶数固定为 11
   * （国际服版下 11 阶还要落到正确的阶数档位）。
   */
  function blankTierOutcome(
    j
  ) {

    const good =
      targets[j].th <= 11;

    return {
      good,
      band: (bandTierMode && !good) ? 1 : 0,
      p: 1,
    };

  }


  /* ==========================================================
   * 状态压缩编码
   *
   * 0 = wd
   *
   * 对于每个目标：
   *
   *   未达标
   *   已达标
   *
   * 非目标词条：
   *
   *   O10 = 10%组
   *   O12 = 12%组
   *
   * ========================================================== */


  /**
   * 目标 j：
   *
   * 未达标：
   *   1 + 2*j
   *
   * 已达标：
   *   2 + 2*j
   */


  const O10 =
    1 + 2 * m;

  const O12 =
    2 + 2 * m;


  let nonTarget10 = 0;

  let nonTarget12 = 0;


  /**
   * 统计非目标词条数量。
   *
   * 用于无放回抽取。
   */
  for (
    let e = 0;
    e < EFFECTS.length;
    e++
  ) {

    if (
      tIndexByEffect.has(e)
    ) {
      continue;
    }


    if (
      EFFECTS[e][1] === 0.10
    ) {
      nonTarget10++;
    }
    else {
      nonTarget12++;
    }

  }


  function isTargetCode(c) {

    return (
      c >= 1 &&
      c <= 2 * m
    );

  }


  function targetOfCode(c) {

    return Math.floor(
      (c - 1) / 2
    );

  }


  /**
   * 目标编码：
   *
   * odd  = 未达标
   * even = 已达标
   */
  function isGoodCode(c) {

    return (
      ((c - 1) & 1) === 1
    );

  }


  function codeTarget(
    j,
    good
  ) {

    return (
      1 +
      2 * j +
      (good ? 1 : 0)
    );

  }


  /**
   * 检查压缩状态是否合法。
   *
   * 合并目标（同一行多选）的成员是不同词条，
   * 同一目标可以出现在多个栏位
   * （例如一件装备同时有 bs 和 bj），
   * 因此这里不再限制目标重复。
   */
  function validSlots(s) {

    let c10 = 0;

    let c12 = 0;


    for (const c of s) {

      if (
        isTargetCode(c)
      ) {

        // 目标可重复出现（合并目标的不同成员）

      }

      else if (
        c === O10
      ) {

        c10++;

      }

      else if (
        c === O12
      ) {

        c12++;

      }

    }


    return (
      c10 <= nonTarget10 &&
      c12 <= nonTarget12
    );

  }


  function occupiedMask(
    slots
  ) {

    let mask = 0;


    for (
      let i = 0;
      i < 3;
      i++
    ) {

      if (
        slots[i] !== 0
      ) {

        mask |=
          1 << i;

      }

    }


    return mask;
  }


  function stateKey(
    slots,
    lock,
    bands
  ) {

    return (
      `${lock}|` +
      `${slots[0]},` +
      `${slots[1]},` +
      `${slots[2]}|` +
      `${bands[0]},` +
      `${bands[1]},` +
      `${bands[2]}`
    );

  }


  /**
   * 判断目标是否已经全部满足。
   */
  function isGoalSlots(
    slots
  ) {

    for (
      let j = 0;
      j < m;
      j++
    ) {

      let ok =
        false;


      for (
        const c of slots
      ) {

        if (
          isTargetCode(c) &&
          targetOfCode(c) === j &&
          isGoodCode(c)
        ) {

          ok = true;

          break;

        }

      }


      if (!ok) {
        return false;
      }

    }


    return true;
  }


  /* ==========================================================
   * 枚举压缩后的完整状态空间
   * ========================================================== */


  let states = [];

  let idByKey =
    new Map();


  /**
   * 是否把“未达标词条的阶数档位”并入状态。
   *
   * 仅国际服版需要；且状态空间过大时关闭（退回按条件分布平均），
   * 以免多目标 + 高目标阶数时求解过慢。
   * options.bandTier === false 可直接关闭（角色版分解求解会用它换取速度）。
   */
  let bandTierMode =
    globalRules &&
    options.bandTier !== false;


  /**
   * 按需把状态放进状态空间（可达状态闭包）。
   *
   * 旧实现枚举“栏位 × 阶数档位 × 锁”的完整笛卡尔积，
   * 国际服版多目标时状态数会超过 BAND_STATE_LIMIT，
   * 只能退化关闭档位（未达标阶数按条件分布平均）。
   *
   * 现在改为从初始状态出发按需发现状态：
   * 状态数从完整积降到“真正可达”的那部分
   * （3 目标 15 阶：10829 -> 4981），档位得以保留；
   * 且因为可达集对转移封闭，数值与完整积模型完全一致。
   */
  function internState(
    slots,
    lock,
    bands
  ) {

    const key =
      stateKey(slots, lock, bands);


    let id =
      idByKey.get(key);


    if (id === undefined) {

      id = states.length;


      states.push({

        slots,

        lock,

        bands,

        goal:
          isGoalSlots(slots),

      });


      idByKey.set(key, id);

    }


    return id;

  }


  /**
   * 状态数上限：超过则关闭阶数档位（国际服版的近似退化）。
   */
  const BAND_STATE_LIMIT = 9000;


  /**
   * 围绕初始状态发现一次可达闭包。
   *
   * 会清空状态空间与动作 / 转移缓存，供档位模式超限时退回重算。
   */
  function buildReachable() {

    states = [];

    idByKey = new Map();


    actionCache[0].clear();

    actionCache[1].clear();

    transCache.clear();

    /**
     * 栏位结果分布与“是否启用档位”有关
     * （同一个 bands 键在两种模式下含义不同），必须一并清空。
     */
    slotDistCache.clear();

    tierOutcomeCache.clear();


    startId =
      internState(
        startSlots,
        startLock,
        bandTierMode
          ? startBands
          : [0, 0, 0]
      );


    /**
     * 逐个状态展开动作；新状态会追加到 states 末尾，
     * 循环条件每次重新读取长度，直到闭包稳定。
     *
     * 目标状态的价值恒为 0，run 会直接跳过，不需要展开。
     */
    for (
      let sid = 0;
      sid < states.length;
      sid++
    ) {

      if (states[sid].goal) {

        continue;

      }


      getActions(sid, 'key');

    }

  }


  /**
   * 初始化状态空间。
   *
   * 国际服版档位模式下若闭包仍然超限，
   * 则关闭档位（未达标阶数按条件分布平均）重算。
   */
  function initStateSpace() {

    buildReachable();


    if (
      bandTierMode &&
      states.length > BAND_STATE_LIMIT
    ) {

      bandTierMode = false;

      buildReachable();

    }

  }


  /* ==========================================================
   * 解析输入装备状态
   * ========================================================== */


  function parseCurrent(
    str
  ) {

    const toks =
      str
        .split(',')
        .map(
          s => s.trim()
        );


    if (
      toks.length !== 3
    ) {

      throw new Error(
        '当前装备必须恰好 3 个栏位。'
      );

    }


    const exactSeen =
      new Set();


    const slots = [];

    const bands = [];

    let lock = 0;


    toks.forEach(
      (tok, i) => {

        const mm =
          tok.match(
            /^([01])(wd|uy|gj|bs|fy|xl|xs|bj|mz|dr)(\d+)$/
          );


        if (!mm) {

          throw new Error(
            '非法栏位: ' + tok
          );

        }


        const lk =
          Number(mm[1]);


        const name =
          mm[2];


        const tier =
          Number(mm[3]);


        /**
         * 未获取效果
         */
        if (
          name === 'wd'
        ) {

          if (
            tier !== 0
          ) {

            throw new Error(
              'wd 的阶数必须为 0: ' +
              tok
            );

          }


          slots.push(0);

          bands.push(0);


          /**
           * 锁空栏位本身没有价值，
           * 而永久锁可以免费解除，
           * 所以直接规范化为未锁。
           */

        }

        else {

          if (
            tier < 1 ||
            tier > 15
          ) {

            throw new Error(
              '词条阶数必须为 1..15: ' +
              tok
            );

          }


          if (
            exactSeen.has(name)
          ) {

            throw new Error(
              '当前装备存在重复词条: ' +
              name
            );

          }


          exactSeen.add(name);


          const e =
            EFFECT_INDEX.get(name);


          const tj =
            tIndexByEffect.get(e);


          /**
           * 是目标词条
           */
          if (
            tj !== undefined
          ) {

            const good =
              tier >= targets[tj].th;

            slots.push(
              codeTarget(tj, good)
            );

            /**
             * 国际服版：未达标且阶数 >= 11 时记入高档，供“不会获得原阶数”使用。
             */
            bands.push(
              (bandTierMode && !good && tier >= 11)
                ? 1
                : 0
            );

          }

          /**
           * 不是目标词条
           */
          else {

            slots.push(

              EFFECTS[e][1]
                === 0.10

                ? O10
                : O12

            );

            bands.push(0);

          }


          /**
           * 输入中的1代表永久石头锁。
           */
          if (lk) {

            lock |=
              1 << i;

          }

        }

      }
    );


    if (
      popcount(lock) > 2
    ) {

      throw new Error(
        '系统最多只能锁 2 个栏位。'
      );

    }


    if (
      !validSlots(slots)
    ) {

      throw new Error(
        '当前状态无法映射到状态空间。'
      );

    }


    return {
      slots,
      lock,
      bands,
    };
  }


  /**
   * 初始状态（解析结果）。
   *
   * 状态空间由 buildReachable 按需发现，
   * 所以这里不再直接映射成状态编号。
   */
  const startParsed =
    parseCurrent(
      currentStr
    );


  const startSlots =
    startParsed.slots;


  const startLock =
    startParsed.lock;


  const startBands =
    startParsed.bands;


  let startId = -1;


  /* ==========================================================
   * 洗练结果概率缓存
   * ========================================================== */


  const slotDistCache =
    new Map();


  function slotsSig(
    slots
  ) {

    return (
      `${slots[0]},` +
      `${slots[1]},` +
      `${slots[2]}`
    );

  }


  function bandsSig(
    bands
  ) {

    return (
      `${bands[0]},` +
      `${bands[1]},` +
      `${bands[2]}`
    );

  }


  /**
   * 是否为空装备（三个栏位全空）。
   *
   * 空装备只可能是初始状态：栏位1获得词条的概率为 100%，
   * 一旦洗练过就不可能再回到全空状态。
   *
   * 空装备首次“变更效果”时，本次获得的所有词条阶数都固定为 11
   * （与 AffixSimulator 的 startWash 一致）。
   */
  function isBlankSlots(
    slots
  ) {

    return (
      slots[0] === 0 &&
      slots[1] === 0 &&
      slots[2] === 0
    );

  }


  /* ==========================================================
   * 变更效果 xg
   * ========================================================== */


  function getXgSlotDist(
    slots,
    bands,
    protect
  ) {

    /**
     * xg 时，
     * 没锁的原词条全部消失，
     * 所以缓存只需要记录被保护栏位。
     *
     * 例外：
     * ① 空装备第一次变更效果必定获得 11 阶词条；
     * ② 国际服版下每栏还会排除自己的原词条（xg 后不会获得相同词条），
     *    分布与未锁定栏位的原内容有关，缓存键要带上完整状态。
     */
    const blank =
      isBlankSlots(slots);


    let protSig = '';


    for (
      let i = 0;
      i < 3;
      i++
    ) {

      if (
        protect &
        (1 << i)
      ) {

        protSig +=
          `${i}:${slots[i]};`;

      }

    }


    const key =
      globalRules

        ? (
            `xg|${protect}|${slotsSig(slots)}|${bandsSig(bands)}` +
            (blank ? '|blank' : '')
          )

        : (
            `xg|${protect}|${protSig}` +
            (blank ? '|blank' : '')
          );


    if (
      slotDistCache.has(key)
    ) {

      return (
        slotDistCache.get(key)
      );

    }


    const out =
      [0, 0, 0];

    const outBands =
      [0, 0, 0];


    /**
     * 每个目标 j 剩余可抽的成员数：
     *
     * 合并目标按成员计数保留在词条池中
     * （与 O10/O12 非目标组一样），
     * 抽走一个成员只减一个计数，
     * 组内其他成员仍可继续抽。
     */
    const rem10 =
      targets.map(
        t => t.members10
      );

    const rem12 =
      targets.map(
        t => t.members12
      );


    /**
     * 10% / 12% 非目标池
     * 中剩余多少效果。
     */
    let r10 =
      nonTarget10;

    let r12 =
      nonTarget12;


    /**
     * 被锁的已有词条要从候选池删除，
     * 以保证词条不重复。
     */
    for (
      let i = 0;
      i < 3;
      i++
    ) {

      if (
        protect &
        (1 << i)
      ) {

        const c =
          slots[i];


        out[i] = c;


        if (
          isTargetCode(c)
        ) {

          /**
           * 目标 j 的一个成员被保护：
           * 从对应权重类别里减掉一个成员。
           *
           * 具体是哪个成员未知，
           * 但同类成员概率相等，误差可忽略。
           */
          const j =
            targetOfCode(c);


          if (
            rem10[j] > 0
          ) {

            rem10[j]--;

          }

          else if (
            rem12[j] > 0
          ) {

            rem12[j]--;

          }

        }

        else if (
          c === O10
        ) {

          r10--;

        }

        else if (
          c === O12
        ) {

          r12--;

        }

      }

    }


    const map =
      new Map();


    function add(prob) {

      if (
        prob === 0
      ) {
        return;
      }


      const k =
        `${slotsSig(out)}|${outBands.join(',')}`;


      map.set(
        k,
        (map.get(k) || 0) +
        prob
      );

    }


    /**
     * 按栏位 1 -> 2 -> 3
     * 顺序执行无放回抽取。
     */
    function rec(
      pos,
      prob,
      rr10,
      rr12
    ) {

      if (
        pos === 3
      ) {

        add(prob);

        return;

      }


      /**
       * 已锁栏位保持不变。
       */
      if (
        protect &
        (1 << pos)
      ) {

        rec(
          pos + 1,
          prob,
          rr10,
          rr12
        );

        return;

      }


      const acq =
        SLOT_GET[pos];


      /**
       * 计算当前剩余词条池总权重。
       */
      let total =
        rr10 * 0.10 +
        rr12 * 0.12;


      for (
        let j = 0;
        j < m;
        j++
      ) {

        total +=
          rem10[j] * 0.10 +
          rem12[j] * 0.12;

      }


      /**
       * 国际服版：本栏改造前的原词条在本次抽取中不可再获得。
       *
       * 注意只对本栏的抽取生效：本栏被重抽后原词条即被释放，
       * 后面的栏位仍然可以抽到它（未锁定栏位的旧词条不参与互斥）。
       */
      let ownKind = 0;   // 0 无；1 十%组；2 十二%组；3 目标(十%)；4 目标(十二%)
      let ownJ = -1;

      if (globalRules) {

        const c0 =
          slots[pos];

        if (c0 === O10) ownKind = 1;
        else if (c0 === O12) ownKind = 2;
        else if (isTargetCode(c0)) {

          ownJ = targetOfCode(c0);

          if (rem10[ownJ] > 0) ownKind = 3;
          else if (rem12[ownJ] > 0) ownKind = 4;

        }

      }


      const drawTotal =
        total -
        (
          ownKind === 0
            ? 0
            : (ownKind === 1 || ownKind === 3 ? 0.10 : 0.12)
        );


      /**
       * 词条池已空（例如合并目标把大权重一次性抽走、
       * 或剩余目标都被保护/占用时）：
       *
       * 本栏位必然拿不到词条（wd），
       * 概率必须完整保留，不能丢弃。
       */
      if (
        drawTotal <= 0
      ) {

        out[pos] = 0;

        outBands[pos] = 0;


        rec(
          pos + 1,
          prob,
          rr10,
          rr12
        );

        return;

      }


      /**
       * 本栏位没有获得词条。
       */
      if (
        acq < 1
      ) {

        out[pos] = 0;

        outBands[pos] = 0;


        rec(
          pos + 1,
          prob * (1 - acq),
          rr10,
          rr12
        );

      }


      /* ------------------------------------------------------
       * 抽到某个目标词条
       * ------------------------------------------------------ */

      for (
        let j = 0;
        j < m;
        j++
      ) {

        /**
         * 本次抽到目标 j 的成员后的阶数结果分布。
         *
         * 国服版：达标 / 未达标两种（阶数不参与状态）。
         * 国际服版：按“不会获得原阶数”归一化后的 (达标?, 阶数档位) 分布；
         *   空装备第一次变更效果时，本次词条阶数固定为 11。
         */
        const outcomes =
          blank
            ? [blankTierOutcome(j)]
            : tierOutcomes(
                j,
                oldTierSetAt(slots, bands, pos)
              );


        /**
         * 本栏原词条在本次抽取中不可再获得（国际服版）。
         */
        const avail10 =
          rem10[j] -
          (ownKind === 3 && ownJ === j ? 1 : 0);

        const avail12 =
          rem12[j] -
          (ownKind === 4 && ownJ === j ? 1 : 0);


        /**
         * 抽到目标 j 的一个 10% 权重成员。
         */
        if (
          avail10 > 0
        ) {

          const pe =
            acq *
            avail10 *
            0.10 /
            drawTotal;


          rem10[j]--;


          for (const oc of outcomes) {

            if (oc.p <= 0) continue;

            out[pos] =
              codeTarget(
                j,
                oc.good
              );

            outBands[pos] = oc.band;


            rec(
              pos + 1,

              prob *
                pe *
                oc.p,

              rr10,
              rr12
            );

          }


          rem10[j]++;

        }


        /**
         * 抽到目标 j 的一个 12% 权重成员。
         */
        if (
          avail12 > 0
        ) {

          const pe =
            acq *
            avail12 *
            0.12 /
            drawTotal;


          rem12[j]--;


          for (const oc of outcomes) {

            if (oc.p <= 0) continue;

            out[pos] =
              codeTarget(
                j,
                oc.good
              );

            outBands[pos] = oc.band;


            rec(
              pos + 1,

              prob *
                pe *
                oc.p,

              rr10,
              rr12
            );

          }


          rem12[j]++;

        }

      }


      /* ------------------------------------------------------
       * 抽到10%组非目标词条
       * ------------------------------------------------------ */

      const availR10 =
        rr10 - (ownKind === 1 ? 1 : 0);

      const availR12 =
        rr12 - (ownKind === 2 ? 1 : 0);


      if (
        availR10 > 0
      ) {

        const pe =
          acq *
          (availR10 * 0.10) /
          drawTotal;


        out[pos] =
          O10;

        outBands[pos] = 0;


        rec(
          pos + 1,
          prob * pe,
          rr10 - 1,
          rr12
        );

      }


      /* ------------------------------------------------------
       * 抽到12%组非目标词条
       * ------------------------------------------------------ */

      if (
        availR12 > 0
      ) {

        const pe =
          acq *
          (availR12 * 0.12) /
          drawTotal;


        out[pos] =
          O12;

        outBands[pos] = 0;


        rec(
          pos + 1,
          prob * pe,
          rr10,
          rr12 - 1
        );

      }

    }


    rec(
      0,
      1,
      r10,
      r12
    );


    const dist = [];


    for (
      const [k, p] of map
    ) {

      const parts =
        k.split('|');


      const sl =
        parts[0]
          .split(',')
          .map(Number);


      const bd =
        parts[1]
          .split(',')
          .map(Number);


      dist.push({

        slots: sl,

        bands: bd,

        p,

      });

    }


    slotDistCache.set(
      key,
      dist
    );


    return dist;
  }


  /* ==========================================================
   * 变更数值 sz
   * ========================================================== */


  function getSzSlotDist(
    slots,
    bands,
    protect
  ) {

    const key =
      `sz|${protect}|${slotsSig(slots)}|${bandsSig(bands)}`;


    if (
      slotDistCache.has(key)
    ) {

      return (
        slotDistCache.get(key)
      );

    }


    const out =
      slots.slice();

    const outBands =
      bands.slice();


    const map =
      new Map();


    function add(prob) {

      const k =
        `${slotsSig(out)}|${outBands.join(',')}`;


      map.set(
        k,
        (map.get(k) || 0) +
        prob
      );

    }


    function rec(
      pos,
      prob
    ) {

      if (
        pos === 3
      ) {

        add(prob);

        return;
      }


      const c =
        slots[pos];


      /**
       * 被锁栏位不变化。
       *
       * 非目标词条无需记录具体阶数，
       * 因为无论怎么变数值，它都仍然不是目标。
       */
      if (
        (protect & (1 << pos)) ||
        !isTargetCode(c)
      ) {

        rec(
          pos + 1,
          prob
        );

        return;

      }


      const j =
        targetOfCode(c);


      /**
       * 变更数值：只重抽阶数。
       *
       * 国服版：达标 / 未达标两种结果。
       * 国际服版：不会获得原阶数，按 (达标?, 阶数档位) 分布。
       */
      const outcomes =
        tierOutcomes(
          j,
          oldTierSetAt(slots, bands, pos)
        );


      for (const oc of outcomes) {

        if (oc.p <= 0) continue;

        out[pos] =
          codeTarget(
            j,
            oc.good
          );

        outBands[pos] = oc.band;


        rec(
          pos + 1,
          prob * oc.p
        );

      }


      /**
       * 恢复，
       * 供递归其他分支使用。
       */
      out[pos] = c;

      outBands[pos] = bands[pos];

    }


    rec(
      0,
      1
    );


    const dist = [];


    for (
      const [k, p] of map
    ) {

      const parts =
        k.split('|');


      dist.push({

        slots:
          parts[0]
            .split(',')
            .map(Number),

        bands:
          parts[1]
            .split(',')
            .map(Number),

        p,

      });

    }


    slotDistCache.set(
      key,
      dist
    );


    return dist;
  }


  /* ==========================================================
   * 完整状态转移
   * ========================================================== */


  const transCache =
    new Map();


  /**
   * mode:
   *
   * stone
   *   新锁使用永久石头锁
   *
   * key
   *   新锁使用一次性秘钥锁
   *
   *
   * protect：
   *
   * 本次洗练中保护哪些栏位。
   */
  function getTransitions(
    stateId,
    protect,
    wash,
    mode
  ) {

    const st =
      states[stateId];


    /**
     * 当前已经存在的永久锁，
     * 如果继续保护，则洗练后仍然存在。
     */
    const keep =
      st.lock &
      protect;


    /**
     * 全石头策略：
     *
     * 本次新增的锁也是永久锁，
     * 所以下一步永久锁状态 = protect
     *
     *
     * 秘钥策略：
     *
     * 新增的是临时锁，
     * 洗练后自动解除。
     *
     * 只有原有并继续保留的永久锁存在。
     */
    const nextLock =
      mode === 'stone'
        ? protect
        : keep;


    const baseKey =
      wash === 'xg'

        ? (
            /**
             * 国际服版：xg 分布与本栏原词条/原阶数有关，必须按完整状态缓存；
             * 国服版分布只与“被保护的栏位”有关（原词条会全部消失）。
             */
            globalRules

              ? (
                  `xg|${protect}|` +
                  `${slotsSig(st.slots)}|${bandsSig(st.bands)}` +
                  (isBlankSlots(st.slots) ? '|blank' : '')
                )

              : (
                  `xg|${protect}|` +

                  [0, 1, 2]
                    .filter(
                      i =>
                        protect &
                        (1 << i)
                    )
                    .map(
                      i =>
                        `${i}:${st.slots[i]}`
                    )
                    .join(';') +

                  /**
                   * 空装备第一次变更效果是特殊分布（必定 11 阶），
                   * 不能与其它“无保护栏位”状态共用缓存。
                   */
                  (isBlankSlots(st.slots) ? '|blank' : '')
                )
          )

        : (
            `sz|${protect}|` +
            `${slotsSig(st.slots)}|${bandsSig(st.bands)}`
          );


    const cacheKey =
      `${mode}|${nextLock}|${baseKey}`;


    if (
      transCache.has(cacheKey)
    ) {

      return (
        transCache.get(cacheKey)
      );

    }


    const base =
      wash === 'xg'

        ? getXgSlotDist(
            st.slots,
            st.bands,
            protect
          )

        : getSzSlotDist(
            st.slots,
            st.bands,
            protect
          );


    const agg =
      new Map();


    for (
      const o of base
    ) {

      const id =
        internState(
          o.slots,
          nextLock,
          o.bands
        );


      agg.set(
        id,
        (agg.get(id) || 0) +
        o.p
      );

    }


    const dist =
      [...agg.entries()]
        .map(
          ([id, p]) => ({
            id,
            p,
          })
        );


    transCache.set(
      cacheKey,
      dist
    );


    return dist;
  }


  /* ==========================================================
   * 动作枚举
   * ========================================================== */


  const actionCache = [
    new Map(),
    new Map(),
  ];


  function getActions(
    stateId,
    mode
  ) {

    const mi =
      mode === 'stone'
        ? 0
        : 1;


    const c =
      actionCache[mi];


    if (
      c.has(stateId)
    ) {

      return (
        c.get(stateId)
      );

    }


    const st =
      states[stateId];


    const occ =
      occupiedMask(
        st.slots
      );


    const arr = [];

    /**
     * “效果保留”后的状态：
     * 各栏内容不变，只把锁状态换成“本轮结束时的锁”。
     * 空装备首次改造（必定 11 阶）强制应用，不提供保留。
     */
    const blankForceApply =
      isBlankSlots(st.slots);

    function keepStateId(mask) {

      return internState(
        st.slots,
        mask,
        st.bands
      );

    }


    /**
     * protect =
     * 本次洗练时锁哪些栏。
     *
     * 0..7 = 3bit mask
     */
    for (
      let protect = 0;
      protect < 8;
      protect++
    ) {

      /**
       * 空栏不能保护。
       */
      if (
        (protect & ~occ) !== 0
      ) {
        continue;
      }


      /**
       * 最多2锁。
       */
      if (
        popcount(protect) > 2
      ) {
        continue;
      }


      /**
       * 原有永久锁中继续保留的。
       */
      const keep =
        st.lock &
        protect;


      /**
       * 本次新增锁。
       */
      const newMask =
        protect &
        ~st.lock;


      const retained =
        popcount(keep);


      const added =
        popcount(newMask);


      const nlock =
        popcount(protect);


      /**
       * 洗练本身的石头费用。
       */
      const washStone =
        WASH_STONE[nlock];


      /**
       * 石头变体：
       *
       * 新增锁使用永久石头锁。
       *
       * 始终可用。
       */
      let stoneV =
        washStone;


      /**
       * 秘钥变体：
       *
       * 新增锁使用一次性秘钥锁，
       * 洗练后自动解除。
       *
       * 仅在秘钥模式下生成，
       * 且要满足“本次洗练有超过 p 的概率
       * 到达更优状态”才会被允许。
       */
      let keyV = 0;


      for (
        let k = 0;
        k < added;
        k++
      ) {

        const before =
          retained + k;


        stoneV +=
          LOCK_STONE[before];


        keyV +=
          LOCK_KEY[before];

      }


      /**
       * xg
       * sz
       */
      for (
        const wash of [
          'xg',
          'sz',
        ]
      ) {

        /**
         * 石头锁动作（永久锁，转移后锁保留）。
         */
        const transStone =
          getTransitions(
            stateId,
            protect,
            wash,
            'stone'
          );


        if (
          !(
            transStone.length === 1 &&
            transStone[0].id === stateId &&
            Math.abs(
              transStone[0].p - 1
            ) < 1e-14
          )
        ) {

          arr.push({

            protect,

            wash,

            stone: stoneV,

            key: 0,

            trans: transStone,

            /**
             * 是否使用了秘钥锁。
             */
            useKey: false,

            /**
             * “效果保留”相关：保留后的状态 + 是否强制应用。
             * 石头模式下本轮结束时的永久锁 = protect。
             */
            keepId:
              keepStateId(protect),

            forceApply:
              wash === 'xg' &&
              blankForceApply,

          });

        }


        /**
         * 秘钥锁动作：
         *
         * 新锁用一次性秘钥锁，
         * 洗练后锁自动解除（nextLock=keep）。
         *
         * 只在秘钥模式且确实新增锁时生成；
         * 是否允许由秘钥阈值 p 决定。
         */
        if (
          mode === 'key' &&
          added > 0
        ) {

          const transKey =
            getTransitions(
              stateId,
              protect,
              wash,
              'key'
            );


          if (
            !(
              transKey.length === 1 &&
              transKey[0].id === stateId &&
              Math.abs(
                transKey[0].p - 1
              ) < 1e-14
            )
          ) {

            arr.push({

              protect,

              wash,

              stone: washStone,

              key: keyV,

              trans: transKey,

              useKey: true,

              /**
               * 秘钥模式下本轮结束时的永久锁 = 原有并继续保留的锁。
               */
              keepId:
                keepStateId(keep),

              forceApply:
                wash === 'xg' &&
                blankForceApply,

            });

          }

        }

      }

    }


    c.set(
      stateId,
      arr
    );


    return arr;
  }


  /* ==========================================================
   * 策略比较
   * ========================================================== */


  /**
   * lex = false
   *
   *   只比较石头
   *
   *
   * lex = true
   *
   *   第一优先级：石头最少
   *   第二优先级：秘钥最少
   */
  function better(
    aS,
    aK,
    bS,
    bK,
    lex
  ) {

    if (
      !Number.isFinite(bS)
    ) {

      return true;

    }


    const tol =
      tieEps *
      Math.max(
        1,
        Math.abs(aS),
        Math.abs(bS)
      );


    if (
      aS <
      bS - tol
    ) {

      return true;

    }


    if (
      aS >
      bS + tol
    ) {

      return false;

    }


    /**
     * 石头基本相同时，
     * 再比较秘钥。
     */
    return (
      lex

        ? (
            aK <
            bK -
              tieEps *
              Math.max(
                1,
                Math.abs(aK),
                Math.abs(bK)
              )
          )

        : false
    );

  }


  /* ==========================================================
   * Bellman 价值迭代
   * ========================================================== */


  function run(mode, refVs) {

    const lex =
      mode === 'key';


    /**
     * Vstone[s]
     */
    const vs =
      new Float64Array(
        states.length
      );


    /**
     * Vkey[s]
     *
     * 只在允许秘钥模式下需要。
     */
    const vk =
      lex

        ? new Float64Array(
            states.length
          )

        : null;


    let converged =
      false;


    let iter = 0;


    for (
      iter = 0;
      iter < maxIterations;
      iter++
    ) {

      let maxRel = 0;


      /**
       * Gauss-Seidel 风格价值迭代：
       *
       * 每算完一个状态就立即更新。
       */
      for (
        let sid = 0;
        sid < states.length;
        sid++
      ) {

        /**
         * 目标状态价值为0。
         */
        if (
          states[sid].goal
        ) {

          continue;

        }


        const oldS =
          vs[sid];


        const oldK =
          lex
            ? vk[sid]
            : 0;


        let bestS =
          Infinity;


        let bestK =
          Infinity;


        /**
         * 枚举所有合法动作。
         */
        for (
          const a of
          getActions(
            sid,
            mode
          )
        ) {

          /**
           * 秘钥阈值过滤：
           *
           * 秘钥模式下，仅当本次洗练有超过 p 的概率
           * 到达更优状态的动作才允许使用秘钥；
           * 否则该动作不可用（直接用石头洗练）。
           */
          if (
            lex &&
            a.key > 0 &&
            refVs
          ) {

            const tol =
              tieEps *
              Math.max(
                1,
                Math.abs(
                  refVs[sid]
                )
              );

            let pImp = 0;

            for (
              const tr of a.trans
            ) {

              if (
                tr.id !== sid &&
                refVs[tr.id] <
                  refVs[sid] -
                  tol
              ) {

                pImp +=
                  tr.p;

              }

            }

            if (
              pImp <= keyP
            ) {

              continue;

            }

          }


          let pSelf = 0;


          /**
           * 当前动作立即成本。
           */
          let nS =
            a.stone;


          let nK =
            a.key;


          /**
           * “效果保留”：洗练结果不如当前时，玩家可以选择保留原词条
           * （只重置本轮结果，秘钥锁仍会解除；空装备首次改造强制应用）。
           *
           * keepId = 保留后的状态 =（当前各栏内容, 本轮结束时的锁, 阶数档位）。
           * 因此每个结果的实际价值 = min(V(keepId), V(结果))；
           * keepId === sid 时该分支就是自环，仍可用解析式提出。
           */
          const keepId =
            a.keepId;

          const keepAllowed =
            !a.forceApply &&
            keepId !== undefined;


          /**
           * 累加未来价值。
           */
          for (
            const tr of
            a.trans
          ) {

            const kS =
              keepAllowed
                ? vs[keepId]
                : Infinity;

            const kK =
              (keepAllowed && lex)
                ? vk[keepId]
                : 0;


            /**
             * 结果不比“保留”更好 → 玩家保留。
             */
            const keepThis =
              keepAllowed &&
              !better(
                vs[tr.id],
                lex ? vk[tr.id] : 0,
                kS,
                kK,
                lex
              );


            if (
              keepThis
            ) {

              if (
                keepId === sid
              ) {

                pSelf +=
                  tr.p;

              }

              else {

                nS +=
                  tr.p *
                  kS;


                if (lex) {

                  nK +=
                    tr.p *
                    kK;

                }

              }

            }

            /**
             * 自环单独处理。
             */
            else if (
              tr.id === sid
            ) {

              pSelf +=
                tr.p;

            }

            else {

              nS +=
                tr.p *
                vs[tr.id];


              if (lex) {

                nK +=
                  tr.p *
                  vk[tr.id];

              }

            }

          }


          /**
           * Bellman：
           *
           * V =
           *   C
           *   + pSelf * V
           *   + Σ p(s')V(s')
           *
           * 所以：
           *
           * V =
           *
           *   C + Σ_{s' != s}pV
           *   -------------------
           *       1 - pSelf
           */
          const den =
            1 - pSelf;


          if (
            den <= 1e-14
          ) {

            continue;

          }


          const cS =
            nS / den;


          const cK =
            lex
              ? nK / den
              : 0;


          if (
            better(
              cS,
              cK,
              bestS,
              bestK,
              lex
            )
          ) {

            bestS =
              cS;


            bestK =
              cK;

          }

        }


        if (
          !Number.isFinite(
            bestS
          )
        ) {

          throw new Error(
            '存在无法到达目标的状态。'
          );

        }


        vs[sid] =
          bestS;


        if (lex) {

          vk[sid] =
            bestK;

        }


        /**
         * 判断收敛。
         */
        const relS =
          Math.abs(
            bestS -
            oldS
          ) /
          Math.max(
            1,
            Math.abs(bestS)
          );


        const relK =
          lex

            ? (
                Math.abs(
                  bestK -
                  oldK
                ) /
                Math.max(
                  1,
                  Math.abs(bestK)
                )
              )

            : 0;


        if (
          relS > maxRel
        ) {

          maxRel =
            relS;

        }


        if (
          relK > maxRel
        ) {

          maxRel =
            relK;

        }

      }


      if (
        maxRel < epsilon
      ) {

        converged =
          true;

        break;

      }

    }


    if (
      !converged
    ) {

      throw new Error(
        `价值迭代未在 ${maxIterations} 轮内收敛，` +
        `可提高 maxIterations 或放宽 epsilon。`
      );

    }


    /* --------------------------------------------------------
     * 根据最终价值函数，
     * 找某状态最优动作。
     * -------------------------------------------------------- */

    function bestAction(
      sid
    ) {

      if (
        states[sid].goal
      ) {

        return null;

      }


      let best =
        null;


      let bS =
        Infinity;


      let bK =
        Infinity;


      for (
        const a of
        getActions(
          sid,
          mode
        )
      ) {

        /**
         * 与价值迭代相同的秘钥阈值过滤。
         */
        if (
          lex &&
          a.key > 0 &&
          refVs
        ) {

          const tol =
            tieEps *
            Math.max(
              1,
              Math.abs(
                refVs[sid]
              )
            );

          let pImp = 0;

          for (
            const tr of a.trans
          ) {

            if (
              tr.id !== sid &&
              refVs[tr.id] <
                refVs[sid] -
                tol
            ) {

              pImp +=
                tr.p;

            }

          }

          if (
            pImp <= keyP
          ) {

            continue;

          }

        }


        let pSelf = 0;


        let nS =
          a.stone;


        let nK =
          a.key;


        /**
         * 与价值迭代相同的“效果保留”处理：
         * 结果不比保留更好时，玩家保留（keepId === sid 时归入自环）。
         */
        const keepId =
          a.keepId;

        const keepAllowed =
          !a.forceApply &&
          keepId !== undefined;


        for (
          const tr of
          a.trans
        ) {

          const kS =
            keepAllowed
              ? vs[keepId]
              : Infinity;

          const kK =
            (keepAllowed && lex)
              ? vk[keepId]
              : 0;


          const keepThis =
            keepAllowed &&
            !better(
              vs[tr.id],
              lex ? vk[tr.id] : 0,
              kS,
              kK,
              lex
            );


          if (keepThis) {

            if (keepId === sid) {

              pSelf +=
                tr.p;

            }

            else {

              nS +=
                tr.p *
                kS;


              if (lex) {

                nK +=
                  tr.p *
                  kK;

              }

            }

          }

          else if (
            tr.id === sid
          ) {

            pSelf +=
              tr.p;

          }

          else {

            nS +=
              tr.p *
              vs[tr.id];


            if (lex) {

              nK +=
                tr.p *
                vk[tr.id];

            }

          }

        }


        const den =
          1 - pSelf;


        if (
          den <= 1e-14
        ) {

          continue;

        }


        const cS =
          nS / den;


        const cK =
          lex
            ? nK / den
            : 0;


        if (
          better(
            cS,
            cK,
            bS,
            bK,
            lex
          )
        ) {

          best = a;

          bS = cS;

          bK = cK;

        }

      }


      return best;
    }


    return {

      stone:
        vs[startId],

      keys:
        lex
          ? vk[startId]
          : 0,

      action:
        bestAction(
          startId
        ),

      iterations:
        iter + 1,

      /**
       * 暴露价值函数：
       *
       * 全石头模式的价值函数
       * 作为秘钥模式“更优状态”的参照。
       */
      vs,

      vk,

    };
  }


  /* ==========================================================
   * 分别求：
   *
   * 1. 全石头策略
   * 2. 允许秘钥策略
   * ========================================================== */


  /**
   * 发现可达状态空间
   * （国际服版档位模式下若仍超限则退回关闭档位重算）。
   */
  initStateSpace();


  const stoneRun =
    run('stone');


  const keyRun =
    run(
      'key',
      stoneRun.vs
    );


  /* ==========================================================
   * 把内部动作转换成人类可读动作
   * ========================================================== */


  function planInfo(
    run,
    mode
  ) {

    const st =
      states[startId];


    const a =
      run.action;


    /**
     * 已经完成目标。
     */
    if (!a) {

      return {

        action: '',

        unlock: [],

        newLocks: [],

        lockMaterial:
          mode === 'key'
            ? 'key'
            : 'stone',

      };

    }


    /**
     * 当前永久锁，
     * 但是本次不再保护：
     *
     * 可以免费解除。
     */
    const unlockMask =
      st.lock &
      ~a.protect;


    /**
     * 本次新增加的锁。
     */
    const newMask =
      a.protect &
      ~st.lock;


    const newLocks =
      bits(newMask)
        .map(
          i => i + 1
        );


    const unlock =
      bits(unlockMask)
        .map(
          i => i + 1
        );


    /**
     * 用户定义动作：
     *
     * s1   （小写 s = 秘钥锁，仅秘钥策略）
     * S1   （大写 S = 永久石头锁）
     * xg
     * sz
     *
     * 秘钥策略里如果选中的是石头锁动作
     * （不满足秘钥阈值时回退用石头），
     * 用大写 S 区分，避免 UI 误标成秘钥锁。
     */
    const lockMaterial =
      a.useKey
        ? 'key'
        : 'stone';


    const tokens =
      newLocks.map(
        i => (
          a.useKey
            ? 's'
            : 'S'
        ) + i
      );


    tokens.push(
      a.wash
    );


    return {

      action:
        tokens.join(','),

      unlock,

      newLocks,

      lockMaterial,

      wash:
        a.wash,

    };
  }


  const stonePlan =
    planInfo(
      stoneRun,
      'stone'
    );


  const keyPlan =
    planInfo(
      keyRun,
      'key'
    );


  /* ==========================================================
   * 格式化输出
   * ========================================================== */


  function fmt(x) {

    /**
     * 很接近整数则直接显示整数。
     */
    if (
      Math.abs(
        x -
        Math.round(x)
      ) < 1e-9
    ) {

      return String(
        Math.round(x)
      );

    }


    return (
      x
        .toFixed(
          options.digits ??
          6
        )
        .replace(
          /0+$/,
          ''
        )
        .replace(
          /\.$/,
          ''
        )
    );

  }


  /**
   * 例如：
   *
   * 256/246-300
   */
  const cost =

    `${fmt(
      stoneRun.stone
    )}/` +

    `${fmt(
      keyRun.stone
    )}-` +

    `${fmt(
      keyRun.keys
    )}`;


  /**
   * 如果你想直接得到一个字符串：
   *
   * 256/246-300|s1,xg
   */
  const text =

    `${cost}|` +
    `${keyPlan.action}`;


  return {

    /**
     * 用户要求的成本格式：
     *
     * 全石头 /
     * 秘钥策略石头 -
     * 秘钥
     */
    cost,


    /**
     * 默认返回：
     *
     * 允许秘钥时，
     * 石头期望最少的下一步动作。
     */
    action:
      keyPlan.action,


    /**
     * 拼好的完整文本。
     */
    text,


    /**
     * 如果最优策略要求
     * 免费解除永久锁，
     * 会出现在这里。
     *
     * 例如：
     *
     * [1,3]
     */
    preUnlock:
      keyPlan.unlock,


    /**
     * action 中的新增锁，
     * 在默认策略中是秘钥锁。
     */
    keyLockSlots:
      keyPlan.newLocks,


    /**
     * 完全不用秘钥时，
     * 下一步最优动作。
     *
     * 这里的 sN 表示石头永久锁。
     */
    stoneOnlyAction:
      stonePlan.action,


    /**
     * 全石头策略需要
     * 免费解锁哪些栏位。
     */
    stoneOnlyPreUnlock:
      stonePlan.unlock,


    /**
     * 未格式化的原始数值。
     */
    expected: {

      stoneOnly:
        stoneRun.stone,

      withKeysStone:
        keyRun.stone,

      withKeysKeys:
        keyRun.keys,

    },


    /**
     * 调试信息。
     */
    iterations: {

      stoneOnly:
        stoneRun.iterations,

      withKeys:
        keyRun.iterations,

    },


    /**
     * 压缩后的状态数。
     */
    stateCount:
      states.length,

  };
}


/* ============================================================
 * 命令行测试
 * ============================================================ */


if (
  require.main === module
) {

  const cases = [

    [
      '0wd0,0wd0,0wd0',
      'gj1',
    ],

    [
      '0wd0,0wd0,0wd0',
      'gj13',
    ],

    [
      '0gj11,1uy11,0wd0',
      'gj13,uy13,dr13',
    ],

  ];


  for (
    const c of cases
  ) {

    const name =
      c.join(' / ');


    console.time(name);


    try {

      const result =
        solve(
          ...c,
          {
            epsilon: 1e-9,
            maxIterations: 5000,
            digits: 6,
          }
        );


      console.log(
        '\n',
        c,
        '\n',
        result
      );

    }

    catch (e) {

      console.error(e);

    }


    console.timeEnd(name);

  }

}


/* ============================================================
 * CommonJS 导出
 * ============================================================ */

module.exports = {
  solve,
};