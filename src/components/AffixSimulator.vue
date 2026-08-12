<template>
  <div class="simulator">
    <div class="panel sim-controls">
      <el-radio-group v-model="mode" :disabled="started">
        <el-radio-button value="single">单装备</el-radio-button>
        <el-radio-button value="character">角色</el-radio-button>
      </el-radio-group>
      <el-button color="#1fa2ff" :loading="expectLoading" @click="startSimulation">开始随机模拟</el-button>
      <el-button plain @click="startSimulation" :disabled="!started">重新开始</el-button>
      <el-button plain type="danger" @click="exitGame" :disabled="!started">退出关卡</el-button>
      <el-button plain :disabled="!started" @click="showExpectation = true">查看期望</el-button>
    </div>

    <template v-if="started">
      <div class="panel">
        <h3 class="panel-title">目标词条（{{ mode === 'single' ? '单装备' : '四件装备合计' }}）</h3>
        <div class="target-chips">
          <span v-for="t in targets" :key="t.effect" class="target-chip">
            {{ EFFECT_NAMES[t.effect] }} ≥ 阶数{{ t.tier }}
          </span>
        </div>
        <div class="sim-stats">
          <span class="stat">已消耗：<b class="stat-num">{{ stonesUsed }}</b> 石头</span>
          <span class="stat">已消耗：<b class="stat-num">{{ keysUsed }}</b> 秘钥</span>
          <el-tag v-if="won" type="success" effect="dark">已通关</el-tag>
        </div>
      </div>

      <div class="gear-grid" :class="{ single: mode === 'single' }">
        <div class="gear-card" v-for="(gear, gi) in gears" :key="gi">
          <h4 class="gear-title">{{ mode === 'single' ? '装备' : '装备' + gearNames[gi] }}</h4>
          <div class="slot-row" v-for="(slot, si) in gear.slots" :key="si">
            <span class="slot-label">栏位{{ si + 1 }}</span>
            <span class="slot-affix" :class="[{ empty: slot.effect === 'wd' }, tierClass(slot.tier)]">
              {{ slotText(slot) }}
            </span>
            <span v-if="gear.locks[si]" class="lock-tag" :class="gear.locks[si]">
              {{ gear.locks[si] === 'stone' ? '石头锁' : '秘钥锁' }}
            </span>
            <div class="slot-actions">
              <el-button size="small" :disabled="!canLock(gear, si, 'stone')" @click="lockSlot(gi, si, 'stone')">
                石头锁 {{ LOCK_STONE[lockCount(gear)] }}石
              </el-button>
              <el-button size="small" :disabled="!canLock(gear, si, 'key')" @click="lockSlot(gi, si, 'key')">
                秘钥锁 {{ LOCK_KEY[lockCount(gear)] }}钥
              </el-button>
              <el-button size="small" :disabled="gear.locks[si] !== 'stone'" @click="unlockSlot(gi, si)">解锁</el-button>
            </div>
          </div>
          <div class="wash-area">
            <el-button color="#1fa2ff" :disabled="won" @click="startWash(gi, 'xg')">
              变更效果（{{ WASH_STONE[lockCount(gear)] }} 石头）
            </el-button>
            <el-button plain :disabled="won || !canWashSz(gear)" @click="startWash(gi, 'sz')">
              变更数值（{{ WASH_STONE[lockCount(gear)] }} 石头）
            </el-button>
            <span class="wash-hint">变更效果：重新随机未锁定栏位的词条效果与阶数；变更数值：仅重新随机阶数</span>
          </div>
        </div>
      </div>

      <div class="panel goal-note">
        <p>提示：石头锁为永久锁，可随时免费解锁；秘钥锁为一次性锁，本次洗练后自动解除（即使选择保留之前的词条）。目标达成即通关。</p>
      </div>
    </template>

    <el-empty v-else description="选择模式后点击「开始随机模拟」" />

    <!-- 洗练结果弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="洗练结果"
      width="560px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      align-center
    >
      <template v-if="pendingWash">
        <p class="dialog-note">
          本次{{ pendingWash.type === 'xg' ? '变更效果' : '变更数值' }}消耗 <b>{{ pendingWash.cost }}</b> 石头
          <template v-if="pendingWash.keyLocks.length">
            ；装备上的秘钥锁（第{{ pendingWash.keyLocks.map(i => i + 1).join('、') }}栏）已在本轮洗练后解除
          </template>
        </p>
        <div class="wash-blocks">
          <div class="wash-block old-block">
            <div class="wash-block-title">目前效果</div>
            <div class="wash-block-list">
              <div
                v-for="(row, i) in pendingWash.rows"
                :key="'o' + i"
                class="wash-block-item"
              >
                <span :class="tierClass(row.old.tier)">{{ slotText(row.old) }}</span>
              </div>
            </div>
          </div>
          <div class="wash-swap">↑↓</div>
          <div class="wash-block new-block">
            <div class="wash-block-title">变更效果</div>
            <div class="wash-block-list">
              <div
                v-for="(row, i) in pendingWash.rows"
                :key="'n' + i"
                class="wash-block-item"
              >
                <span :class="tierClass(row.new.tier)">{{ slotText(row.new) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="wash-footer">
          <el-button class="btn-keep" @click="resolveWash(false)">效果保留</el-button>
          <el-button class="btn-apply" @click="resolveWash(true)">效果变更</el-button>
          <p class="dialog-note wash-note">选择「效果保留」会放弃本次结果；秘钥锁同样不会恢复。</p>
        </div>
      </template>
    </el-dialog>

    <!-- 期望 / 通关结果 -->
    <div v-if="started && (showExpectation || won)" class="panel result-panel">
      <h3 class="panel-title">{{ won ? '通关！实际消耗与初始期望对比' : '初始期望' }}</h3>
      <div v-if="expectation" class="expect-box">
        <div class="expect-row">初始期望（全石头）：<b>{{ fmtNum(allStone) }}</b> 石头</div>
        <div class="expect-row">初始期望（允许秘钥）：<b>{{ fmtNum(keyStone) }}</b> 石头 + <b>{{ fmtNum(keys) }}</b> 秘钥</div>
        <template v-if="won">
          <div class="expect-divider"></div>
          <div class="expect-row">实际消耗：<b>{{ stonesUsed }}</b> 石头 + <b>{{ keysUsed }}</b> 秘钥</div>
          <div class="expect-row">
            与全石头期望的石头差：<b :class="diffClass(stonesUsed - allStone)">{{ fmtNum(stonesUsed - allStone) }}</b>
          </div>
          <div class="expect-row">
            与秘钥策略的石头差：<b :class="diffClass(stonesUsed - keyStone)">{{ fmtNum(stonesUsed - keyStone) }}</b>；
            秘钥差：<b :class="diffClass(keysUsed - keys)">{{ fmtNum(keysUsed - keys) }}</b>
          </div>
        </template>
      </div>
      <div v-else-if="expectError" class="expect-error">期望计算失败：{{ expectError }}</div>
      <div v-else class="expect-loading">{{ expectProgress || '期望计算中，请稍候…' }}</div>
      <div v-if="won" class="again-area">
        <el-button color="#1fa2ff" @click="startSimulation">再来一局</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

/* ==================== 游戏常量 ==================== */

const EFFECT_NAMES = {
  uy: '优越代码伤害',
  gj: '攻击力',
  bs: '暴击伤害',
  fy: '防御力',
  xl: '蓄力伤害',
  xs: '蓄力速度',
  bj: '暴击率',
  mz: '命中率',
  dr: '最大装弹数',
}

// 各效果 1~15 阶对应数值（百分比）
const TIER_VALUES = {
  uy: ['9.54%','10.94%','12.34%','13.75%','15.15%','16.55%','17.95%','19.35%','20.75%','22.15%','23.56%','24.96%','26.36%','27.76%','29.16%'],
  gj: ['4.77%','5.47%','6.18%','6.88%','7.59%','8.29%','9.00%','9.70%','10.40%','11.11%','11.81%','12.52%','13.22%','13.93%','14.63%'],
  bs: ['6.64%','7.62%','8.60%','9.58%','10.56%','11.54%','12.52%','13.50%','14.48%','15.46%','16.44%','17.42%','18.40%','19.38%','20.36%'],
  fy: ['4.77%','5.47%','6.18%','6.88%','7.59%','8.29%','9.00%','9.70%','10.40%','11.11%','11.81%','12.52%','13.22%','13.93%','14.63%'],
  xl: ['4.77%','5.47%','6.18%','6.88%','7.59%','8.29%','9.00%','9.70%','10.40%','11.11%','11.81%','12.52%','13.22%','13.93%','14.63%'],
  xs: ['1.98%','2.28%','2.57%','2.86%','3.16%','3.45%','3.75%','4.04%','4.33%','4.63%','4.92%','5.21%','5.51%','5.80%','6.09%'],
  bj: ['2.30%','2.64%','2.98%','3.32%','3.66%','4.00%','4.35%','4.69%','5.03%','5.37%','5.71%','6.05%','6.39%','6.73%','7.07%'],
  mz: ['4.77%','5.47%','6.18%','6.88%','7.59%','8.29%','9.00%','9.70%','10.40%','11.11%','11.81%','12.52%','13.22%','13.93%','14.63%'],
  dr: ['27.84%','31.95%','36.06%','40.17%','44.28%','48.39%','52.50%','56.60%','60.71%','64.82%','68.93%','73.04%','77.15%','81.26%','85.37%'],
}

// 洗练效果抽取权重（10%组与12%组，与算法一致）
const EFFECT_WEIGHTS = [
  { code: 'uy', w: 0.10 },
  { code: 'gj', w: 0.10 },
  { code: 'bs', w: 0.10 },
  { code: 'fy', w: 0.10 },
  { code: 'xl', w: 0.12 },
  { code: 'xs', w: 0.12 },
  { code: 'bj', w: 0.12 },
  { code: 'mz', w: 0.12 },
  { code: 'dr', w: 0.12 },
]

// 目标词条随机概率：优越40%、攻击30%、装弹10%，其余20%其他词条平分
const TARGET_POOL = [
  { code: 'uy', w: 0.40 },
  { code: 'gj', w: 0.30 },
  { code: 'dr', w: 0.10 },
  { code: 'bs', w: 0.20 / 6 },
  { code: 'fy', w: 0.20 / 6 },
  { code: 'xl', w: 0.20 / 6 },
  { code: 'xs', w: 0.20 / 6 },
  { code: 'bj', w: 0.20 / 6 },
  { code: 'mz', w: 0.20 / 6 },
]

const TIER_P = [0, 0.12, 0.12, 0.12, 0.12, 0.12, 0.07, 0.07, 0.07, 0.07, 0.07, 0.01, 0.01, 0.01, 0.01, 0.01]
const SLOT_GET = [1.0, 0.5, 0.3]
const WASH_STONE = [1, 2, 3]
const LOCK_STONE = [2, 3]
const LOCK_KEY = [20, 30]
const gearNames = ['一', '二', '三', '四']

/* ==================== 状态 ==================== */

const mode = ref('single')
const started = ref(false)
const gears = ref([])
const targets = ref([])
const stonesUsed = ref(0)
const keysUsed = ref(0)
const won = ref(false)
const showExpectation = ref(false)
const expectation = ref(null)
const expectError = ref('')
const expectLoading = ref(false)
const expectProgress = ref('')
const dialogVisible = ref(false)
const pendingWash = ref(null)

let worker = null
let reqId = 0
let latestReqId = 0
const pendingReqs = new Map()

/* ==================== 随机生成 ==================== */

function randomTier() {
  const r = Math.random()
  let acc = 0
  for (let t = 1; t <= 15; t++) {
    acc += TIER_P[t]
    if (r < acc) return t
  }
  return 15
}

function randomEffect(exclude = []) {
  const pool = EFFECT_WEIGHTS.filter(e => !exclude.includes(e.code))
  const total = pool.reduce((s, e) => s + e.w, 0)
  let r = Math.random() * total
  for (const e of pool) {
    r -= e.w
    if (r <= 0) return e.code
  }
  return pool[pool.length - 1].code
}

function sampleTargetEffects(count) {
  const pool = TARGET_POOL.slice()
  const out = []
  for (let i = 0; i < count; i++) {
    const total = pool.reduce((s, p) => s + p.w, 0)
    let r = Math.random() * total
    let idx = 0
    for (let k = 0; k < pool.length; k++) {
      r -= pool[k].w
      if (r <= 0) {
        idx = k
        break
      }
    }
    out.push(pool[idx].code)
    pool.splice(idx, 1)
  }
  return out
}

function generateGear() {
  const slots = []
  const used = []
  for (let i = 0; i < 3; i++) {
    // 一号栏必定有词条，其余栏位50%概率
    if (i === 0 || Math.random() < 0.5) {
      const effect = randomEffect(used)
      slots.push({ effect, tier: randomTier() })
      used.push(effect)
    } else {
      slots.push({ effect: 'wd', tier: 0 })
    }
  }
  return { slots, locks: {} }
}

function generateTargets(maxCount, maxTier) {
  const count = 1 + Math.floor(Math.random() * maxCount)
  const effects = sampleTargetEffects(count)

  if (maxTier === 15) {
    return effects.map(e => ({ effect: e, tier: 5 + Math.floor(Math.random() * 11) }))
  }

  // 角色模式：1..60，且满足 单词条≤60、总和≤180、Σ⌈阶数/15⌉≤12
  for (let attempt = 0; attempt < 50; attempt++) {
    const tiers = effects.map(() => 5 + Math.floor(Math.random() * 56))
    const sum = tiers.reduce((a, b) => a + b, 0)
    const slots = tiers.reduce((a, b) => a + Math.ceil(b / 15), 0)
    if (sum <= 180 && slots <= 12) {
      return effects.map((e, i) => ({ effect: e, tier: tiers[i] }))
    }
  }
  // 兜底：5..30 必定合法
  return effects.map(e => ({ effect: e, tier: 5 + Math.floor(Math.random() * 26) }))
}

/* ==================== 目标判定 ==================== */

function goalMetFor(gearList, targetList) {
  if (mode.value === 'single') {
    const slots = gearList[0].slots
    return targetList.every(t => slots.some(s => s.effect === t.effect && s.tier >= t.tier))
  }
  return targetList.every(t => {
    let sum = 0
    for (const gear of gearList) {
      for (const s of gear.slots) {
        if (s.effect === t.effect) sum += s.tier
      }
    }
    return sum >= t.tier
  })
}

function checkWin() {
  if (goalMetFor(gears.value, targets.value)) {
    won.value = true
    showExpectation.value = true
  }
}

/* ==================== 玩家操作 ==================== */

function lockCount(gear) {
  return Object.keys(gear.locks).length
}

function canLock(gear, si, type) {
  if (won.value) return false
  if (gear.slots[si].effect === 'wd') return false
  if (gear.locks[si]) return false
  return lockCount(gear) < 2
}

function canWashSz(gear) {
  return gear.slots.some((s, si) => !gear.locks[si] && s.effect !== 'wd')
}

function lockSlot(gi, si, type) {
  const gear = gears.value[gi]
  if (!canLock(gear, si, type)) return
  if (type === 'stone') {
    stonesUsed.value += LOCK_STONE[lockCount(gear)]
    gear.locks[si] = 'stone'
  } else {
    keysUsed.value += LOCK_KEY[lockCount(gear)]
    gear.locks[si] = 'key'
  }
}

function unlockSlot(gi, si) {
  const gear = gears.value[gi]
  if (gear.locks[si] === 'stone') {
    delete gear.locks[si]
  }
}

let washAudio = null

function playWashSound() {
  try {
    if (!washAudio) {
      washAudio = new Audio('/effect.mp3')
      washAudio.preload = 'auto'
    }
    washAudio.currentTime = 0
    washAudio.play().catch(() => {})
  } catch (e) {
    // 音频不可用时静默忽略
  }
}

function startWash(gi, type) {
  playWashSound()
  const gear = gears.value[gi]
  const cost = WASH_STONE[lockCount(gear)]
  stonesUsed.value += cost

  const oldSlots = gear.slots.map(s => ({ ...s }))
  const newSlots = oldSlots.map(s => ({ ...s }))
  if (type === 'sz') {
    // 变更数值：只重新随机已有词条的阶数，词条效果不变
    for (let si = 0; si < 3; si++) {
      if (gear.locks[si]) continue
      if (newSlots[si].effect !== 'wd') newSlots[si].tier = randomTier()
    }
  } else {
    // 变更效果：重新随机效果与阶数（按栏位获得概率，效果不重复）
    const keptEffects = []
    for (let si = 0; si < 3; si++) {
      if (gear.locks[si]) keptEffects.push(gear.slots[si].effect)
    }
    for (let si = 0; si < 3; si++) {
      if (gear.locks[si]) continue
      if (Math.random() < SLOT_GET[si]) {
        const effect = randomEffect(keptEffects)
        newSlots[si] = { effect, tier: randomTier() }
        keptEffects.push(effect)
      } else {
        newSlots[si] = { effect: 'wd', tier: 0 }
      }
    }
  }

  const rows = oldSlots.map((old, si) => ({
    slot: si,
    old,
    new: newSlots[si],
    changed: old.effect !== newSlots[si].effect || old.tier !== newSlots[si].tier,
  }))

  pendingWash.value = {
    gearIndex: gi,
    type,
    rows,
    cost,
    keyLocks: Object.keys(gear.locks).filter(si => gear.locks[si] === 'key').map(Number),
  }
  dialogVisible.value = true
}

function resolveWash(apply) {
  const w = pendingWash.value
  if (!w) return
  const gear = gears.value[w.gearIndex]
  if (apply) {
    gear.slots = w.rows.map(r => ({ ...r.new }))
  }
  // 秘钥锁为一次性：无论保留还是变更，本轮洗练后都解除
  for (const si of w.keyLocks) {
    delete gear.locks[si]
  }
  dialogVisible.value = false
  pendingWash.value = null
  checkWin()
}

/* ==================== 初始期望计算 ==================== */

function slotText(slot) {
  if (slot.effect === 'wd') return '未获取效果'
  return EFFECT_NAMES[slot.effect] + TIER_VALUES[slot.effect][slot.tier - 1] + '（阶数' + slot.tier + '）'
}

function tierClass(tier) {
  if (tier >= 15) return 'tier-15'
  if (tier >= 13) return 'tier-13'
  return ''
}

function buildCurrent() {
  const gearStr = g =>
    g.slots.map(s => '0' + s.effect + (s.effect === 'wd' ? 0 : s.tier)).join(',')
  return gears.value.map(gearStr).join('/')
}

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/affix.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = e => {
    const msg = e.data
    // 进度消息不是最终结果，忽略（角色版会先发多条进度）
    if (msg && msg.progress) {
      if (pendingReqs.has(msg.id)) expectProgress.value = formatProgress(msg.progress)
      return
    }
    const p = pendingReqs.get(msg.id)
    if (!p) return
    pendingReqs.delete(msg.id)
    if (msg.ok) p.resolve(msg.result)
    else p.reject(new Error(msg.error))
  }
  worker.onerror = e => {
    for (const p of pendingReqs.values()) p.reject(new Error('计算进程异常：' + (e.message || '未知错误')))
    pendingReqs.clear()
    worker.terminate()
    worker = null
  }
  return worker
}

function formatProgress(info) {
  if (info.phase === 'gear') return `正在求解装备${info.gear}/${info.total}…`
  return JSON.stringify(info)
}

function computeExpectation(current, targetStr) {
  const id = ++reqId
  latestReqId = id
  const promise = new Promise((resolve, reject) => {
    pendingReqs.set(id, { resolve, reject })
    ensureWorker().postMessage({
      id,
      type: mode.value,
      current,
      target: targetStr,
      options: undefined,
    })
  })
  return { id, promise }
}

async function startSimulation() {
  started.value = true
  won.value = false
  showExpectation.value = false
  expectation.value = null
  expectError.value = ''
  expectProgress.value = ''
  stonesUsed.value = 0
  keysUsed.value = 0
  pendingWash.value = null
  dialogVisible.value = false

  const gearCount = mode.value === 'single' ? 1 : 4
  gears.value = Array.from({ length: gearCount }, () => generateGear())
  targets.value = mode.value === 'single'
    ? generateTargets(3, 15)
    : generateTargets(5, 60)

  // 避免一开始就达标（重试几次）
  for (let i = 0; i < 20 && goalMetFor(gears.value, targets.value); i++) {
    gears.value = Array.from({ length: gearCount }, () => generateGear())
    targets.value = mode.value === 'single'
      ? generateTargets(3, 15)
      : generateTargets(5, 60)
  }

  const current = buildCurrent()
  const targetStr = targets.value.map(t => t.effect + t.tier).join(',')
  expectLoading.value = true
  const { id, promise } = computeExpectation(current, targetStr)
  try {
    const res = await promise
    // 只接受当前这局的结果，避免退出后旧请求迟到覆盖新期望
    if (id === latestReqId) expectation.value = res
  } catch (e) {
    if (id === latestReqId) {
      expectError.value = e && e.message ? e.message : String(e)
    }
  } finally {
    if (id === latestReqId) expectLoading.value = false
  }

  checkWin()
}

function exitGame() {
  started.value = false
  won.value = false
  showExpectation.value = false
  expectation.value = null
  expectError.value = ''
  expectProgress.value = ''
  stonesUsed.value = 0
  keysUsed.value = 0
  gears.value = []
  targets.value = []
  pendingWash.value = null
  dialogVisible.value = false
}

/* ==================== 展示 ==================== */

const expectParts = computed(() => {
  const s = String(expectation.value?.cost || '')
  const m = s.match(/^([\d.]+)\/([\d.]+)-([\d.]+)$/)
  if (!m) return null
  return { allStone: parseFloat(m[1]), keyStone: parseFloat(m[2]), keys: parseFloat(m[3]) }
})

const allStone = computed(() => expectParts.value?.allStone ?? NaN)
const keyStone = computed(() => expectParts.value?.keyStone ?? NaN)
const keys = computed(() => expectParts.value?.keys ?? NaN)

function fmtNum(x) {
  if (!Number.isFinite(x)) return '-'
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x))
  return x.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function diffClass(x) {
  if (!Number.isFinite(x)) return ''
  return x <= 0 ? 'diff-good' : 'diff-bad'
}

onUnmounted(() => {
  if (worker) {
    worker.terminate()
    worker = null
  }
})
</script>

<style scoped>
.simulator {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sim-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.panel {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 10px;
  padding: 16px 18px;
}

.panel-title {
  margin: 0 0 10px;
  font-size: 17px;
  color: #1fa2ff;
}

.target-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.target-chip {
  background: #eef6ff;
  border: 1px solid #cfe4fb;
  color: #1f6fc4;
  border-radius: 16px;
  padding: 4px 14px;
  font-weight: bold;
}

.sim-stats {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.stat {
  color: #555;
}

.stat-num {
  color: #1fa2ff;
  font-size: 17px;
}

.gear-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.gear-grid.single {
  grid-template-columns: 1fr;
}

.gear-card {
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 10px;
  padding: 14px;
}

.gear-title {
  margin: 0 0 12px;
  font-size: 16px;
  color: #3553ff;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-bottom: 1px dashed #e3ecf7;
}

.slot-label {
  min-width: 46px;
  font-weight: bold;
  color: #666;
  font-size: 13px;
}

.slot-affix {
  min-width: 150px;
  color: #222;
  font-weight: 600;
}

.slot-affix.empty {
  color: #aaa;
  font-weight: normal;
}

.slot-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}

.lock-tag {
  font-size: 12px;
  border-radius: 4px;
  padding: 1px 8px;
  color: #fff;
}

.lock-tag.stone {
  background: #909399;
}

.lock-tag.key {
  background: #e6a23c;
}

.wash-area {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.wash-hint {
  color: #999;
  font-size: 12px;
}

.goal-note p {
  margin: 0;
  color: #777;
  font-size: 13px;
  line-height: 1.7;
}

.dialog-note {
  margin: 0 0 10px;
  color: #777;
  font-size: 13px;
}

.wash-blocks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wash-block {
  border-radius: 12px;
  border: 1px solid;
  padding: 12px 18px;
}

.old-block {
  border-color: rgba(230, 162, 60, 0.7);
  box-shadow:
    0 0 16px rgba(230, 162, 60, 0.45),
    inset 0 0 12px rgba(230, 162, 60, 0.08);
}

.new-block {
  border-color: rgba(31, 162, 255, 0.7);
  box-shadow:
    0 0 16px rgba(31, 162, 255, 0.45),
    inset 0 0 12px rgba(31, 162, 255, 0.08);
}

.wash-block-title {
  text-align: center;
  font-weight: bold;
  font-size: 15px;
  margin-bottom: 8px;
}

.old-block .wash-block-title {
  color: #e6a23c;
}

.new-block .wash-block-title {
  color: #1fa2ff;
}

.wash-block-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wash-block-item {
  text-align: center;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.75);
  color: #222;
  font-weight: 600;
}

.wash-swap {
  text-align: center;
  color: #909399;
  font-size: 20px;
  line-height: 1;
  padding: 2px 0;
}

.wash-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.wash-note {
  width: 100%;
  text-align: center;
  margin: 10px 0 0 !important;
}

.btn-keep {
  background: #e6a23c;
  border-color: #e6a23c;
  color: #fff;
}

.btn-keep:hover,
.btn-keep:focus {
  background: #ebb563;
  border-color: #ebb563;
  color: #fff;
}

.btn-apply {
  background: #1fa2ff;
  border-color: #1fa2ff;
  color: #fff;
}

.btn-apply:hover,
.btn-apply:focus {
  background: #54b8ff;
  border-color: #54b8ff;
  color: #fff;
}

/* 阶数样式：13/14 阶蓝色，15 阶黑底蓝字 */
.tier-13 {
  color: #1fa2ff;
  font-weight: 700;
}

.tier-15 {
  background: #000;
  color: #1fa2ff;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 4px;
}

.result-panel {
  border: 1px solid #e3ecf7;
}

.expect-box {
  line-height: 2;
}

.expect-row {
  color: #444;
}

.expect-row b {
  color: #1fa2ff;
}

.expect-divider {
  border-top: 1px dashed #e3ecf7;
  margin: 6px 0;
}

.diff-good {
  color: #67c23a !important;
}

.diff-bad {
  color: #f56c6c !important;
}

.expect-error {
  color: #f56c6c;
}

.expect-loading {
  color: #909399;
}

.again-area {
  margin-top: 12px;
}

@media (max-width: 768px) {
  .gear-grid {
    grid-template-columns: 1fr;
  }

  .slot-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
