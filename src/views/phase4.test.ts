// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import GameView from './GameView.vue'
import SettingsView from './SettingsView.vue'
import { gameSettings, resetGameSettings } from '../game/settings'

vi.mock('../game/render/sphereScene', () => ({
  SphereGameScene: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'settings', component: SettingsView },
      { path: '/game', name: 'game', component: GameView },
    ],
  })
}

describe('Phase 4 UI flow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      })),
    )
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    resetGameSettings()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetGameSettings()
  })

  it('renders the low-poly endless sphere settings', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(SettingsView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('游戏设置')
    expect(wrapper.find('.settings-modal').exists()).toBe(true)
    expect(wrapper.get('select').element.value).toBe('sphere')
    expect(wrapper.text()).toContain('低多边形球面')
    expect(wrapper.text()).toContain('无尽模式')
  })

  it('starts the game route from settings', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mount(SettingsView, {
      global: { plugins: [router] },
    })
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('game')
  })

  it('uses settings when creating a new game', async () => {
    gameSettings.initialSpeed = 4.6
    gameSettings.initialSnakeLength = 6
    gameSettings.initialLengthIncrement = 2
    gameSettings.showDebugInfo = true
    const router = createTestRouter()
    await router.push('/game')
    await router.isReady()

    const wrapper = mount(GameView, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('当前长度')
    expect(wrapper.text()).toContain('6.0')
    expect(wrapper.text()).toContain('速度')
    expect(wrapper.text()).toContain('4.6')
    expect(wrapper.text()).toContain('调试')
  })

  it('keeps endless-mode HUD labels consistent with the initial game state', async () => {
    const router = createTestRouter()
    await router.push('/game')
    await router.isReady()

    const wrapper = mount(GameView, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('得分')
    expect(wrapper.text()).toContain('最高分')
    expect(wrapper.text()).toContain('存活时间')
    expect(wrapper.text()).toContain('吃掉食物')
    expect(wrapper.text()).toContain('效果')
    expect(wrapper.text()).toContain('无')
  })

  it('opens settings as an in-game modal and applies settings by restarting', async () => {
    const router = createTestRouter()
    await router.push('/game')
    await router.isReady()

    const wrapper = mount(GameView, {
      global: { plugins: [router] },
    })
    await wrapper.get('button.secondary-button').trigger('click')

    expect(wrapper.find('.settings-modal').exists()).toBe(true)
    expect(wrapper.text()).toContain('暂停')

    await wrapper.get('input[aria-label="初始速度"]').setValue(4.2)

    const applyButton = wrapper.findAll('button').find((button) => button.text() === '应用并重新开始')
    expect(applyButton).toBeDefined()
    await applyButton?.trigger('click')
    expect(wrapper.find('.settings-modal').exists()).toBe(false)
    expect(wrapper.text()).toContain('进行中')
    expect(wrapper.text()).toContain('4.2')
  })
})
