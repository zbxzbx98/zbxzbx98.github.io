<template>
  <div class="vanta-bg" ref="vantaRef"></div>
  <div class="content-wrapper">
      <h1>国服前哨基地资源产出计算器</h1>

      <div style="text-align: center; margin-bottom: 20px;">
        <el-button color="#1fa2ff" plain @click="$router.push('Home')">返回主页</el-button>
        <a href="https://www.bilibili.com/toy/NikkeCalc/index.html" style="margin-left: 10px; margin-right: 10px;"><el-button color="#1fa2ff" plain>查看B站版</el-button></a>
        <el-button color="#1fa2ff" plain @click="$router.push('AffixCalc')">装备洗练计算器</el-button>
      </div>

      <div class="container">
        <h2 class="tit">防御前哨基地产出</h2>
        <div class="input-section">
          <div class="select-container">
            <div class="select-group">
              <label class="select-label">国服等级修正<el-tooltip
                  effect="dark"
                  content="注：国服等级修正默认为3关，具体数值请调整当前关卡后，修改该值，使下面显示的等级进度与游戏中一致，即可继续使用其他功能。"
                  placement="top"
                >
                  <el-icon style="margin-left: 5px; cursor: pointer;"><QuestionFilledIcon /></el-icon>
                </el-tooltip></label>
              <div class="cascader-wrapper">
                <el-select
                  v-model="selectedCnLevelCorrection"
                  placeholder="请选择等级修正"
                  style="width: 200px;"
                  @change="handleCnLevelCorrectionChange"
                >
                  <el-option
                    v-for="item in cnLevelCorrectionOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value">
                  </el-option>
                </el-select>
              </div>
            </div>

            <div class="select-group">
              <label class="select-label" data-i18n="easyMode">普通模式</label>
              <div class="cascader-wrapper">
                <el-cascader
                  v-model="selectedEasyMode"
                  :options="easyModeOptions"
                  :props="cascaderProps"
                  placeholder="请选择普通模式关卡"
                  style="width: 200px;"
                  @change="handleEasyModeChange"
                  clearable
                ></el-cascader>
              </div>
            </div>

            <div class="select-group">
              <label class="select-label" data-i18n="hardMode">困难模式</label>
              <div class="cascader-wrapper">
                <el-cascader
                  v-model="selectedHardMode"
                  :options="hardModeOptions"
                  :props="cascaderProps"
                  placeholder="请选择困难模式关卡"
                  style="width: 200px;"
                  @change="handleHardModeChange"
                  clearable
                ></el-cascader>
              </div>
            </div>
          </div>

          <div class="level-display">
            <div class="level-info">
              <span data-i18n="baseDefenseLevel">基地防御等级：</span>
              <span id="levelDisplay">{{ baseDefenseLevel }}</span>
            </div>
            <div class="progress-container">
              <span class="progress-text" id="progressText">{{ progressCurrent }}/5</span>
              <div class="progress-bar" id="progressBar">
                <div v-for="n in 5" :key="n" class="progress-segment" :class="{ active: n <= progressCurrent }">
                </div>
              </div>
            </div>
          </div>

          <!-- 下一关战压 -->
          <div class="pressure-panel">
            <div class="pressure-panel-head">
              <span class="pressure-panel-title">下一关战压</span>
              <el-button size="small" color="#1fa2ff" plain @click="openPressureDialog">战压计算</el-button>
            </div>
            <div class="pressure-panel-body">
              <div class="pressure-panel-field">
                <span class="pressure-panel-label">当前战力：</span>
                <el-input-number v-model="currentPower" :min="0" :step="1000" :precision="0" controls-position="right" style="width: 180px;" />
              </div>
              <template v-if="stagesPowerFlat.length">
                <template v-if="currentHardStage">
                  <template v-if="nextStageInfo">
                    <div class="pressure-panel-field">
                      <span class="pressure-panel-label">下一关：</span>
                      <span class="pressure-next-name">{{ nextStageInfo.name }}</span>
                      <span class="pressure-next-power">{{ fmtPower(nextStageInfo.power) }}</span>
                    </div>
                    <div class="pressure-panel-field">
                      <span class="pressure-panel-label">当前战压：</span>
                      <span class="pressure-inline">
                        <template v-if="nextStagePressure && nextStagePressure.factor === 1">无战压</template>
                        <template v-else-if="nextStagePressure">战压 {{ fmtPercent(nextStagePressure.ratio) }}，属性保留 {{ fmtPercent(nextStagePressure.factor) }}</template>
                        <template v-else>-</template>
                      </span>
                    </div>
                  </template>
                  <div v-else class="pressure-panel-field">
                    <span class="pressure-panel-label">下一关：</span>
                    <span class="pressure-empty">已是最后一关，无下一关数据</span>
                  </div>
                </template>
                <div v-else class="pressure-panel-field">
                  <span class="pressure-panel-label">下一关：</span>
                  <span class="pressure-empty">当前选择的困难关卡未找到战力数据</span>
                </div>
              </template>
              <div v-else class="pressure-panel-field">
                <span class="pressure-panel-label">下一关：</span>
                <span class="pressure-empty">战力数据加载中…</span>
              </div>
            </div>
          </div>
        </div>
        <div class="output-section">
          <h3 data-i18n="baseHourlyOutput">基础每1小时产出</h3>
          <div class="resource-grid">
            <div class="resource-item">
              <div class="resource-name" data-i18n="credit">信用点</div>
              <div class="resource-value" id="creditValue">{{ resourceOutput.credit }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-name" data-i18n="battleData">战斗数据辑</div>
              <div class="resource-value" id="battleValue">{{ resourceOutput.battle_data_set }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-name" data-i18n="coreDust">芯尘</div>
              <div class="resource-value" id="chipValue">{{ resourceOutput.core_dust }}</div>
            </div>
          </div>

          <h3 data-i18n="baseMultiplierOutput">学院加成后每1小时产出</h3>
          <div class="resource-grid">
            <div class="resource-item">
              <div class="resource-name" data-i18n="credit">信用点</div>
              <div class="resource-value" id="creditMulValue">{{ resourceOutput.credit_mul }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-name" data-i18n="battleData">战斗数据辑</div>
              <div class="resource-value" id="battleMulValue">{{ resourceOutput.battle_data_set_mul }}</div>
            </div>
            <div class="resource-item">
              <div class="resource-name" data-i18n="coreDust">芯尘</div>
              <div class="resource-value" id="chipMulValue">{{ resourceOutput.core_dust_mul }}</div>
            </div>
          </div>
        </div>
        <h2 class="tit">芯尘表（战术学院满级）</h2>
        <div class="table-section">
          <div class="table-controls">
            <div class="control-group">
              <label class="select-label" data-i18n="easyModeTable">普通模式</label>
              <div class="cascader-wrapper">
                <el-cascader
                  v-model="selectedEasyModeTable"
                  :options="easyModeTableOptions"
                  :props="cascaderProps"
                  placeholder="请选择普通模式关卡"
                  style="width: 200px;"
                  @change="handleEasyModeTableChange"
                  clearable
                />
              </div>
            </div>
            <div class="control-group">
              <label for="displayMode" data-i18n="displayOrder">显示顺序:</label>
              <el-select v-model="displayMode" id="displayMode" style="width: 120px;" @change="updateTableData">
                <el-option value="desc" label="升序"></el-option>
                <el-option value="asc" label="降序"></el-option>
              </el-select>
            </div>

            <div class="control-group">
              <label for="showHalfPoints" data-i18n="showHalfPoints">显示0.5:</label>
              <el-select v-model="showHalfPoints" id="showHalfPoints" style="width: 120px;" @change="updateTableData">
                <el-option value="true" label="是"></el-option>
                <el-option value="false" label="否"></el-option>
              </el-select>
            </div>
          </div>

          <div id="tableContainer" class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th data-i18n="hardChapter">困难章节</th>
                  <th data-i18n="level">等级</th>
                  <th data-i18n="coreDust">芯尘</th>
                </tr>
              </thead>
              <tbody id="tableBody">
                <tr v-for="(item, index) in tableData" :key="index">
                  <td class="level-cell">{{ item.hardChapter }}</td>
                  <td class="level-cell">{{ item.level }}</td>
                  <td class="core-dust-cell">{{ item.coreDust }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="footer-section">
          <div class="footer-content">
            <div class="instructions">
              <h3 data-i18n="instructions">注意事项</h3>
              <div class="instruction-grid">
                <div class="instruction-item">
                  <div class="instruction-text" data-i18n="instruction1">
                    选择战役关卡代表已通关该关卡，数值可能有 ±0.01 显示误差，且国服个人关卡进度可能有1-2关的误差，请使用国服等级修正功能进行同步
                  </div>
                </div>
                
              </div>
            </div>

            <div class="contact-info">
              <h3 data-i18n="contactInfo">制作信息</h3>
              <div class="contact-platforms">
                <div class="contact-item">
                  <div class="contact-platform">原网站</div>
                  <div class="contact-id"><a href="https://nikkeoutpost.netlify.app" target= "_blank">doro112</a></div>
                </div>
                <div class="contact-item">
                  <div class="contact-platform">搬运及战压计算功能</div>
                  <div class="contact-id">zbxzbx98</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== 战压计算弹窗 ==================== -->
      <el-dialog v-model="pressureDialogVisible" title="战压计算" width="min(420px, 92vw)">
        <div class="pressure-row">
          <span class="pressure-label">当前战力：</span>
          <el-input-number v-model="currentPower" :min="0" :step="1000" :precision="0" controls-position="right" style="width: 200px;" />
        </div>
        <div class="pressure-row">
          <span class="pressure-label">目标战力：</span>
          <el-input-number v-model="targetPower" :min="0" :step="1000" :precision="0" controls-position="right" style="width: 200px;" />
        </div>
        <div class="pressure-row">
          <span class="pressure-label">选择关卡：</span>
          <el-cascader
            v-model="selectedHardStageCascader"
            :options="hardStageCascaderOptions"
            :props="cascaderProps"
            placeholder="先选章节，再选关卡"
            style="width: 200px;"
            @change="handleStageCascaderChange"
            clearable
          />
        </div>
        <div v-if="pressureCalc" class="pressure-result">
          <div class="pressure-formula">
            <template v-if="pressureCalc.factor === 1">
              战压：<b>无战压</b>
            </template>
            <template v-else>
              战压 =（{{ fmtPower(pressureCalc.tgt) }} - {{ fmtPower(pressureCalc.cur) }}）/ {{ fmtPower(pressureCalc.tgt) }}
              = <b>{{ fmtPercent(pressureCalc.ratio) }}</b>
            </template>
          </div>
          <div class="pressure-factor">
            属性保留倍率（消减后）：<b class="pressure-big">{{ fmtPercent(pressureCalc.factor) }}</b>
          </div>
          <div v-if="pressureCalc.factor === 1" class="pressure-note">当前战力不低于目标战力，无属性压制。</div>
          <div v-else class="pressure-note">即属性被压制 {{ fmtPercent(1 - pressureCalc.factor) }}，仅保留 {{ fmtPercent(pressureCalc.factor) }}</div>
        </div>
        <div v-else class="pressure-hint">请输入目标战力（需大于 0），结果将自动计算并显示。</div>
        <template #footer>
          <el-button @click="pressureDialogVisible = false">关闭</el-button>
        </template>
      </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { ElCascader, ElSelect, ElOption, ElTooltip, ElIcon, ElNotification } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import * as THREE from "three";
import NET from "vanta/src/vanta.net";

// 数据引用
const selectedCnLevelCorrection = ref(3)
const selectedEasyMode = ref([])
const selectedHardMode = ref([])
const selectedEasyModeTable = ref([])
const displayMode = ref('asc')
const showHalfPoints = ref('true')
const baseDefenseLevel = ref(1)
const progressCurrent = ref(0)
const tableData = ref([])
const chaptersData = ref([])
const outpostData = ref({})
const resourceOutput = ref({
  credit: '-',
  battle_data_set: '-',
  core_dust: '-',
  credit_mul: '-',
  battle_data_set_mul: '-',
  core_dust_mul: '-'
})

const QuestionFilledIcon = QuestionFilled

/* ==================== 战压计算 ==================== */

const pressureDialogVisible = ref(false)
const currentPower = ref(0)
const targetPower = ref(0)
const selectedHardStageCascader = ref([])  // 弹窗中选择困难关卡（章节 -> 关卡）
const stagesPower = ref([])            // stages-power.json 原始数据

/**
 * 战力压制D类型：战力压比 -> 属性保留倍率
 * @param {number} x 战力压比（小数），如 -0.05 表示 -5%
 * @returns {number} 属性保留倍率（小数），如 0.51 表示属性变为 51%（即 -49%）
 */
function pressureFactorD(x) {
  if (x >= 0)      return 1;                              // 无压制
  if (x >= -0.0991) return 21 * x * x + 5.11 * x + 0.9505; // 二次段
  if (x >= -0.1571) return 1.379 * x + 0.7866;             // 斜率1.38
  if (x >= -0.4981) return x + 0.7271;                     // 斜率1
  return 0.1;                                              // 跳至 -90%
}

// 战压 =（目标战力 - 当前战力）/ 目标战力，再换算为属性保留倍率
function calcPressure(cur, tgt) {
  if (!tgt || tgt <= 0) return null
  const ratio = (tgt - cur) / tgt
  const factor = pressureFactorD(-ratio)
  return { cur, tgt, ratio, factor }
}

const pressureCalc = computed(() => calcPressure(Number(currentPower.value) || 0, Number(targetPower.value) || 0))

// stages-power 扁平化：按章节顺序排列的困难关卡列表
const stagesPowerFlat = computed(() => {
  const flat = []
  stagesPower.value.forEach((chapter, ci) => {
    chapter.forEach(stage => {
      flat.push({
        key: normalizeStageKey(stage.name),
        name: stage.name,
        power: stage.power,
        chapter: ci,
      })
    })
  })
  return flat
})

// 困难关卡级联选项（先选章节，再选关卡，与页面上普通/困难模式一致）
const hardStageCascaderOptions = computed(() =>
  stagesPower.value.map((chapter, ci) => ({
    id: 'ch' + ci,
    label: `第${ci}章`,
    children: chapter.map(stage => ({
      id: normalizeStageKey(stage.name),
      label: stage.name,
      power: stage.power,
    })),
  }))
)

// 由关卡 key 反查级联路径，如 'ch3' + '3-1'
function cascaderPathFor(key) {
  const s = stagesPowerFlat.value.find(x => x.key === key)
  return s ? ['ch' + s.chapter, key] : []
}

// "0-3 HARD BOSS" / "0-3 BOSS" -> "0-3"
function normalizeStageKey(section) {
  const m = String(section || '').match(/^(\d+)-(\d+)/)
  return m ? `${m[1]}-${m[2]}` : String(section || '').trim()
}

// 当前选择的困难关卡 Section（兼容数组/字符串两种形式）
function getSelectedHardSection() {
  let v = selectedHardMode.value
  if (Array.isArray(v)) v = v[v.length - 1] || ''
  const id = String(v)
  const ch = chaptersData.value.find(c => String(c.id) === id)
  return ch ? ch.section : ''
}

// 当前选择的困难关卡（在 stages-power 中的位置）
const currentHardStage = computed(() => {
  const flat = stagesPowerFlat.value
  if (!flat.length) return null
  const curKey = normalizeStageKey(getSelectedHardSection())
  const idx = flat.findIndex(s => s.key === curKey)
  return idx === -1 ? null : { ...flat[idx], idx }
})

// 下一关（当前困难关卡的下一关）
const nextStageInfo = computed(() => {
  const cur = currentHardStage.value
  if (!cur) return null
  const next = stagesPowerFlat.value[cur.idx + 1]
  return next ? { ...next, currentKey: cur.key } : null
})

// 当前战力 vs 下一关战力的战压结果
const nextStagePressure = computed(() => {
  const next = nextStageInfo.value
  if (!next) return null
  return calcPressure(Number(currentPower.value) || 0, next.power)
})

function openPressureDialog() {
  // 自动填入下一关战力为目标战力
  const next = nextStageInfo.value
  targetPower.value = next ? next.power : 0
  selectedHardStageCascader.value = next ? cascaderPathFor(next.key) : []
  pressureDialogVisible.value = true
}

// 级联选择困难关卡 -> 读取其战力为目标战力
function handleStageCascaderChange(value) {
  if (value && value.length === 2) {
    const group = hardStageCascaderOptions.value.find(g => g.id === value[0])
    const stage = group && group.children.find(c => c.id === value[1])
    if (stage) targetPower.value = stage.power
  }
}

function fmtPower(v) {
  return Number(v).toLocaleString('zh-CN')
}

function fmtPercent(v) {
  const s = (v * 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return s + '%'
}

// 国服等级修正选项
const cnLevelCorrectionOptions = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' }
]

// 级联选择器属性
const cascaderProps = {
  value: 'id',
  label: 'label',
  children: 'children',
  expandTrigger: 'hover'
}

// 分组数据
const easyModeGroups = computed(() => groupChaptersByType('easy'))
const hardModeGroups = computed(() => groupChaptersByType('hard'))
const easyModeTableGroups = computed(() => groupChaptersByType('easyTable'))

// 级联选项
const easyModeOptions = computed(() => generateCascaderOptions('easy'))
const hardModeOptions = computed(() => generateCascaderOptions('hard'))
const easyModeTableOptions = computed(() => generateCascaderOptions('easyTable'))

// Vanta背景效果
const vantaRef = ref()
let vantaEffect

// 生成级联选项
function generateCascaderOptions(mode) {
  const groups = mode === 'easy' ? easyModeGroups.value : 
                 mode === 'hard' ? hardModeGroups.value : 
                 easyModeTableGroups.value
  const options = []
  
  Object.keys(groups).forEach(groupName => {
    const group = {
      id: groupName,
      label: groupName,
      children: []
    }
    
    groups[groupName].forEach(item => {
      group.children.push({
        id: item.id,
        label: item.section
      })
    })
    
    // 只有当子项存在时才添加组
    if (group.children.length > 0) {
      options.push(group)
    }
  })
  
  return options
}

/* ==================== 关卡选择与当前战力存储（B站云存储 > 本地浏览器存储 > 默认值） ==================== */

const savedEasy = ref({ bn: '', id: '' })
const savedHard = ref({ bn: '', id: '' })

const LOCAL_KEYS = {
  ebn: 'nikke_ebn',
  ebid: 'nikke_ebid',
  hbn: 'nikke_hbn',
  hbid: 'nikke_hbid',
  cnlv: 'nikke_cnlv',
  pw: 'nikke_pw',
}

// 读取存储：优先 B站云存储，其次本地浏览器存储
async function readSavedState() {
  const out = {}
  if (typeof window !== 'undefined' && window.toy) {
    try {
      const ok = await window.toy.isSupport('getCloudStorage')
      if (ok) {
        const all = await window.toy.getCloudStorage()
        for (const k of Object.keys(LOCAL_KEYS)) {
          if (all[k] != null) out[k] = all[k]
        }
      }
    } catch (e) { /* 忽略 */ }
  }
  try {
    for (const [k, lk] of Object.entries(LOCAL_KEYS)) {
      if (out[k] == null) {
        const v = localStorage.getItem(lk)
        if (v != null) out[k] = v
      }
    }
  } catch (e) { /* 忽略 */ }
  return out
}

// 写入存储：同时写 B站云存储（如可用）与本地浏览器存储
async function writeSavedState() {
  const state = {}
  if (savedEasy.value.id) { state.ebn = savedEasy.value.bn; state.ebid = savedEasy.value.id }
  if (savedHard.value.id) { state.hbn = savedHard.value.bn; state.hbid = savedHard.value.id }
  state.cnlv = String(selectedCnLevelCorrection.value)
  state.pw = String(currentPower.value || '')
  if (typeof window !== 'undefined' && window.toy) {
    try {
      const ok = await window.toy.isSupport('setCloudStorage')
      if (ok) await window.toy.setCloudStorage(state)
    } catch (e) { /* 忽略 */ }
  }
  try {
    for (const [k, lk] of Object.entries(LOCAL_KEYS)) {
      if (state[k] != null) localStorage.setItem(lk, String(state[k]))
    }
  } catch (e) { /* 忽略 */ }
}

// 当前战力变化时（防抖）保存
let powerSaveTimer = null
watch(currentPower, () => {
  clearTimeout(powerSaveTimer)
  powerSaveTimer = setTimeout(() => writeSavedState(), 500)
})

// 处理普通模式变更
function handleEasyModeChange(value) {
  if (value && value.length === 2) {
    // 级联选择器返回数组 [groupId, itemId]
    selectedEasyMode.value = value[1] // 我们只需要关卡ID
    savedEasy.value = { bn: value[0], id: value[1] }
    calculateBaseDefenseLevel()
    writeSavedState()
  } else {
    selectedEasyMode.value = []
  }
}

// 处理困难模式变更
function handleHardModeChange(value) {
  if (value && value.length === 2) {
    // 级联选择器返回数组 [groupId, itemId]
    selectedHardMode.value = value[1] // 我们只需要关卡ID
    savedHard.value = { bn: value[0], id: value[1] }
    calculateBaseDefenseLevel()
    writeSavedState()
  } else {
    selectedHardMode.value = []
  }
}

// 处理表格用普通模式变更
function handleEasyModeTableChange(value) {
  if (value && value.length === 2) {
    // 级联选择器返回数组 [groupId, itemId]
    selectedEasyModeTable.value = value[1] // 我们只需要关卡ID
    savedEasy.value = { bn: value[0], id: value[1] }
    updateTableData()
    writeSavedState()
  } else {
    selectedEasyModeTable.value = []
  }
}

// 处理国服等级修正变更
function handleCnLevelCorrectionChange() {
  calculateBaseDefenseLevel()
  updateTableData()
  writeSavedState()
}

// 分组章节数据
function groupChaptersByType(type) {
  const groups = {}
  const chapters = chaptersData.value

  if (type === 'easy') {
    // 简单模式数据 (2-12 开始)
    const startIndex = chapters.findIndex(chapter => chapter.section && chapter.section.startsWith('2-12'))
    if (startIndex !== -1) {
      const easyChapters = chapters.slice(startIndex)
      easyChapters.forEach(chapter => {
        const groupName = chapter.chapterName || '其他'
        if (!groups[groupName]) {
          groups[groupName] = []
        }
        groups[groupName].push(chapter)
      })
    }
  } else if (type === 'hard') {
    // 困难模式数据 (0-1 开始)
    const startIndex = chapters.findIndex(chapter => chapter.section && chapter.section.startsWith('0-1'))
    if (startIndex !== -1) {
      const hardChapters = chapters.slice(startIndex)
      hardChapters.forEach(chapter => {
        const groupName = chapter.chapterName || '其他'
        if (!groups[groupName]) {
          groups[groupName] = []
        }
        groups[groupName].push(chapter)
      })
    }
  } else if (type === 'easyTable') {
    // 表格用简单模式数据 (2-12 开始)
    const startIndex = chapters.findIndex(chapter => chapter.section && chapter.section.startsWith('2-12'))
    if (startIndex !== -1) {
      const easyChapters = chapters.slice(startIndex)
      easyChapters.forEach(chapter => {
        const groupName = chapter.chapterName || '其他'
        if (!groups[groupName]) {
          groups[groupName] = []
        }
        groups[groupName].push(chapter)
      })
    }
  }

  return groups
}

// 计算基地防御等级
function calculateBaseDefenseLevel() {
  // 确保获取正确的值，无论是字符串还是数组形式
  let easyModeValue = selectedEasyMode.value;
  let hardModeValue = selectedHardMode.value;
  
  // 如果是数组（来自级联选择器），取最后一个元素
  if (Array.isArray(easyModeValue)) {
    easyModeValue = easyModeValue[easyModeValue.length - 1] || 0;
  }
  
  if (Array.isArray(hardModeValue)) {
    hardModeValue = hardModeValue[hardModeValue.length - 1] || 0;
  }
  
  const easyModeId = parseInt(easyModeValue) || 0
  const hardModeId = parseInt(hardModeValue) || 0

  // 找到基准ID
  const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('2-12'))
  const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))

  const easyBaseId = easyBaseEntry ? parseInt(easyBaseEntry.id) : 0
  const hardBaseId = hardBaseEntry ? parseInt(hardBaseEntry.id) : 0

  const easyDiff = Math.max(0, easyModeId - easyBaseId)
  const hardDiff = Math.max(0, hardModeId - hardBaseId + 1)

  const totalDiff = easyDiff + hardDiff + selectedCnLevelCorrection.value
  const level = Math.floor(totalDiff / 5) + 1
  const progress = totalDiff % 5

  baseDefenseLevel.value = level
  progressCurrent.value = progress

  // 更新资源产出
  updateResourceOutput(level)
}

// 更新资源产出
function updateResourceOutput(level) {
  const outpost = outpostData.value[level]
  if (outpost) {
    resourceOutput.value = { ...outpost }
  } else {
    resourceOutput.value = {
      credit: '-',
      battle_data_set: '-',
      core_dust: '-',
      credit_mul: '-',
      battle_data_set_mul: '-',
      core_dust_mul: '-'
    }
  }
}

// 更新表格数据
function updateTableData() {
  // 确保获取正确的值，无论是字符串还是数组形式
  let easyModeTableValue = selectedEasyModeTable.value;
  
  // 如果是数组（来自级联选择器），取最后一个元素
  if (Array.isArray(easyModeTableValue)) {
    easyModeTableValue = easyModeTableValue[easyModeTableValue.length - 1] || 0;
  }
  
  const easyModeTableId = parseInt(easyModeTableValue) || 0
  
  if (easyModeTableId === 0) {
    tableData.value = []
    return
  }

  // 找到基准ID
  const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('2-12'))
  const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))

  const easyBaseId = easyBaseEntry ? parseInt(easyBaseEntry.id) : 0
  const hardBaseId = hardBaseEntry ? parseInt(hardBaseEntry.id) : 0

  const easyDiff = Math.max(0, easyModeTableId - easyBaseId)+selectedCnLevelCorrection.value

  const hardChapters = chaptersData.value.slice(hardBaseId - 1)
  const seenLevels = new Set()
  const data = []

  let lastValue = null

  hardChapters.forEach(chapter => {
    const chapterId = parseInt(chapter.id)
    if (chapterId > easyModeTableId) return

    const diff = Math.max(0, chapterId - hardBaseId + 1)
    const totalDiff = easyDiff + diff
    const level = Math.floor(totalDiff / 5) + 1

    const outpost = outpostData.value[level]
    if (outpost && outpost.core_dust_mul) {
      const value = parseFloat(outpost.core_dust_mul)

      if (lastValue !== null) {
        const floorLast = Math.floor(lastValue)
        const floorCurrent = Math.floor(value)

        if (floorCurrent > floorLast && !seenLevels.has(floorCurrent)) {
          seenLevels.add(floorCurrent)
          data.push({
            hardChapter: `HARD ${chapter.section}`,
            level: `lv.${level}`,
            coreDust: outpost.core_dust_mul
          })
        }

        // 处理半点显示
        if (showHalfPoints.value === 'true') {
          const halfLast = Math.floor(lastValue * 2) / 2
          const halfCurrent = Math.floor(value * 2) / 2

          if (halfCurrent > halfLast && !seenLevels.has(halfCurrent)) {
            seenLevels.add(halfCurrent)
            data.push({
              hardChapter: `HARD ${chapter.section}`,
              level: `lv.${level}`,
              coreDust: outpost.core_dust_mul
            })
          }
        }
      }

      lastValue = value
    }
  })

  // 根据显示顺序排序
  if (displayMode.value === 'asc') {
    tableData.value = data.slice().reverse()
  } else {
    tableData.value = data
  }
}

// 加载数据
async function loadData() {
  try {
    // 加载章节数据
    const chaptersResponse = await fetch('/json/chapters.json')
    const chaptersJson = await chaptersResponse.json()
    
    // 转换章节数据格式
    if (chaptersJson.Chapters) {
      chaptersData.value = []
      chaptersJson.Chapters.forEach(chapterGroup => {
        chapterGroup.Sections.forEach(section => {
          chaptersData.value.push({
            id: section.id,
            section: section.Section,
            chapterName: chapterGroup.Chapter
          })
        })
      })
    }
    
    // 加载前哨基地数据
    const outpostResponse = await fetch('/json/outpost.json')
    const outpostJson = await outpostResponse.json()
    
    // 转换前哨基地数据格式
    if (outpostJson.outpost) {
      outpostData.value = {}
      outpostJson.outpost.forEach(item => {
        outpostData.value[item.level] = {
          credit: item.credit,
          battle_data_set: item.battle_data_set,
          core_dust: item.core_dust,
          credit_mul: item.credit_mul,
          battle_data_set_mul: item.battle_data_set_mul,
          core_dust_mul: item.core_dust_mul
        }
      })
    }

    // 加载困难关卡战力数据
    const stagesResponse = await fetch('/json/stages-power.json')
    const stagesJson = await stagesResponse.json()
    if (Array.isArray(stagesJson)) stagesPower.value = stagesJson

    // 设置默认值
    const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('38-37'))
    const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))
    const easyBaseEntry2 = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('38-37'))
    if (easyBaseEntry) {
      // 对于级联选择器，我们需要设置完整的路径
      selectedEasyMode.value = [easyBaseEntry.chapterName, easyBaseEntry.id]
      // 表格用的选择器也设置同样的默认值
      selectedEasyModeTable.value = [easyBaseEntry2.chapterName, easyBaseEntry2.id]
    }

    if (hardBaseEntry) {
      // 对于级联选择器，我们需要设置完整的路径
      selectedHardMode.value = [hardBaseEntry.chapterName, hardBaseEntry.id]
    }

    calculateBaseDefenseLevel()
    updateTableData()

    // 读取存储（B站云存储 > 本地浏览器存储），覆盖默认值
    const saved = await readSavedState()
    let changed = false
    if (saved.ebn && saved.ebid) {
      savedEasy.value = { bn: saved.ebn, id: saved.ebid }
      selectedEasyMode.value = [saved.ebn, saved.ebid]
      selectedEasyModeTable.value = [saved.ebn, saved.ebid]
      changed = true
    }
    if (saved.hbn && saved.hbid) {
      savedHard.value = { bn: saved.hbn, id: saved.hbid }
      selectedHardMode.value = [saved.hbn, saved.hbid]
      changed = true
    }
    if (saved.cnlv != null) {
      const v = parseInt(saved.cnlv, 10)
      if (Number.isFinite(v)) {
        selectedCnLevelCorrection.value = v
        changed = true
      }
    }
    if (saved.pw != null && saved.pw !== '') {
      const v = Number(saved.pw)
      if (Number.isFinite(v) && v >= 0) currentPower.value = v
    }
    if (changed) {
      calculateBaseDefenseLevel()
      updateTableData()
    }
  } catch (error) {
    console.error('数据加载失败:', error)
  }
}

// 组件挂载时
onMounted(() => {
  loadData()

  // 初始化Vanta背景效果
  vantaEffect = NET({
    el: vantaRef.value,
    THREE: THREE,
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.0,
    minWidth: 200.0,
    scale: 1.0,
    scaleMobile: 1.0,
    color: 0xc7d1e8,
    backgroundColor: 0xffffff,
    points: 13.0,
    maxDistance: 21.0,
    spacing: 16.0
  })
  //ElNotification({
  //  title: '装备洗练计算器发布！',
  //  message: "现已发布装备洗练计算器！再也不怕洗装备不知道怎么洗了！详情请点击界面顶部“装备洗练计算器”查看！",
  //  position: 'bottom-right',
  //  type: 'info',
  //  duration: 0,
  //})
})

// 组件卸载时
onUnmounted(() => {
  if (vantaEffect) {
    vantaEffect.destroy()
  }
})
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.content-wrapper {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding-bottom: 20px;
}

.content-wrapper h1 {
  text-align: center;
  margin: 20px 0;
  font-size: 26px;
  font-weight: bold;
  text-shadow: 0 2px 8px rgba(31, 162, 255, 0.15);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.input-section {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 20px;
  border: 1px solid #e3ecf7;
  box-shadow: 0 8px 24px rgba(31, 162, 255, 0.06);
}

.select-container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;
}

.select-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cascader-wrapper {
  width: 200px;
}

.cascader-wrapper :deep(.el-cascader) {
  width: 100%;
}

.select-label {
  margin-bottom: 8px;
  font-weight: bold;
}

.level-display {
  text-align: center;
  padding: 20px;
}

.level-info {
  font-size: 18px;
  margin-bottom: 10px;
  color: #444;
}

.level-info #levelDisplay {
  color: #1fa2ff;
  font-weight: bold;
  font-size: 24px;
}

.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-text {
  margin-bottom: 10px;
  color: #666;
  font-weight: bold;
}

.progress-bar {
  display: flex;
  height: 20px;
  width: 200px;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-segment {
  flex: 1;
  background-color: #e0e0e0;
  margin: 0 2px;
  border-radius: 10px;
}

.progress-segment.active {
  background-color: #1fa2ff;
}

.output-section {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 22px 24px;
  margin-bottom: 20px;
  border: 1px solid #e3ecf7;
  box-shadow: 0 8px 24px rgba(31, 162, 255, 0.06);
}

.output-section h3 {
  text-align: center;
  margin-bottom: 15px;
}

.tit {
  text-align: center;
  margin: 6px 0 18px;
  font-size: 20px;
  font-weight: bold;
}

.tit::after {
  content: '';
  display: block;
  width: 60px;
  height: 3px;
  margin: 8px auto 0;
  background: linear-gradient(90deg, #1fa2ff, #3553ff);
  border-radius: 3px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.resource-item {
  text-align: center;
  padding: 18px 12px;
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.resource-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(31, 162, 255, 0.1);
}

.resource-name {
  font-weight: bold;
  color: #444;
  margin-bottom: 6px;
}

.resource-value {
  font-size: 20px;
  color: #1fa2ff;
  font-weight: bold;
}

.table-section {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 22px 24px;
  border: 1px solid #e3ecf7;
  box-shadow: 0 8px 24px rgba(31, 162, 255, 0.06);
}

.table-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #e3ecf7;
  border-radius: 10px;
  overflow: hidden;
}

.data-table th,
.data-table td {
  padding: 10px 8px;
  text-align: center;
  border-bottom: 1px solid #eef2f7;
}

.data-table th {
  background: linear-gradient(0deg, #1fa2ff, #3553ff);
  color: #fff;
  font-weight: bold;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: #f0f7ff;
}

.level-cell {
  width: 30%;
}

.core-dust-cell {
  width: 40%;
  font-weight: bold;
  color: #1fa2ff;
}

.footer-section {
    background: linear-gradient(145deg, #fff, #f8fafc);
    border-radius: 20px;
    margin: 80px 15px 15px 15px;
    padding: 20px;
    box-shadow: 0 15px 35px #00000014;
    border: 1px solid rgba(255, 255, 255, .8);
    position: relative;
    overflow: hidden
}

.footer-section:before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #1fa2ff, #3553ff)
}

.footer-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 30px;
    align-items: start
}

.instructions h3,
.contact-info h3 {
    font-size: 1.2em;
    font-weight: 700;
    color: #000;
    margin-bottom: 15px;
    text-align: center;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px
}

.instruction-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px
}

.instruction-item {
    padding: 15px;
    background: #667eea0d;
    border-radius: 12px;
    border-left: 4px solid #1fa2ff;
    transition: all .3s ease
}

.instruction-item:hover {
    background: #667eea1a;
    transform: translate(5px)
}

.instruction-text {
    color: #000;
    line-height: 1.6;
    font-weight: 700
}

.instruction-text strong {
    color: #1fa2ff;
    font-weight: 700
}

.contact-platforms {
    display: grid;
    grid-template-columns: 1fr;
    gap: 15px;
    margin-bottom: 20px
}

.contact-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: #667eea0d;
    border-radius: 10px;
    border: 1px solid rgba(102, 126, 234, .1);
    transition: all .3s ease
}

.contact-item:hover {
    background: #667eea1a;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px #667eea33
}

.contact-platform {
    font-weight: 700;
    color: #1fa2ff;
    font-size: 1.1em
}

.contact-id {
    font-weight: 600;
    color: #000;
    font-size: 1.1em
}

.footer-note {
    text-align: center;
    color: #666;
    font-style: italic;
    margin-top: 15px;
    padding: 15px;
    background: #667eea0d;
    border-radius: 8px
}

.pressure-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.pressure-label {
  font-weight: bold;
  color: #333;
  min-width: 72px;
}

/* 下一关战压面板 */
.pressure-panel {
  margin-top: 16px;
  padding: 16px 18px;
  background: #fbfdff;
  border: 1px solid #e3ecf7;
  border-radius: 10px;
}

.pressure-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pressure-panel-title {
  font-size: 16px;
  font-weight: bold;
  color: #3553ff;
  border-left: 4px solid #1fa2ff;
  padding-left: 8px;
}

.pressure-panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pressure-panel-field {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pressure-panel-label {
  font-weight: bold;
  color: #444;
  min-width: 72px;
}

.pressure-next-name {
  color: #333;
  font-weight: 600;
}

.pressure-next-power {
  color: #1fa2ff;
  font-weight: bold;
}

.pressure-inline {
  color: #333;
  font-weight: 600;
}

.pressure-empty {
  color: #909399;
  font-size: 13px;
}

.pressure-result {
  margin-top: 6px;
  padding: 14px 16px;
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 10px;
  line-height: 2;
}

.pressure-formula {
  color: #444;
  font-size: 14px;
}

.pressure-formula b {
  color: #3553ff;
}

.pressure-factor {
  font-size: 16px;
  color: #222;
}

.pressure-big {
  color: #1fa2ff;
  font-size: 22px;
  margin-left: 4px;
}

.pressure-note {
  color: #666;
  font-size: 13px;
}

.pressure-hint {
  color: #909399;
  font-size: 13px;
  padding: 6px 0;
}

@media (max-width: 768px) {
  .select-container {
    flex-direction: column;
    align-items: center;
  }

  .table-controls {
    flex-direction: column;
    align-items: center;
  }

  .table-controls .control-group {
    width: 100%;
    max-width: 300px;
  }

  .resource-grid,
  .footer-content,
  .contact-platforms,
  .instruction-grid {
    grid-template-columns: 1fr;
  }
  
  .cascader-wrapper {
    width: 100%;
  }
  
  :deep(.el-cascader) {
    width: 100%;
  }
}

</style>