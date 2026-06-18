<script setup lang="ts">
import { gameSettings, resetGameSettings } from '../game/settings'

defineProps<{
  showStart?: boolean
  showClose?: boolean
}>()

const emit = defineEmits<{
  start: []
  close: []
}>()

const polyhedronOptions = [
  { value: 'sphere', label: '低多边形球面 · 无尽模式', disabled: false },
] as const

function submitSettings(): void {
  emit('start')
}
</script>

<template>
  <div class="settings-modal" role="presentation">
    <form class="settings-panel" aria-label="游戏设置" @submit.prevent="submitSettings">
      <header class="settings-header">
        <div>
          <p>3D 球面贪吃蛇</p>
          <h1>游戏设置</h1>
        </div>
        <button v-if="showClose" class="icon-button" type="button" aria-label="关闭设置" @click="emit('close')">
          ×
        </button>
      </header>

      <section class="settings-section" aria-label="关卡设置">
        <label class="field">
          <span>地图类型</span>
          <select v-model="gameSettings.polyhedronType" aria-label="地图类型">
            <option
              v-for="option in polyhedronOptions"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>初始速度</span>
          <input v-model.number="gameSettings.initialSpeed" aria-label="初始速度" type="number" min="1.5" max="7" step="0.1">
        </label>

        <label class="field">
          <span>转向速度</span>
          <input v-model.number="gameSettings.turnSpeed" aria-label="转向速度" type="number" min="1" max="8" step="any">
        </label>

        <label class="field">
          <span>初始蛇长度</span>
          <input v-model.number="gameSettings.initialSnakeLength" aria-label="初始蛇长度" type="number" min="2" max="12" step="0.5">
        </label>

        <label class="field">
          <span>食物生成频率</span>
          <input v-model.number="gameSettings.foodSpawnInterval" aria-label="食物生成频率" type="number" min="0.3" max="5" step="0.1">
        </label>

        <label class="field">
          <span>药水临时食物频率</span>
          <input v-model.number="gameSettings.superPotionTempFoodInterval" aria-label="药水临时食物频率" type="number" min="0.2" max="3" step="0.1">
        </label>
      </section>

      <section class="settings-toggles" aria-label="偏好设置">
        <label class="toggle-field">
          <input v-model="gameSettings.showDebugInfo" type="checkbox">
          <span>显示调试信息</span>
        </label>

        <label class="toggle-field">
          <input v-model="gameSettings.soundEnabled" type="checkbox">
          <span>音效</span>
        </label>
      </section>

      <div class="settings-actions">
        <button v-if="showStart" type="submit">开始游戏</button>
        <button v-if="showClose" type="button" @click="emit('start')">应用并重新开始</button>
        <button class="secondary-button" type="button" @click="resetGameSettings">恢复默认</button>
      </div>
    </form>
  </div>
</template>
