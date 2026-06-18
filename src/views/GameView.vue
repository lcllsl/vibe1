<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { GameInput } from '../types/game'
import SettingsDialog from '../components/SettingsDialog.vue'
import { SphereGameScene } from '../game/render/sphereScene'
import { createSphereState, pauseSphereGame, resumeSphereGame, updateSphereGame } from '../game/sphere/sphereGame'
import type { SphereGameState } from '../game/sphere/types'
import { createSphereConfigFromSettings, gameSettings } from '../game/settings'

const stageRef = ref<HTMLElement | null>(null)
const state = ref<SphereGameState>(createSphereState(createSphereConfigFromSettings(gameSettings)))
const pressedCodes = reactive(new Set<string>())
const settingsOpen = ref(false)
const settingsPausedGame = ref(false)
const highScore = ref(readHighScore())

let scene: SphereGameScene | undefined
let animationFrame = 0
let lastTime = performance.now()

const input = computed<GameInput>(() => ({
  turnLeft: pressedCodes.has('KeyA'),
  turnRight: pressedCodes.has('KeyD'),
  boost: pressedCodes.has('KeyW'),
}))
const statusText = computed(() => state.value.status === 'failed' ? '失败' : state.value.status === 'paused' ? '暂停' : '进行中')
const lengthText = computed(() => state.value.snake.length.toFixed(1))
const speedText = computed(() => state.value.snake.speed.toFixed(1))
const survivalText = computed(() => formatTime(state.value.elapsed))
const activeEffectsText = computed(() => {
  if (state.value.activeEffects.length === 0) return '无'
  const labels = { speedUp: '加速', slowDown: '减速', rainbowShield: '彩虹盾', superPotion: '超级药水' }
  return state.value.activeEffects
    .map((effect) => `${labels[effect.type]} ${Math.ceil(effect.expiresAt - state.value.elapsed)}s`)
    .join(' / ')
})

function restartGame(): void {
  state.value = createSphereState(createSphereConfigFromSettings(gameSettings))
  lastTime = performance.now()
}

function openSettings(): void {
  settingsPausedGame.value = state.value.status === 'playing'
  if (settingsPausedGame.value) state.value = pauseSphereGame(state.value)
  settingsOpen.value = true
}

function closeSettings(): void {
  settingsOpen.value = false
  if (settingsPausedGame.value && state.value.status === 'paused') {
    state.value = resumeSphereGame(state.value)
    lastTime = performance.now()
  }
  settingsPausedGame.value = false
}

function applySettings(): void {
  settingsOpen.value = false
  restartGame()
}

function togglePause(): void {
  if (state.value.status === 'paused') {
    state.value = resumeSphereGame(state.value)
    lastTime = performance.now()
  } else {
    state.value = pauseSphereGame(state.value)
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (['KeyA', 'KeyD', 'KeyW', 'Space', 'Escape', 'KeyR'].includes(event.code)) event.preventDefault()
  if (event.code === 'Escape') {
    if (settingsOpen.value) closeSettings()
    else openSettings()
    return
  }
  if (event.code === 'Space') {
    togglePause()
    return
  }
  if (event.code === 'KeyR') {
    restartGame()
    return
  }
  pressedCodes.add(event.code)
}

function handleKeyUp(event: KeyboardEvent): void {
  pressedCodes.delete(event.code)
}

function loop(now: number): void {
  const deltaTime = (now - lastTime) / 1000
  lastTime = now
  state.value = updateSphereGame(state.value, input.value, deltaTime)
  if (state.value.score > highScore.value) {
    highScore.value = state.value.score
    localStorage.setItem('sphere-snake-high-score', String(highScore.value))
  }
  scene?.update(state.value)
  animationFrame = requestAnimationFrame(loop)
}

function readHighScore(): number {
  const value = Number(localStorage.getItem('sphere-snake-high-score'))
  return Number.isFinite(value) ? value : 0
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

onMounted(() => {
  if (!stageRef.value) return
  scene = new SphereGameScene(stageRef.value, state.value.config.sphereRadius)
  scene.update(state.value)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  animationFrame = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  scene?.dispose()
})
</script>

<template>
  <main class="game-shell">
    <section class="play-surface" aria-label="低多边形球面无尽贪吃蛇">
      <div ref="stageRef" class="three-stage" data-testid="three-stage" />

      <div class="hud" aria-live="polite">
        <div class="hud-stat"><span>得分</span><strong>{{ state.score }}</strong></div>
        <div class="hud-stat"><span>最高分</span><strong>{{ highScore }}</strong></div>
        <div class="hud-stat"><span>存活时间</span><strong>{{ survivalText }}</strong></div>
        <div class="hud-stat"><span>当前长度</span><strong>{{ lengthText }}</strong></div>
        <div class="hud-stat"><span>吃掉食物</span><strong>{{ state.foodsEaten }}</strong></div>
        <div class="hud-stat"><span>速度</span><strong>{{ speedText }}</strong></div>
        <div class="hud-stat"><span>状态</span><strong>{{ statusText }}</strong></div>
        <div class="hud-stat effect-stat"><span>效果</span><strong>{{ activeEffectsText }}</strong></div>
        <div v-if="gameSettings.showDebugInfo" class="hud-stat debug-stat">
          <span>调试</span><strong>{{ state.foods.length }} 食物 / 半径 {{ state.config.sphereRadius }}</strong>
        </div>
      </div>

      <div class="controls">
        <button type="button" @click="togglePause">{{ state.status === 'paused' ? '继续' : '暂停' }}</button>
        <button type="button" @click="restartGame">重新开始</button>
        <button class="secondary-button" type="button" @click="openSettings">配置</button>
      </div>

      <div v-if="state.status === 'failed'" class="failure-panel" role="alert">
        <h1>本局结束</h1>
        <p>{{ state.lastFailureReason }} · 得分 {{ state.score }} · 存活 {{ survivalText }}</p>
        <button type="button" @click="restartGame">再来一局</button>
        <button class="secondary-button" type="button" @click="openSettings">退出到设置</button>
      </div>

      <SettingsDialog v-if="settingsOpen" show-close @start="applySettings" @close="closeSettings" />
    </section>
  </main>
</template>
