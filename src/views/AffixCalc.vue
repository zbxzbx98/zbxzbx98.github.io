<template>
  <div class="vanta-bg" ref="vantaRef"></div>
  <div class="content-wrapper">
    <h1>胜利女神装备洗练计算器</h1>

    <div style="text-align: center; margin-bottom: 20px;">
      <el-button color="#1fa2ff" plain @click="$router.push('Home')">返回主页</el-button>
      <a href="https://www.bilibili.com/toy/AffixCalc/index.html" style="margin-left: 10px; margin-right: 10px;"><el-button color="#1fa2ff" plain>查看B站版</el-button></a>
      <el-button color="#1fa2ff" plain @click="$router.push('NikkeCalc')">资源产出计算器</el-button>
    </div>

    <div class="container">
      <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
        <!-- ==================== 单装备词条计算 ==================== -->
        <el-tab-pane label="单装备词条计算" name="single">
          <div class="panel">
            <h2 class="panel-title">① 当前装备状态</h2>
            <p class="panel-note">按栏位选择已有词条与阶数；一号栏位选择「空词条」时视为全新装备，其余栏位自动置空且不可更改。每件装备最多锁定 2 个栏位。</p>
            <div class="slot-list">
              <div class="slot-row" v-for="(slot, i) in singleGear.slots" :key="i">
                <span class="slot-label">栏位{{ i + 1 }}</span>
                <el-select
                  v-model="slot.effect"
                  style="width: 190px"
                  :disabled="i > 0 && singleGear.slots[0].effect === 'wd'"
                  @change="onSlotEffectChange(singleGear, i)"
                >
                  <el-option v-for="e in effectOptions" :key="e.code" :label="e.name" :value="e.code" />
                </el-select>
                <el-select
                  v-model="slot.tier"
                  style="width: 170px"
                  :disabled="slot.effect === 'wd' || (i > 0 && singleGear.slots[0].effect === 'wd')"
                  placeholder="选择阶数"
                >
                  <el-option v-for="t in tierOptions(slot.effect)" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
                <el-checkbox v-model="slot.locked" :disabled="lockDisabled(singleGear, i)">已锁定</el-checkbox>
              </div>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">② 目标词条（最多 3 个，不可重复）</h2>
            <p class="panel-note">同一行下拉可多选词条并合并为同一目标：抽中其中任意一个（达到期望阶数）即算该目标达标，等价于把它们的概率权重合并（如 暴击伤害+暴击率 11 阶 = bsbj11）。不同行的目标仍需同时满足；所有词条全局不可重复。</p>
            <div class="slot-list">
              <div class="slot-row" v-for="(t, i) in singleTargets" :key="i">
                <span class="slot-label">目标{{ i + 1 }}</span>
                <el-select v-model="t.effects" multiple style="width: 220px" placeholder="选择词条（可多选）">
                  <el-option v-for="e in availableEffects(singleTargets, i)" :key="e.code" :label="e.name" :value="e.code" />
                </el-select>
                <el-select v-model="t.tier" style="width: 170px" :disabled="!t.effects || !t.effects.length" placeholder="选择阶数">
                  <el-option v-for="tier in tierOptions(t.effects)" :key="tier.value" :label="tier.label" :value="tier.value" />
                </el-select>
                <el-button v-if="singleTargets.length > 1" text type="danger" @click="removeTarget(singleTargets, i)">删除</el-button>
              </div>
            </div>
            <div class="add-row">
              <el-button color="#1fa2ff" plain :disabled="singleTargets.length >= 3" @click="addTarget(singleTargets, 3)">+ 添加目标词条</el-button>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">③ 秘钥使用阈值 p</h2>
            <p class="panel-note">秘钥策略下，仅当本次洗练后有超过 p 的概率到达更优状态时才使用秘钥锁；否则直接用石头洗练。p 越大越节省秘钥。</p>
            <div class="p-row">
              <el-input-number v-model="keyP" :min="0" :max="1" :step="0.01" :precision="2" controls-position="right" style="width: 160px" />
              <span class="p-value-note">当前阈值 {{ keyP }}（0 = 尽可能多用秘钥；1 = 完全不用秘钥）</span>
            </div>
          </div>

          <div class="panel action-panel">
            <div class="action-buttons">
              <el-button color="#1fa2ff" size="large" :loading="computing && resultMode === 'single'" @click="computeSingle">开始计算</el-button>
              <el-button size="large" plain @click="openSingleCompare">对比变更</el-button>
            </div>
            <div v-if="computing && resultMode === 'single'" class="computing-tip">
              正在计算最优策略，请稍候…
            </div>
            <el-alert
              v-if="errorMsg && resultMode === 'single'"
              class="error-alert"
              type="error"
              :title="errorMsg"
              :closable="false"
              show-icon
            />
            <div class="preview-line">
              <span class="preview-label">当前状态：</span><code>{{ singleCurrentPreview }}</code><br />
              <span class="preview-label">目标词条：</span><code>{{ singleTargetPreview || '（未选择）' }}</code>
            </div>
          </div>

          <div class="panel compare-panel" v-if="singleCompareOpen">
            <h3 class="panel-title">对比变更（单装备）</h3>
            <p class="panel-note">把洗练后得到的词条填到下方，点击「开始对比」查看新期望与变更前的差别；确定保留后一键替换原装备词条。</p>
            <div class="slot-list">
              <div class="slot-row" v-for="(slot, i) in singleCompareSlots" :key="i">
                <span class="slot-label">栏位{{ i + 1 }}</span>
                <el-select
                  v-model="slot.effect"
                  style="width: 190px"
                  :disabled="i > 0 && singleCompareSlots[0].effect === 'wd'"
                  @change="onCompareSlotChange(singleCompareSlots, i)"
                >
                  <el-option v-for="e in effectOptions" :key="e.code" :label="e.name" :value="e.code" />
                </el-select>
                <el-select
                  v-model="slot.tier"
                  style="width: 170px"
                  :disabled="slot.effect === 'wd' || (i > 0 && singleCompareSlots[0].effect === 'wd')"
                  placeholder="选择阶数"
                >
                  <el-option v-for="t in tierOptions(slot.effect)" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
                <el-checkbox v-model="slot.locked" :disabled="lockDisabled({ slots: singleCompareSlots }, i)">已锁定</el-checkbox>
              </div>
            </div>
            <div class="compare-actions">
              <el-button color="#1fa2ff" :loading="compareLoading && compareMode === 'single'" @click="computeSingleCompare">开始对比</el-button>
              <el-button type="success" :disabled="!singleCompareResult || (compareLoading && compareMode === 'single')" @click="applySingleCompare">一键替换原装备词条</el-button>
            </div>
            <div v-if="compareLoading && compareMode === 'single'" class="computing-tip">{{ compareProgress || '正在计算对比…' }}</div>
            <div v-if="singleCompareResult" class="compare-result">
              <div class="compare-row">
                <span class="compare-label">变更前期望：</span>
                <span class="compare-cost">{{ singleCompareResult.baseCost }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">变更后期望：</span>
                <span class="compare-cost">{{ singleCompareResult.newCost }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">全石头期望差：</span>
                <span :class="diffClass(singleCompareResult.deltaStone)">{{ fmtNum(singleCompareResult.deltaStone) }}</span>
                <span class="compare-verdict" :class="singleCompareResult.verdictClass">{{ singleCompareResult.verdictText }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">秘钥策略差：</span>
                <span>{{ fmtNum(singleCompareResult.deltaKeyStone) }} 石头 / {{ fmtNum(singleCompareResult.deltaKeys) }} 秘钥</span>
              </div>
              <p class="note">负数为变更后更省；全石头期望为主要比较口径。</p>
            </div>
          </div>

          <div class="panel result-panel" v-if="result && result.mode === 'single'">
            <h2 class="panel-title">计算结果</h2>
            <div v-if="isDone" class="done-banner">当前装备已满足目标词条，无需操作（d0）。</div>
            <template v-else>
              <div class="cost-grid">
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.allStone }}</div>
                  <div class="cost-label">全石头期望（石头）</div>
                </div>
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.keyStone }}</div>
                  <div class="cost-label">秘钥策略石头期望</div>
                </div>
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.keys }}</div>
                  <div class="cost-label">秘钥期望</div>
                </div>
              </div>

              <div class="action-section">
                <h4>允许秘钥时的下一步操作</h4>
                <ol class="action-list">
                  <li v-for="(tok, idx) in singleKeyTokens" :key="idx">{{ translateToken(tok, 'single', false) }}</li>
                </ol>
                <p class="note">注：秘钥锁为一次性，本次洗练后自动解除；仅在本次洗练有超过阈值 p 的概率到达更优状态时才使用秘钥锁，否则回退用石头锁/直接洗练。解锁免费。</p>
              </div>

              <div class="action-section">
                <h4>全石头策略的下一步操作</h4>
                <ol class="action-list">
                  <li v-for="(tok, idx) in singleStoneTokens" :key="idx">{{ translateToken(tok, 'single', true) }}</li>
                </ol>
                <p class="note">注：石头锁为永久锁定，可在后续洗练前免费解除；解锁免费。</p>
              </div>
            </template>

            <div class="meta-line" v-if="result.stateCount">压缩状态数：{{ result.stateCount }}</div>

            <div class="time-section" v-if="expectedDays">
              <h4>期望攒资源时间（按每日产出）</h4>
              <div class="time-row">
                <span class="time-server">国服（3.402 石头/天，18 秘钥/天）</span>
                <span class="time-val">秘钥策略 {{ fmtDays(expectedDays.cn.key) }} ｜ 全石头 {{ fmtDays(expectedDays.cn.stone) }}</span>
              </div>
              <div class="time-row">
                <span class="time-server">国际服（4.21 石头/天，18 秘钥/天）</span>
                <span class="time-val">秘钥策略 {{ fmtDays(expectedDays.int.key) }} ｜ 全石头 {{ fmtDays(expectedDays.int.stone) }}</span>
              </div>
              <p class="note">秘钥策略按两种资源同时攒、取较慢者估算；实际天数随每日掉落浮动。</p>
            </div>
          </div>
        </el-tab-pane>

        <!-- ==================== 角色装备词条计算 ==================== -->
        <el-tab-pane label="角色装备词条计算" name="character">
          <div class="panel">
            <h2 class="panel-title">① 四件装备当前状态</h2>
            <p class="panel-note">每件装备的选择规则与单装备一致；目标按四件装备属性合计计算。</p>
            <div class="gear-grid">
              <div class="gear-card" v-for="(gear, g) in characterGears" :key="g">
                <h3 class="gear-title">装备{{ gearNames[g] }}</h3>
                <div class="slot-list">
                  <div class="slot-row" v-for="(slot, i) in gear.slots" :key="i">
                    <span class="slot-label">栏位{{ i + 1 }}</span>
                    <el-select
                      v-model="slot.effect"
                      style="width: 160px"
                      :disabled="i > 0 && gear.slots[0].effect === 'wd'"
                      @change="onSlotEffectChange(gear, i)"
                    >
                      <el-option v-for="e in effectOptions" :key="e.code" :label="e.name" :value="e.code" />
                    </el-select>
                    <el-select
                      v-model="slot.tier"
                      style="width: 140px"
                      :disabled="slot.effect === 'wd' || (i > 0 && gear.slots[0].effect === 'wd')"
                      placeholder="阶数"
                    >
                      <el-option v-for="t in tierOptions(slot.effect)" :key="t.value" :label="t.label" :value="t.value" />
                    </el-select>
                    <el-checkbox v-model="slot.locked" :disabled="lockDisabled(gear, i)">锁定</el-checkbox>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">② 角色目标词条（最多 5 个，四件装备合计）</h2>
            <p class="panel-note">同一行下拉可多选词条并合并为同一目标：四件装备上任意词条达到该目标即累计贡献阶数（如 暴击伤害+暴击率 总 22 阶 = bsbj22）。不同行的目标仍需同时满足；所有词条全局不可重复。</p>
            <div class="slot-list">
              <div class="slot-row" v-for="(t, i) in characterTargets" :key="i">
                <span class="slot-label">目标{{ i + 1 }}</span>
                <el-select v-model="t.effects" multiple style="width: 220px" placeholder="选择词条（可多选）">
                  <el-option v-for="e in availableEffects(characterTargets, i)" :key="e.code" :label="e.name" :value="e.code" />
                </el-select>
                <el-select v-model="t.tier" style="width: 230px" :disabled="!t.effects || !t.effects.length" placeholder="选择总阶数">
                  <el-option v-for="opt in charTierOptions(t.effects)" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-button v-if="characterTargets.length > 1" text type="danger" @click="removeTarget(characterTargets, i)">删除</el-button>
              </div>
            </div>
            <div class="add-row">
              <el-button color="#1fa2ff" plain :disabled="characterTargets.length >= 5" @click="addTarget(characterTargets, 5, 44)">+ 添加目标词条</el-button>
            </div>
            <div class="rule-note">
              校验规则：单个目标（含合并词条）总阶数 ≤ 60；全部目标总阶数 ≤ 180；各目标阶数 ÷15 向上取整后相加 ≤ 12（即四件装备共 12 栏）。
            </div>
            <div class="algorithm-note">
              算法说明：角色版把总目标分解到四件装备，分别用单装备精确求解器计算，总期望为各装备期望之和，结果接近全局最优但为近似策略，供参考。
            </div>
          </div>

          <div class="panel">
            <h2 class="panel-title">③ 秘钥使用阈值 p</h2>
            <p class="panel-note">秘钥策略下，仅当本次洗练后有超过 p 的概率到达更优状态时才使用秘钥锁；否则直接用石头洗练。p 越大越节省秘钥。</p>
            <div class="p-row">
              <el-input-number v-model="keyP" :min="0" :max="1" :step="0.01" :precision="2" controls-position="right" style="width: 160px" />
              <span class="p-value-note">当前阈值 {{ keyP }}（0 = 尽可能多用秘钥；1 = 完全不用秘钥）</span>
            </div>
            <div class="p-row" style="margin-top: 10px;">
              <el-checkbox v-model="usePrecise">使用更精确策略计算</el-checkbox>
              <span class="p-value-note">勾选后会对比两种分配方案取更优（已有高阶词条时更准确，但计算更慢）；取消勾选使用快速近似分配。</span>
            </div>
          </div>

          <div class="panel action-panel">
            <div class="action-buttons">
              <el-button color="#1fa2ff" size="large" :loading="computing && resultMode === 'character'" @click="computeCharacter">开始计算</el-button>
              <el-button size="large" plain @click="openCharCompare">对比变更</el-button>
            </div>
            <div v-if="computing && resultMode === 'character'" class="computing-tip">
              <span class="spinner"></span>
              {{ progressText }}（已用时 {{ elapsed }} 秒）
              <el-button size="small" type="danger" plain style="margin-left: 10px;" @click="cancelCompute">取消计算</el-button>
            </div>
            <el-alert
              v-if="errorMsg && resultMode === 'character'"
              class="error-alert"
              type="error"
              :title="errorMsg"
              :closable="false"
              show-icon
            />
            <div class="preview-line">
              <span class="preview-label">当前状态：</span>
              <code v-for="(line, gi) in characterCurrentLines" :key="gi" class="preview-block">{{ line }}</code>
              <span class="preview-label">目标词条：</span><code>{{ characterTargetPreview || '（未选择）' }}</code>
            </div>
          </div>

          <div class="panel compare-panel" v-if="charCompareOpen">
            <h3 class="panel-title">对比变更（角色）</h3>
            <p class="panel-note">选择要对比的装备，把洗练后得到的词条填入下方，点击「开始对比」查看整角色新期望与变更前的差别；确定保留后一键替换该装备词条。</p>
            <div class="slot-row">
              <span class="slot-label">选择装备</span>
              <el-select v-model="charCompareGear" style="width: 140px" @change="onCharCompareGearChange">
                <el-option v-for="g in 4" :key="g" :label="'装备' + gearNames[g - 1]" :value="g - 1" />
              </el-select>
            </div>
            <div class="slot-list" style="margin-top: 10px;">
              <div class="slot-row" v-for="(slot, i) in charCompareSlots" :key="i">
                <span class="slot-label">栏位{{ i + 1 }}</span>
                <el-select
                  v-model="slot.effect"
                  style="width: 190px"
                  :disabled="i > 0 && charCompareSlots[0].effect === 'wd'"
                  @change="onCompareSlotChange(charCompareSlots, i)"
                >
                  <el-option v-for="e in effectOptions" :key="e.code" :label="e.name" :value="e.code" />
                </el-select>
                <el-select
                  v-model="slot.tier"
                  style="width: 170px"
                  :disabled="slot.effect === 'wd' || (i > 0 && charCompareSlots[0].effect === 'wd')"
                  placeholder="选择阶数"
                >
                  <el-option v-for="t in tierOptions(slot.effect)" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
                <el-checkbox v-model="slot.locked" :disabled="lockDisabled({ slots: charCompareSlots }, i)">已锁定</el-checkbox>
              </div>
            </div>
            <div class="compare-actions">
              <el-button color="#1fa2ff" :loading="compareLoading && compareMode === 'character'" @click="computeCharCompare">开始对比</el-button>
              <el-button type="success" :disabled="!charCompareResult || (compareLoading && compareMode === 'character')" @click="applyCharCompare">一键替换原装备词条</el-button>
            </div>
            <div v-if="compareLoading && compareMode === 'character'" class="computing-tip">{{ compareProgress || '正在计算对比…' }}</div>
            <div v-if="charCompareResult" class="compare-result">
              <div class="compare-row">
                <span class="compare-label">变更前期望：</span>
                <span class="compare-cost">{{ charCompareResult.baseCost }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">变更后期望：</span>
                <span class="compare-cost">{{ charCompareResult.newCost }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">全石头期望差：</span>
                <span :class="diffClass(charCompareResult.deltaStone)">{{ fmtNum(charCompareResult.deltaStone) }}</span>
                <span class="compare-verdict" :class="charCompareResult.verdictClass">{{ charCompareResult.verdictText }}</span>
              </div>
              <div class="compare-row">
                <span class="compare-label">秘钥策略差：</span>
                <span>{{ fmtNum(charCompareResult.deltaKeyStone) }} 石头 / {{ fmtNum(charCompareResult.deltaKeys) }} 秘钥</span>
              </div>
              <p class="note">负数为变更后更省；全石头期望为主要比较口径。</p>
            </div>
          </div>

          <div class="panel result-panel" v-if="result && result.mode === 'character'">
            <h2 class="panel-title">计算结果</h2>
            <div v-if="isDone" class="done-banner">当前角色已满足目标词条，无需操作（d0）。</div>
            <template v-else>
              <div class="cost-grid">
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.allStone }}</div>
                  <div class="cost-label">全石头期望（石头）</div>
                </div>
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.keyStone }}</div>
                  <div class="cost-label">秘钥策略石头期望</div>
                </div>
                <div class="cost-item">
                  <div class="cost-num">{{ costParts.keys }}</div>
                  <div class="cost-label">秘钥期望</div>
                </div>
              </div>

              <div class="action-section">
                <h4>允许秘钥时的下一步操作</h4>
                <ol class="action-list">
                  <li v-for="(tok, idx) in actionTokens(result.action)" :key="idx">{{ translateToken(tok, 'character') }}</li>
                </ol>
                <p class="note">注：允许秘钥策略中的秘钥锁为一次性，本次洗练后自动解除；仅在本次洗练有超过阈值 p 的概率到达更优状态时才使用秘钥锁，否则回退用石头锁/直接洗练。</p>
              </div>

              <div class="action-section">
                <h4>全石头策略的下一步操作</h4>
                <ol class="action-list">
                  <li v-for="(tok, idx) in actionTokens(result.stoneOnlyAction)" :key="idx">{{ translateToken(tok, 'character', true) }}</li>
                </ol>
                <p class="note">注：石头锁为永久锁定，可在后续洗练前免费解除；解锁免费。</p>
              </div>
            </template>

            <div class="meta-line" v-if="result.approx">本结果由分装备近似分解求得（总期望 = 各装备期望之和）。</div>
            <div class="gear-detail" v-if="result.detail && result.detail.length">
              <h4>各装备子目标与期望</h4>
              <div class="gear-detail-row" v-for="d in result.detail" :key="d.gear">
                <span class="detail-gear">装备{{ gearNames[d.gear - 1] }}：</span>
                <span class="detail-sub">{{ d.subTargets ? '子目标 ' + translateCodes(d.subTargets) : '无需洗练' }}</span>
                <span class="detail-cost">期望 {{ d.cost }}</span>
              </div>
            </div>
            <div class="meta-line" v-if="result.graph && result.graph.mode !== 'decomposed'">
              求解规模：全石头 {{ result.graph.stoneOnlyStates }} 状态 / 允许秘钥 {{ result.graph.withKeysStates }} 状态
            </div>

            <div class="time-section" v-if="expectedDays">
              <h4>期望攒资源时间（按每日产出）</h4>
              <div class="time-row">
                <span class="time-server">国服（3.402 石头/天，18 秘钥/天）</span>
                <span class="time-val">秘钥策略 {{ fmtDays(expectedDays.cn.key) }} ｜ 全石头 {{ fmtDays(expectedDays.cn.stone) }}</span>
              </div>
              <div class="time-row">
                <span class="time-server">国际服（4.21 石头/天，18 秘钥/天）</span>
                <span class="time-val">秘钥策略 {{ fmtDays(expectedDays.int.key) }} ｜ 全石头 {{ fmtDays(expectedDays.int.stone) }}</span>
              </div>
              <p class="note">秘钥策略按两种资源同时攒、取较慢者估算；实际天数随每日掉落浮动。</p>
            </div>
          </div>
        </el-tab-pane>

        <!-- ==================== 洗词条模拟器 ==================== -->
        <el-tab-pane label="洗词条模拟器" name="simulator">
          <AffixSimulator />
        </el-tab-pane>
      </el-tabs>

      <div class="footer-section">
        <div class="footer-content">
          <div class="instructions">
            <h3>注意事项</h3>
            <div class="instruction-grid">
              <div class="instruction-item">
                <div class="instruction-text">
                  本计算器仅用于估计词条期望和大致给出最优策略，不一定为绝对正确的策略，任何使用本计算器造成的石头/秘钥消耗由您本人自行承担
                </div>
              </div>
            </div>
          </div>

          <div class="contact-info">
            <h3>制作信息</h3>
            <div class="contact-platforms">
              <div class="contact-item">
                <div class="contact-platform">制作</div>
                <div class="contact-id">zbxzbx98</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import * as THREE from 'three'
import NET from 'vanta/src/vanta.net'
import AffixSimulator from '../components/AffixSimulator.vue'
import { CHAR_TIER_RANGES } from '../affix_tier_ranges.js'

/* ==================== 词条与数值常量（来自《代号规定和已有算法.txt》） ==================== */

const EFFECTS = [
  { code: 'uy', name: '优越代码伤害' },
  { code: 'gj', name: '攻击力' },
  { code: 'bs', name: '暴击伤害' },
  { code: 'fy', name: '防御力' },
  { code: 'xl', name: '蓄力伤害' },
  { code: 'xs', name: '蓄力速度' },
  { code: 'bj', name: '暴击率' },
  { code: 'mz', name: '命中率' },
  { code: 'dr', name: '最大装弹数' },
]

const EFFECT_NAME = Object.fromEntries(EFFECTS.map(e => [e.code, e.name]))

// 错误提示/子目标中的代号 -> 中文
const EFFECT_CN = {
  uy: '优越代码伤害',
  gj: '攻击力',
  bs: '暴击伤害',
  fy: '防御力',
  xl: '蓄力伤害',
  xs: '蓄力速度',
  bj: '暴击率',
  mz: '命中率',
  dr: '最大装弹数',
  wd: '空词条',
}

function translateCodes(text) {
  if (typeof text !== 'string') return text
  let s = text
  // 合并目标形式：多个代号直接拼接 + 阶数，如 bsbj11 / 2bsbj13
  s = s.replace(/((?:uy|gj|bs|fy|xl|xs|bj|mz|dr){2,})(\d+)/g, (_, codes, num) => {
    const names = codes.match(/uy|gj|bs|fy|xl|xs|bj|mz|dr/g).map(c => EFFECT_CN[c])
    return names.join('或') + num
  })
  for (const [code, cn] of Object.entries(EFFECT_CN)) {
    // 0uy11 / 1gj13 形式（锁定状态 + 代号 + 阶数）
    s = s.replace(new RegExp('([01])' + code + '(\\d+)', 'g'), '$1' + cn + '$2')
    // uy13 / gj5 形式（代号 + 阶数）
    s = s.replace(new RegExp('(?<![a-z0-9])' + code + '(?=\\d+)', 'g'), cn)
    // 纯代号
    s = s.replace(new RegExp('(?<![a-z0-9])' + code + '(?![a-z0-9])', 'g'), cn)
  }
  return s
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

const gearNames = ['一', '二', '三', '四']

/* ==================== 表单状态 ==================== */

const activeTab = ref('single')

const blankSlot = () => ({ effect: 'wd', tier: 0, locked: false })
const blankGear = () => ({ slots: [blankSlot(), blankSlot(), blankSlot()] })
// 目标：effects 为多选词条代号数组（同一行多选合并为同一目标）
// 单装备默认 13 阶；角色目标默认 44 阶（13 阶对角色来说太低）
const blankTarget = (tier = 13) => ({ effects: [], tier })

const singleGear = ref(blankGear())
const characterGears = ref([blankGear(), blankGear(), blankGear(), blankGear()])
const singleTargets = ref([blankTarget()])
const characterTargets = ref([blankTarget(44)])

// 秘钥使用概率阈值 p（0~1，默认 0.1）：
// 秘钥策略下，仅当本次洗练有超过 p 的概率到达更优状态时才使用秘钥锁
const keyP = ref(0.1)

// 角色版“更精确策略计算”：对比两种分配方案取更优（更慢）
const usePrecise = ref(true)

const computing = ref(false)
const resultMode = ref('')
const progressText = ref('')
const elapsed = ref(0)
const result = ref(null)
const errorMsg = ref('')

// 对比变更
const singleCompareOpen = ref(false)
const singleCompareSlots = ref([blankSlot(), blankSlot(), blankSlot()])
const singleCompareResult = ref(null)
const charCompareOpen = ref(false)
const charCompareGear = ref(0)
const charCompareSlots = ref([blankSlot(), blankSlot(), blankSlot()])
const charCompareResult = ref(null)
const compareLoading = ref(false)
const compareMode = ref('')
const compareProgress = ref('')

let worker = null
let requestId = 0
let elapsedTimer = null
let lastSingleSig = ''
let lastCharSig = ''
let compareReqId = 0
let currentCompareReqId = 0
const pendingCompare = new Map()

/* ==================== 计算属性 / 工具函数 ==================== */

const effectOptions = [
  { code: 'wd', name: '空词条' },
  ...EFFECTS,
]

// effect 可以是单个代号，也可以是合并目标的多选代号数组
function tierOptions(effect) {
  const codes = Array.isArray(effect) ? effect : (effect ? [effect] : [])
  if (!codes.length || codes[0] === 'wd') return []
  const merged = codes.length > 1
  return TIER_VALUES[codes[0]].map((v, idx) => ({
    value: idx + 1,
    label: merged ? `阶数${idx + 1}` : `阶数${idx + 1}（${v}）`,
  }))
}

// 角色目标总阶数选项（1~60）：仅单选一个词条时显示数值范围，
// 如 阶数15（29.16%~53.58%）；多选合并时只显示阶数
function charTierOptions(effects) {
  const codes = Array.isArray(effects) ? effects : (effects ? [effects] : [])
  const single = codes.length === 1 ? codes[0] : null
  const ranges = single ? (CHAR_TIER_RANGES[single] || null) : null
  return Array.from({ length: 60 }, (_, i) => {
    const n = i + 1
    const range = ranges ? ranges[i] : null
    return { value: n, label: range ? `阶数${n}（${range}）` : `阶数${n}` }
  })
}

// 其他目标行已选用的词条不可再选（全局不允许重复）
function availableEffects(targets, index) {
  const taken = []
  for (let i = 0; i < targets.length; i++) {
    if (i === index) continue
    const t = targets[i]
    if (t.effects && t.effects.length) taken.push(...t.effects)
  }
  return EFFECTS.filter(e => !taken.includes(e.code))
}

function addTarget(targets, max, tier = 13) {
  if (targets.length >= max) return
  targets.push(blankTarget(tier))
}

function removeTarget(targets, index) {
  if (targets.length <= 1) return
  targets.splice(index, 1)
}

function lockedCount(gear) {
  return gear.slots.filter(s => s.locked).length
}

function lockDisabled(gear, i) {
  const slot = gear.slots[i]
  if (slot.effect === 'wd') return true
  if (i > 0 && gear.slots[0].effect === 'wd') return true
  return lockedCount(gear) >= 2 && !slot.locked
}

function onSlotEffectChange(gear, i) {
  const slot = gear.slots[i]
  if (slot.effect === 'wd') {
    slot.tier = 0
    slot.locked = false
  } else if (!slot.tier || slot.tier < 1 || slot.tier > 15) {
    slot.tier = 1
  }
  if (i === 0 && slot.effect === 'wd') {
    gear.slots[1] = blankSlot()
    gear.slots[2] = blankSlot()
  }
}

function slotToken(slot) {
  return `${slot.locked ? 1 : 0}${slot.effect}${slot.effect === 'wd' ? 0 : slot.tier}`
}

function gearToken(gear) {
  return gear.slots.map(slotToken).join(',')
}

// 目标 token：多选词条代号直接拼接 + 阶数，如 bsbj11
function targetToken(t) {
  if (!t.effects || !t.effects.length) return ''
  return `${t.effects.join('')}${t.tier}`
}

const singleCurrentPreview = computed(() => gearToken(singleGear.value))
const singleTargetPreview = computed(() =>
  singleTargets.value.filter(t => t.effects && t.effects.length).map(targetToken).join(',')
)
const characterCurrentLines = computed(() =>
  characterGears.value.map(gearToken)
)
const characterTargetPreview = computed(() =>
  characterTargets.value.filter(t => t.effects && t.effects.length).map(targetToken).join(',')
)

/* ==================== 校验 ==================== */

function validateLocks(gear, gearNo) {
  if (lockedCount(gear) > 2) {
    return `装备${gearNo}最多只能锁定 2 个栏位。`
  }
  return null
}

function validateSingle() {
  for (const gear of [singleGear.value]) {
    const err = validateLocks(gear, 1)
    if (err) return err
  }
  return validateTargets(singleTargets.value, 3, 15)
}

function validateCharacter() {
  for (let g = 0; g < 4; g++) {
    const err = validateLocks(characterGears.value[g], g + 1)
    if (err) return err
  }
  return validateTargets(characterTargets.value, 5, 60)
}

function validateTargets(targets, max, maxTier) {
  const list = targets.filter(t => t.effects && t.effects.length)
  if (!list.length) return '请至少选择 1 个目标词条。'
  if (list.length > max) return `目标词条最多允许选择 ${max} 个。`

  const seen = new Set()
  for (const t of list) {
    // 同一行内不应有重复（el-select 已防），全局不允许重复
    for (const code of t.effects) {
      if (seen.has(code)) {
        return `词条「${EFFECT_NAME[code]}」在多个目标中重复，所有词条不允许重复。`
      }
      seen.add(code)
    }
    if (!Number.isInteger(t.tier) || t.tier < 1 || t.tier > maxTier) {
      return `目标词条「${t.effects.map(c => EFFECT_NAME[c]).join('或')}」的阶数需在 1~${maxTier} 之间。`
    }
  }

  if (maxTier === 60) {
    const sum = list.reduce((s, t) => s + t.tier, 0)
    if (sum > 180) return `全部目标词条总阶数为 ${sum}，超过上限 180。`
    const slots = list.reduce((s, t) => s + Math.ceil(t.tier / 15), 0)
    if (slots > 12) {
      return `按单栏最高 15 阶计算，共需要 ${slots} 个词条栏位，超过四件装备合计 12 栏。`
    }
  }

  return null
}

/* ==================== 计算 ==================== */

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/affix.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = handleWorkerMessage
  worker.onerror = (e) => {
    stopElapsed()
    computing.value = false
    errorMsg.value = '计算进程异常：' + (e.message || (e.filename ? e.filename + ':' + (e.lineno || 0) : '未知错误'))
    worker.terminate()
    worker = null
  }
  return worker
}

function handleWorkerMessage(e) {
  const msg = e.data
  if (!msg) return

  // 对比变更请求
  const cmp = pendingCompare.get(msg.id)
  if (cmp) {
    if (msg.progress) {
      if (msg.id === currentCompareReqId) {
        compareProgress.value = formatProgress(msg.progress)
      }
      return
    }
    pendingCompare.delete(msg.id)
    if (msg.ok) cmp.resolve(msg.result)
    else cmp.reject(new Error(msg.error))
    return
  }

  if (msg.id !== requestId) return

  if (msg.progress) {
    progressText.value = formatProgress(msg.progress)
    return
  }

  stopElapsed()
  computing.value = false
  if (msg.ok) {
    result.value = { ...msg.result, mode: resultMode.value }
    errorMsg.value = ''
  } else {
    result.value = null
    errorMsg.value = translateCodes(msg.error || '计算失败，请检查输入。')
  }
}

function formatProgress(info) {
  const phase = info.phase || ''
  const mode = phase.includes('key') ? '允许秘钥' : '全石头'
  if (phase === 'compare') {
    return '正在对比两种分配方案，请稍候…'
  }
  if (phase.startsWith('gear')) {
    return `正在求解装备${info.gear ?? '?'}/${info.total ?? 4}…`
  }
  if (phase.startsWith('build')) {
    return `构建状态空间（${mode}）… 已展开 ${info.expanded ?? 0} 个状态`
  }
  if (phase.startsWith('value')) {
    return `价值迭代（${mode}）第 ${info.iteration ?? '?'} 轮…`
  }
  return JSON.stringify(info)
}

function startElapsed() {
  elapsed.value = 0
  stopElapsed()
  elapsedTimer = setInterval(() => elapsed.value++, 1000)
}

function stopElapsed() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

function requestCompute(payload) {
  if (computing.value) cancelCompute()

  result.value = null
  errorMsg.value = ''
  computing.value = true
  resultMode.value = payload.type
  progressText.value = payload.type === 'character' ? '准备中…' : '正在计算最优策略…'

  requestId += 1
  const id = requestId
  startElapsed()
  ensureWorker().postMessage({
    id,
    type: payload.type,
    current: payload.current,
    target: payload.target,
    options: { p: keyP.value, usePrecise: usePrecise.value },
  })
}

function computeSingle() {
  const err = validateSingle()
  if (err) {
    ElMessage.error(err)
    return
  }
  lastSingleSig = singleSig()
  requestCompute({
    type: 'single',
    current: singleCurrentPreview.value,
    target: singleTargetPreview.value,
  })
}

function computeCharacter() {
  const err = validateCharacter()
  if (err) {
    ElMessage.error(err)
    return
  }
  lastCharSig = charSig()
  requestCompute({
    type: 'character',
    current: characterCurrentLines.value.join('/'),
    target: characterTargetPreview.value,
  })
}

function cancelCompute() {
  stopElapsed()
  computing.value = false
  progressText.value = ''
  if (worker) {
    worker.terminate()
    worker = null
  }
}

/* ==================== 对比变更 ==================== */

function singleSig() {
  return singleCurrentPreview.value + '||' + singleTargetPreview.value
}

function charSig() {
  return characterCurrentLines.value.join('/') + '||' + characterTargetPreview.value
}

function openSingleCompare() {
  singleCompareOpen.value = true
  singleCompareSlots.value = singleGear.value.slots.map(s => ({ ...s }))
  singleCompareResult.value = null
}

function openCharCompare() {
  charCompareOpen.value = true
  syncCharCompareSlots()
  charCompareResult.value = null
}

function syncCharCompareSlots() {
  charCompareSlots.value = characterGears.value[charCompareGear.value].slots.map(s => ({ ...s }))
}

function onCharCompareGearChange() {
  syncCharCompareSlots()
  charCompareResult.value = null
}

function onCompareSlotChange(list, i) {
  onSlotEffectChange({ slots: list }, i)
}

function runCompare(type, current, target) {
  return new Promise((resolve, reject) => {
    const id = ++compareReqId
    currentCompareReqId = id
    pendingCompare.set(id, { resolve, reject })
    ensureWorker().postMessage({
      id,
      type,
      current,
      target,
      options: { p: keyP.value, usePrecise: usePrecise.value },
    })
  })
}

async function computeSingleCompare() {
  const target = singleTargetPreview.value
  if (!target) {
    ElMessage.error('请先选择目标词条。')
    return
  }
  compareLoading.value = true
  compareMode.value = 'single'
  compareProgress.value = ''
  try {
    const newCurrent = singleCompareSlots.value.map(slotToken).join(',')
    let baseCost = null
    if (result.value && result.value.mode === 'single' && lastSingleSig === singleSig()) {
      baseCost = result.value.cost
    } else {
      compareProgress.value = '正在计算变更前期望…'
      const base = await runCompare('single', singleCurrentPreview.value, target)
      baseCost = base.cost
    }
    compareProgress.value = '正在计算变更后期望…'
    const next = await runCompare('single', newCurrent, target)
    singleCompareResult.value = buildCompareResult(baseCost, next.cost)
  } catch (e) {
    ElMessage.error('对比计算失败：' + translateCodes(e && e.message ? e.message : String(e)))
    singleCompareResult.value = null
  } finally {
    compareLoading.value = false
    compareProgress.value = ''
  }
}

async function computeCharCompare() {
  const target = characterTargetPreview.value
  if (!target) {
    ElMessage.error('请先选择目标词条。')
    return
  }
  compareLoading.value = true
  compareMode.value = 'character'
  compareProgress.value = ''
  try {
    const newCurrent = characterGears.value
      .map((g, gi) => (gi === charCompareGear.value ? charCompareSlots.value.map(slotToken).join(',') : gearToken(g)))
      .join('/')
    let baseCost = null
    if (result.value && result.value.mode === 'character' && lastCharSig === charSig()) {
      baseCost = result.value.cost
    } else {
      compareProgress.value = '正在计算变更前期望…'
      const base = await runCompare('character', characterCurrentLines.value.join('/'), target)
      baseCost = base.cost
    }
    compareProgress.value = '正在计算变更后期望…'
    const next = await runCompare('character', newCurrent, target)
    charCompareResult.value = buildCompareResult(baseCost, next.cost)
  } catch (e) {
    ElMessage.error('对比计算失败：' + translateCodes(e && e.message ? e.message : String(e)))
    charCompareResult.value = null
  } finally {
    compareLoading.value = false
    compareProgress.value = ''
  }
}

function applySingleCompare() {
  singleGear.value.slots = singleCompareSlots.value.map(s => ({ ...s }))
  singleCompareOpen.value = false
  singleCompareResult.value = null
  result.value = null
  ElMessage.success('已替换原装备词条，可重新开始计算。')
}

function applyCharCompare() {
  const gear = characterGears.value[charCompareGear.value]
  gear.slots = charCompareSlots.value.map(s => ({ ...s }))
  charCompareOpen.value = false
  charCompareResult.value = null
  result.value = null
  ElMessage.success(`已替换装备${gearNames[charCompareGear.value]}的词条，可重新开始计算。`)
}

function parseCostParts(c) {
  const m = String(c || '').match(/^([\d.]+)\/([\d.]+)-([\d.]+)$/)
  if (!m) return null
  return { allStone: parseFloat(m[1]), keyStone: parseFloat(m[2]), keys: parseFloat(m[3]) }
}

function buildCompareResult(baseCost, newCost) {
  const b = parseCostParts(baseCost)
  const n = parseCostParts(newCost)
  if (!b || !n) {
    return {
      baseCost,
      newCost,
      deltaStone: NaN,
      deltaKeyStone: NaN,
      deltaKeys: NaN,
      verdictText: '无法比较',
      verdictClass: '',
    }
  }
  const deltaStone = n.allStone - b.allStone
  const deltaKeyStone = n.keyStone - b.keyStone
  const deltaKeys = n.keys - b.keys
  let verdictText = '持平'
  let verdictClass = ''
  if (deltaStone < -1e-9) {
    verdictText = '变更后更优'
    verdictClass = 'better'
  } else if (deltaStone > 1e-9) {
    verdictText = '变更后更差'
    verdictClass = 'worse'
  }
  return { baseCost, newCost, deltaStone, deltaKeyStone, deltaKeys, verdictText, verdictClass }
}

function fmtNum(x) {
  if (!Number.isFinite(x)) return '-'
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x))
  return x.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function diffClass(x) {
  if (!Number.isFinite(x)) return ''
  return x <= 0 ? 'diff-good' : 'diff-bad'
}

/* ==================== 结果展示 ==================== */

const isDone = computed(() => {
  if (!result.value) return false
  return !result.value.action || result.value.action === 'd0'
})

const costParts = computed(() => {
  const s = String(result.value?.cost || '')
  const m = s.match(/^([\d.]+)\/([\d.]+)-([\d.]+)$/)
  if (!m) return { allStone: s || '-', keyStone: '-', keys: '-' }
  return { allStone: m[1], keyStone: m[2], keys: m[3] }
})

/* ==================== 期望攒资源时间 ==================== */

// 每日资源产出：国服 / 国际服
const DAILY_RATE = {
  cn: { stone: 3.402, key: 18 },
  int: { stone: 4.21, key: 18 },
}

const expectedDays = computed(() => {
  const r = result.value
  if (!r || !r.expected) return null
  const allStone = Number(r.expected.stoneOnly)
  const keyStone = Number(r.expected.withKeysStone)
  const keys = Number(r.expected.withKeysKeys)
  if (!Number.isFinite(allStone) || !Number.isFinite(keyStone) || !Number.isFinite(keys)) return null
  // 已经达标（全部为 0）时不展示
  if (allStone <= 1e-9 && keyStone <= 1e-9 && keys <= 1e-9) return null
  const calc = (rate) => ({
    // 秘钥策略：石头与秘钥并行攒，取较慢者
    key: Math.max(keyStone / rate.stone, keys / rate.key),
    // 全石头策略：只攒石头
    stone: allStone / rate.stone,
  })
  return {
    cn: calc(DAILY_RATE.cn),
    int: calc(DAILY_RATE.int),
  }
})

function fmtDays(d) {
  if (!Number.isFinite(d)) return '-'
  return '约 ' + d.toFixed(1).replace(/\.0$/, '') + ' 天'
}

// 单装备：把“先免费解锁”合并进策略列表的第一步
const singleKeyTokens = computed(() => {
  const r = result.value
  if (!r || r.mode !== 'single') return []
  return [
    ...(r.preUnlock || []).map(n => 'u' + n),
    ...actionTokens(r.action),
  ]
})

const singleStoneTokens = computed(() => {
  const r = result.value
  if (!r || r.mode !== 'single') return []
  return [
    ...(r.stoneOnlyPreUnlock || []).map(n => 'u' + n),
    ...actionTokens(r.stoneOnlyAction),
  ]
})

function actionTokens(actionStr) {
  if (!actionStr) return []
  return String(actionStr).split(',').map(s => s.trim()).filter(Boolean)
}

function translateToken(tok, mode, isStone = false) {
  const num = ['', '一', '二', '三', '四']
  if (tok === 'd0') return '已经达标，无需操作'

  if (mode === 'character') {
    let m = tok.match(/^([1-4])(s|u|S)([1-3])$/)
    if (m) {
      if (m[2] === 'u') return `免费解锁第${num[+m[1]]}件装备第${m[3]}栏`
      if (m[2] === 'S') return `锁定第${num[+m[1]]}件装备第${m[3]}栏（永久石头锁）`
      return `锁定第${num[+m[1]]}件装备第${m[3]}栏（${isStone ? '永久石头锁' : '一次性秘钥锁'}）`
    }
    m = tok.match(/^([1-4])(xg|sz)$/)
    if (m) {
      return `第${num[+m[1]]}件装备${m[2] === 'xg' ? '变更效果' : '变更数值'}`
    }
    return tok
  }

  let m = tok.match(/^([suS])([1-3])$/)
  if (m) {
    if (m[1] === 'u') return `免费解锁第${m[2]}栏`
    if (m[1] === 'S') return `锁定第${m[2]}栏（永久石头锁）`
    return `锁定第${m[2]}栏（${isStone ? '永久石头锁' : '一次性秘钥锁'}）`
  }
  if (tok === 'xg') return '变更效果（重新随机未锁定栏位的词条效果）'
  if (tok === 'sz') return '变更数值（重新随机未锁定栏位的词条数值）'
  return tok
}

/* ==================== 背景与生命周期 ==================== */

const vantaRef = ref()
let vantaEffect

onMounted(() => {
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
    spacing: 16.0,
  })
})

onUnmounted(() => {
  if (vantaEffect) vantaEffect.destroy()
  stopElapsed()
  if (worker) {
    worker.terminate()
    worker = null
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
  padding-bottom: 30px;
}

h1 {
  text-align: center;
  margin: 0 0 20px;
  padding-top: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.main-tabs {
  border-radius: 12px;
  overflow: hidden;
}

.panel {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 10px;
  padding: 18px 20px;
  margin-bottom: 18px;
}

.panel-title {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1fa2ff;
}

.panel-note {
  margin: 0 0 14px;
  color: #666;
  font-size: 13px;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.slot-label {
  min-width: 52px;
  font-weight: bold;
  color: #333;
}

.add-row {
  margin-top: 12px;
}

.gear-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
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

.action-panel {
  text-align: center;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.computing-tip {
  margin-top: 12px;
  color: #3553ff;
  font-weight: bold;
}

.error-alert {
  margin-top: 14px;
  text-align: left;
}

.compare-panel {
  border: 1px solid #e3ecf7;
  background: #fbfdff;
}

.compare-actions {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.compare-result {
  margin-top: 14px;
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 8px;
  padding: 10px 14px;
  line-height: 1.9;
}

.compare-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.compare-label {
  min-width: 110px;
  color: #666;
}

.compare-cost {
  font-weight: bold;
  color: #1fa2ff;
}

.compare-verdict {
  margin-left: 8px;
  font-weight: bold;
  font-size: 13px;
  padding: 1px 10px;
  border-radius: 10px;
}

.compare-verdict.better {
  color: #529b2e;
  background: #f0f9eb;
}

.compare-verdict.worse {
  color: #f56c6c;
  background: #fef0f0;
}

.diff-good {
  color: #67c23a !important;
  font-weight: bold;
}

.diff-bad {
  color: #f56c6c !important;
  font-weight: bold;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border: 2px solid #3553ff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  vertical-align: -2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.preview-line {
  margin-top: 14px;
  text-align: left;
  background: #f4f6fa;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.8;
}

.preview-label {
  color: #888;
  font-weight: bold;
}

.preview-block {
  display: block;
}

code {
  color: #1fa2ff;
  font-family: Consolas, Monaco, monospace;
}

.rule-note {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fff7e6;
  border-left: 4px solid #ffb800;
  border-radius: 6px;
  color: #8a6100;
  font-size: 13px;
  line-height: 1.7;
}

.algorithm-note {
  margin-top: 12px;
  padding: 10px 12px;
  background: #eef6ff;
  border-left: 4px solid #1fa2ff;
  border-radius: 6px;
  color: #35537a;
  font-size: 13px;
  line-height: 1.7;
}

.p-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.p-value-note {
  color: #888;
  font-size: 13px;
}

.time-section {
  margin-top: 18px;
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 8px;
  padding: 12px 14px;
}

.time-section h4 {
  margin: 0 0 10px;
  color: #333;
}

.time-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 4px 0;
  border-bottom: 1px dashed #e3ecf7;
}

.time-row:last-of-type {
  border-bottom: none;
}

.time-server {
  color: #666;
  font-size: 13px;
  flex: 1 1 220px;
}

.time-val {
  color: #1fa2ff;
  font-weight: bold;
  font-size: 14px;
}

.result-panel {
  background: #fbfdff;
  border: 1px solid #e3ecf7;
}

.done-banner {
  padding: 16px;
  text-align: center;
  background: #f0f9eb;
  border: 1px solid #b3e19d;
  border-radius: 8px;
  color: #529b2e;
  font-weight: bold;
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin: 14px 0;
}

.cost-item {
  text-align: center;
  background: #fff;
  border: 1px solid #e3ecf7;
  border-radius: 10px;
  padding: 14px 8px;
}

.cost-num {
  font-size: 26px;
  font-weight: bold;
  color: #1fa2ff;
}

.cost-label {
  margin-top: 6px;
  color: #888;
  font-size: 13px;
}

.action-section {
  margin-top: 16px;
}

.action-section h4 {
  margin: 0 0 8px;
  color: #333;
}

.action-list {
  margin: 0;
  padding-left: 22px;
  line-height: 2;
}

.note {
  margin: 8px 0 0;
  color: #999;
  font-size: 12px;
}

.meta-line {
  margin-top: 10px;
  color: #666;
  font-size: 13px;
}

.gear-detail {
  margin-top: 14px;
  background: #f7faff;
  border: 1px solid #e3ecf7;
  border-radius: 8px;
  padding: 10px 14px;
}

.gear-detail h4 {
  margin: 0 0 8px;
  color: #333;
}

.gear-detail-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  padding: 4px 0;
  border-bottom: 1px dashed #e3ecf7;
}

.gear-detail-row:last-child {
  border-bottom: none;
}

.detail-gear {
  font-weight: bold;
  color: #3553ff;
  min-width: 64px;
}

.detail-sub {
  color: #333;
}

.detail-cost {
  margin-left: auto;
  color: #1fa2ff;
  font-weight: bold;
}

.footer-section {
  background: linear-gradient(145deg, #fff, #f8fafc);
  border-radius: 20px;
  margin: 80px 15px 15px 15px;
  padding: 20px;
  box-shadow: 0 15px 35px #00000014;
  border: 1px solid rgba(255, 255, 255, 0.8);
  position: relative;
  overflow: hidden;
}

.footer-section:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #1fa2ff, #3553ff);
}

.footer-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 30px;
  align-items: start;
}

.instructions h3,
.contact-info h3 {
  font-size: 1.2em;
  font-weight: 700;
  color: #000;
  margin-bottom: 15px;
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 8px;
}

.instruction-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

.instruction-item {
  padding: 15px;
  background: #667eea0d;
  border-radius: 12px;
  border-left: 4px solid #1fa2ff;
  transition: all 0.3s ease;
}

.instruction-item:hover {
  background: #667eea1a;
  transform: translate(5px);
}

.instruction-text {
  color: #000;
  line-height: 1.6;
  font-weight: 700;
}

.contact-platforms {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.contact-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: #667eea0d;
  border-radius: 10px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  transition: all 0.3s ease;
}

.contact-item:hover {
  background: #667eea1a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px #667eea33;
}

.contact-platform {
  font-weight: 700;
  color: #1fa2ff;
  font-size: 1.1em;
}

.contact-id {
  font-weight: 600;
  color: #000;
  font-size: 1.1em;
}

@media (max-width: 768px) {
  .gear-grid {
    grid-template-columns: 1fr;
  }

  .cost-grid {
    grid-template-columns: 1fr;
  }

  .detail-cost {
    margin-left: 0;
  }

  .slot-row {
    gap: 8px;
  }

  .slot-row :deep(.el-select) {
    width: 100% !important;
    flex: 1 1 100%;
  }

  .footer-content,
  .contact-platforms,
  .instruction-grid {
    grid-template-columns: 1fr;
  }
}
</style>
