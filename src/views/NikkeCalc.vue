<template>
  <div class="backgr" ref="vantaRef">
    <div class="content-wrapper">
      <h1>前哨基地资源产出计算器</h1>

      <div style="text-align: center; margin-bottom: 20px;">
        <el-button color="#1fa2ff" plain @click="$router.push('Home')">返回主页</el-button>
      </div>

      <div class="container">
        <div class="input-section">
          <div class="select-container">
            <div class="select-group">
              <label class="select-label" data-i18n="easyMode">普通模式</label>
              <el-select v-model="selectedEasyMode" placeholder="请选择普通模式关卡" style="width: 200px;"
                @change="calculateBaseDefenseLevel">
                <el-option-group v-for="(group, groupName) in easyModeGroups" :key="groupName" :label="groupName">
                  <el-option v-for="item in group" :key="item.id" :label="item.section" :value="item.id">
                  </el-option>
                </el-option-group>
              </el-select>
            </div>

            <div class="select-group">
              <label class="select-label" data-i18n="hardMode">困难模式</label>
              <el-select v-model="selectedHardMode" placeholder="请选择困难模式关卡" style="width: 200px;"
                @change="calculateBaseDefenseLevel">
                <el-option-group v-for="(group, groupName) in hardModeGroups" :key="groupName" :label="groupName">
                  <el-option v-for="item in group" :key="item.id" :label="item.section" :value="item.id">
                  </el-option>
                </el-option-group>
              </el-select>
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
        </div>
        <h2 class="tit">防御前哨基地产出</h2>
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
              <el-select v-model="selectedEasyModeTable" placeholder="请选择普通模式关卡" style="width: 200px;"
                @change="updateTableData">
                <el-option-group v-for="(group, groupName) in easyModeTableGroups" :key="groupName" :label="groupName">
                  <el-option v-for="item in group" :key="item.id" :label="item.section" :value="item.id">
                  </el-option>
                </el-option-group>
              </el-select>
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
                    选择战役关卡代表已通关该关卡
                  </div>
                </div>
                <div class="instruction-item">
                  <div class="instruction-text" data-i18n="instruction2">
                    数值可能有 ±0.01 显示误差
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
                  <div class="contact-platform">搬运</div>
                  <div class="contact-id">zbxzbx98</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ElSelect, ElOption, ElOptionGroup } from 'element-plus'
import * as THREE from "three";
import NET from "vanta/src/vanta.net";

// 数据引用
const selectedEasyMode = ref('')
const selectedHardMode = ref('')
const selectedEasyModeTable = ref('')
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

// 分组数据
const easyModeGroups = computed(() => groupChaptersByType('easy'))
const hardModeGroups = computed(() => groupChaptersByType('hard'))
const easyModeTableGroups = computed(() => groupChaptersByType('easyTable'))

// Vanta背景效果
const vantaRef = ref()
let vantaEffect

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
  const easyModeId = parseInt(selectedEasyMode.value) || 0
  const hardModeId = parseInt(selectedHardMode.value) || 0

  // 找到基准ID
  const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('2-12'))
  const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))

  const easyBaseId = easyBaseEntry ? parseInt(easyBaseEntry.id) : 0
  const hardBaseId = hardBaseEntry ? parseInt(hardBaseEntry.id) : 0

  const easyDiff = Math.max(0, easyModeId - easyBaseId)
  const hardDiff = Math.max(0, hardModeId - hardBaseId + 1)

  const totalDiff = easyDiff + hardDiff
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
  const easyModeTableId = parseInt(selectedEasyModeTable.value) || 0
  if (easyModeTableId === 0) {
    tableData.value = []
    return
  }

  // 找到基准ID
  const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('2-12'))
  const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))

  const easyBaseId = easyBaseEntry ? parseInt(easyBaseEntry.id) : 0
  const hardBaseId = hardBaseEntry ? parseInt(hardBaseEntry.id) : 0

  const easyDiff = Math.max(0, easyModeTableId - easyBaseId)

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

    // 设置默认值
    const easyBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('2-12'))
    const hardBaseEntry = chaptersData.value.find(chapter => chapter.section && chapter.section.startsWith('0-1'))

    if (easyBaseEntry) {
      selectedEasyMode.value = easyBaseEntry.id
    }

    if (hardBaseEntry) {
      selectedHardMode.value = hardBaseEntry.id
    }

    calculateBaseDefenseLevel()
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
})

// 组件卸载时
onUnmounted(() => {
  if (vantaEffect) {
    vantaEffect.destroy()
  }
})
</script>

<style scoped>
.backgr {
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.content-wrapper {
  min-height: 100vh;
  padding-bottom: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.input-section {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
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
}

.progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-text {
  margin-bottom: 10px;
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
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.output-section h3 {
  text-align: center;
  margin-bottom: 15px;
}

.tit {
  text-align: center;
  margin-bottom: 10px;
  margin-top: 10px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.resource-item {
  text-align: center;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 5px;
}

.resource-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.resource-value {
  font-size: 18px;
  color: #1fa2ff;
}

.table-section {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 20px;
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
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}

.data-table th {
  background-color: #f2f2f2;
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
    background: linear-gradient(90deg, #667eea, #764ba2)
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
    grid-template-columns: 1fr 1fr;
    gap: 15px
}

.instruction-item {
    padding: 15px;
    background: #667eea0d;
    border-radius: 12px;
    border-left: 4px solid #667eea;
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
    color: #667eea;
    font-weight: 700
}

.contact-platforms {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    color: #667eea;
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

@media (max-width: 768px) {
  .select-container {
    flex-direction: column;
    align-items: center;
  }

  .table-controls {
    flex-direction: column;
    align-items: center;
  }

  .resource-grid {
    grid-template-columns: 1fr;
  }
}
</style>