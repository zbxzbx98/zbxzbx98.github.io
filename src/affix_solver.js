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
    lock
  ) {

    return (
      `${lock}|` +
      `${slots[0]},` +
      `${slots[1]},` +
      `${slots[2]}`
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


  const slotOptions = [];


  /**
   * wd
   */
  slotOptions.push(0);


  /**
   * 每个目标：
   *
   * 未达标
   * 已达标
   */
  for (
    let j = 0;
    j < m;
    j++
  ) {

    slotOptions.push(
      codeTarget(j, false),
      codeTarget(j, true)
    );

  }


  /**
   * 如果存在该类型非目标词条，
   * 加入对应压缩状态。
   */
  if (
    nonTarget10 > 0
  ) {

    slotOptions.push(
      O10
    );

  }


  if (
    nonTarget12 > 0
  ) {

    slotOptions.push(
      O12
    );

  }


  const states = [];

  const idByKey =
    new Map();


  for (
    const a of slotOptions
  ) {

    for (
      const b of slotOptions
    ) {

      for (
        const c of slotOptions
      ) {

        const slots =
          [a, b, c];


        if (
          !validSlots(slots)
        ) {
          continue;
        }


        const occ =
          occupiedMask(slots);


        /**
         * lock:
         *
         * bit0 = 栏位1
         * bit1 = 栏位2
         * bit2 = 栏位3
         */
        for (
          let lock = 0;
          lock < 8;
          lock++
        ) {

          /**
           * 空栏位不能锁。
           */
          if (
            (lock & ~occ) !== 0
          ) {
            continue;
          }


          /**
           * 最多锁2栏。
           */
          if (
            popcount(lock) > 2
          ) {
            continue;
          }


          const id =
            states.length;


          states.push({

            slots,

            lock,

            goal:
              isGoalSlots(slots),

          });


          idByKey.set(
            stateKey(
              slots,
              lock
            ),
            id
          );

        }

      }

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

            slots.push(

              codeTarget(
                tj,
                tier >=
                  targets[tj].th
              )

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


    const id =
      idByKey.get(
        stateKey(
          slots,
          lock
        )
      );


    if (
      id === undefined
    ) {

      throw new Error(
        '当前状态无法映射到状态空间。'
      );

    }


    return id;
  }


  const startId =
    parseCurrent(
      currentStr
    );


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


  /* ==========================================================
   * 变更效果 xg
   * ========================================================== */


  function getXgSlotDist(
    slots,
    protect
  ) {

    /**
     * xg 时，
     * 没锁的原词条全部消失，
     * 所以缓存只需要记录被保护栏位。
     */
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
      `xg|${protect}|${protSig}`;


    if (
      slotDistCache.has(key)
    ) {

      return (
        slotDistCache.get(key)
      );

    }


    const out =
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
        slotsSig(out);


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
       * 词条池已空（例如合并目标把大权重一次性抽走、
       * 或剩余目标都被保护/占用时）：
       *
       * 本栏位必然拿不到词条（wd），
       * 概率必须完整保留，不能丢弃。
       */
      if (
        total <= 0
      ) {

        out[pos] = 0;


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

        const q =
          targets[j].q;


        /**
         * 抽到目标 j 的一个 10% 权重成员。
         */
        if (
          rem10[j] > 0
        ) {

          const pe =
            acq *
            rem10[j] *
            0.10 /
            total;


          rem10[j]--;


          /**
           * 阶数达标
           */
          if (
            q > 0
          ) {

            out[pos] =
              codeTarget(
                j,
                true
              );


            rec(
              pos + 1,

              prob *
                pe *
                q,

              rr10,
              rr12
            );

          }


          /**
           * 阶数不达标
           */
          if (
            q < 1
          ) {

            out[pos] =
              codeTarget(
                j,
                false
              );


            rec(
              pos + 1,

              prob *
                pe *
                (1 - q),

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
          rem12[j] > 0
        ) {

          const pe =
            acq *
            rem12[j] *
            0.12 /
            total;


          rem12[j]--;


          if (
            q > 0
          ) {

            out[pos] =
              codeTarget(
                j,
                true
              );


            rec(
              pos + 1,

              prob *
                pe *
                q,

              rr10,
              rr12
            );

          }


          if (
            q < 1
          ) {

            out[pos] =
              codeTarget(
                j,
                false
              );


            rec(
              pos + 1,

              prob *
                pe *
                (1 - q),

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

      if (
        rr10 > 0
      ) {

        const pe =
          acq *
          (rr10 * 0.10) /
          total;


        out[pos] =
          O10;


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
        rr12 > 0
      ) {

        const pe =
          acq *
          (rr12 * 0.12) /
          total;


        out[pos] =
          O12;


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

      dist.push({

        slots:
          k
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
   * 变更数值 sz
   * ========================================================== */


  function getSzSlotDist(
    slots,
    protect
  ) {

    const key =
      `sz|${protect}|${slotsSig(slots)}`;


    if (
      slotDistCache.has(key)
    ) {

      return (
        slotDistCache.get(key)
      );

    }


    const out =
      slots.slice();


    const map =
      new Map();


    function add(prob) {

      const k =
        slotsSig(out);


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


      const q =
        targets[j].q;


      /**
       * 达标
       */
      if (
        q > 0
      ) {

        out[pos] =
          codeTarget(
            j,
            true
          );


        rec(
          pos + 1,
          prob * q
        );

      }


      /**
       * 不达标
       */
      if (
        q < 1
      ) {

        out[pos] =
          codeTarget(
            j,
            false
          );


        rec(
          pos + 1,
          prob * (1 - q)
        );

      }


      /**
       * 恢复，
       * 供递归其他分支使用。
       */
      out[pos] = c;

    }


    rec(
      0,
      1
    );


    const dist = [];


    for (
      const [k, p] of map
    ) {

      dist.push({

        slots:
          k
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
              .join(';')
          )

        : (
            `sz|${protect}|` +
            `${slotsSig(st.slots)}`
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
            protect
          )

        : getSzSlotDist(
            st.slots,
            protect
          );


    const agg =
      new Map();


    for (
      const o of base
    ) {

      const id =
        idByKey.get(
          stateKey(
            o.slots,
            nextLock
          )
        );


      if (
        id === undefined
      ) {

        throw new Error(
          '内部错误：转移到了未枚举状态'
        );

      }


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
           * 累加未来价值。
           */
          for (
            const tr of
            a.trans
          ) {

            /**
             * 自环单独处理。
             */
            if (
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


        for (
          const tr of
          a.trans
        ) {

          if (
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