import { describe, expect, it } from 'vitest'
import type { ActiveEffect, FaceId, GameState } from '../../types/game'
import { createFood } from './food'
import { createInitialState, neutralInput, updateGame } from './gameState'
import { getBarrierStates } from './levels'
import { getSnakeSegments } from './movement'

describe('single-face snake engine', () => {
  it('initializes a playable game state with snake history and food', () => {
    const state = createInitialState()

    expect(state.status).toBe('playing')
    expect(state.snake.trail.length).toBeGreaterThan(1)
    expect(state.foods[0].position).toBeDefined()
  })

  it('moves forward using delta time', () => {
    const state = createInitialState()
    const next = updateGame(state, neutralInput, 0.5)

    expect(next.snake.head.x).toBeGreaterThan(state.snake.head.x)
    expect(next.snake.head.y).toBeCloseTo(state.snake.head.y)
  })

  it('turns with A and D input and boosts with W input', () => {
    const state = createInitialState()
    const turnedLeft = updateGame(state, { turnLeft: true, turnRight: false, boost: false }, 0.2)
    const boosted = updateGame(state, { turnLeft: false, turnRight: false, boost: true }, 0.2)

    expect(turnedLeft.snake.heading).toBeLessThan(state.snake.heading)
    expect(boosted.snake.speed).toBeGreaterThan(state.snake.speed)
    expect(boosted.snake.head.x).toBeGreaterThan(turnedLeft.snake.head.x)
  })

  it('samples body segments from the head history', () => {
    let state = createInitialState()

    state = updateGame(state, neutralInput, 0.3)
    state = updateGame(state, neutralInput, 0.3)

    const segments = getSnakeSegments(state.snake, state.config.segmentSpacing)

    expect(segments.length).toBeGreaterThan(4)
    expect(segments[0].x).toBeCloseTo(state.snake.head.x)
    expect(segments[segments.length - 1].x).toBeLessThan(state.snake.head.x)
  })

  it('eats normal food and grows the snake', () => {
    const state = createInitialState()
    const lengthBefore = state.snake.length
    const food = createFood({ ...state.snake.head }, state.config, 'normal', state.snake.faceId)
    const next = updateGame({ ...state, foods: [food] }, neutralInput, 0.016, () => 0.8)

    expect(next.foodsEaten).toBe(1)
    expect(next.snake.length).toBeCloseTo(lengthBefore + state.config.foodGrowth)
    expect(next.foods.some((entry) => entry.id === food.id)).toBe(false)
  })

  it('detects self collision while ignoring the first 20 percent behind the head', () => {
    const state = createInitialState({ initialLength: 10 })
    const safeState: GameState = {
      ...state,
      snake: {
        ...state.snake,
        head: { x: 0, y: 0 },
        trail: [
          { x: 0, y: 0, distance: 0 },
          { x: 0.05, y: 0, distance: 1 },
          { x: 0.05, y: 0, distance: 1.9 },
        ],
      },
    }
    const failedState: GameState = {
      ...safeState,
      snake: {
        ...safeState.snake,
        trail: [
          { x: 0, y: 0, distance: 0 },
          { x: 2, y: 0, distance: 1 },
          { x: 0.05, y: 0, distance: 2.1 },
        ],
      },
    }

    expect(updateGame(safeState, neutralInput, 0).status).toBe('playing')
    expect(updateGame(failedState, neutralInput, 0).status).toBe('failed')
  })
})

describe('food effects', () => {
  it('grows by feast food at three times normal growth', () => {
    const state = createInitialState()
    const food = createFood({ ...state.snake.head }, state.config, 'feast', state.snake.faceId)
    const next = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.7)

    expect(next.snake.length).toBeCloseTo(state.snake.length + state.config.foodGrowth * 3)
  })

  it('keeps speed effects active for ten seconds', () => {
    const state = createInitialState()
    const food = createFood({ ...state.snake.head }, state.config, 'speedUp', state.snake.faceId)
    const boostedState = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.7)
    const movingBoosted = updateGame(boostedState, neutralInput, 0.1, () => 0.7)
    const expired = updateGame(movingBoosted, neutralInput, 10.1, () => 0.7)

    expect(boostedState.activeEffects.some((effect) => effect.type === 'speedUp')).toBe(true)
    expect(movingBoosted.snake.speed).toBeCloseTo(state.config.baseSpeed * 1.5)
    expect(expired.activeEffects.some((effect) => effect.type === 'speedUp')).toBe(false)
    expect(expired.snake.speed).toBeCloseTo(state.config.baseSpeed)
  })

  it('keeps slow effects active for ten seconds', () => {
    const state = createInitialState()
    const food = createFood({ ...state.snake.head }, state.config, 'slowDown', state.snake.faceId)
    const slowedState = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.7)
    const movingSlowed = updateGame(slowedState, neutralInput, 0.1, () => 0.7)
    const expired = updateGame(movingSlowed, neutralInput, 10.1, () => 0.7)

    expect(slowedState.activeEffects.some((effect) => effect.type === 'slowDown')).toBe(true)
    expect(movingSlowed.snake.speed).toBeCloseTo(state.config.baseSpeed * 0.5)
    expect(expired.activeEffects.some((effect) => effect.type === 'slowDown')).toBe(false)
    expect(expired.snake.speed).toBeCloseTo(state.config.baseSpeed)
  })

  it('expires temporary food after five seconds', () => {
    const state = createInitialState()
    const temporaryFood = createFood(
      { x: 3, y: 3 },
      state.config,
      'normal',
      state.snake.faceId,
      { temporary: true, expiresAt: 5 },
    )
    const next = updateGame({ ...state, foods: [temporaryFood], elapsed: 0 }, neutralInput, 5.1, () => 0.7)

    expect(next.foods.some((food) => food.id === temporaryFood.id)).toBe(false)
  })

  it('does not open completed faces during super potion', () => {
    const state = createInitialState()
    const activeEffects: ActiveEffect[] = [{ type: 'superPotion', startedAt: 0, expiresAt: 10 }]
    const faces = {
      ...state.faces,
      right: 'completed',
      top: 'available',
    } as Record<FaceId, GameState['faces'][FaceId]>
    const barriers = getBarrierStates({ ...state, faces, activeEffects })

    expect(barriers.find((barrier) => barrier.neighbor === 'right')?.open).toBe(false)
    expect(barriers.find((barrier) => barrier.neighbor === 'top')?.open).toBe(true)
  })

  it('spawns super potion temporary food without super potions and then expires it', () => {
    const state = createInitialState()
    const food = createFood({ ...state.snake.head }, state.config, 'superPotion', state.snake.faceId)
    const active = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.1)
    const spawned = updateGame(active, neutralInput, 0.1, () => 0.1)
    const temporaryFoods = spawned.foods.filter((entry) => entry.temporary)
    const expired = updateGame(spawned, neutralInput, 5.1, () => 0.1)

    expect(temporaryFoods.length).toBeGreaterThan(0)
    expect(temporaryFoods.every((entry) => entry.type !== 'superPotion')).toBe(true)
    expect(expired.foods.some((entry) => entry.temporary && temporaryFoods.some((food) => food.id === entry.id))).toBe(false)
  })

  it('keeps super potion temporary food bounded during sustained spawning', () => {
    const state = createInitialState({ baseSpeed: 0, superPotionTempFoodInterval: 0.2 })
    const food = createFood({ ...state.snake.head }, state.config, 'superPotion', state.snake.faceId)
    let running = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.1)

    for (let step = 0; step < 50; step += 1) {
      running = updateGame(running, neutralInput, 0.2, () => 0.1)
    }

    const temporaryFoodCount = running.foods.filter((entry) => entry.temporary).length
    const cleared = updateGame(running, neutralInput, 16, () => 0.1)

    expect(temporaryFoodCount).toBeGreaterThan(0)
    expect(temporaryFoodCount).toBeLessThanOrEqual(160)
    expect(cleared.foods.some((entry) => entry.temporary)).toBe(false)
  })

  it('uses rainbow shield once to cancel a fatal completed-face collision', () => {
    const state = createInitialState()
    const faces = { ...state.faces, right: 'completed' as const }
    const shielded: GameState = {
      ...state,
      faces,
      activeEffects: [{ type: 'rainbowShield', startedAt: 0, expiresAt: 8 }],
      snake: {
        ...state.snake,
        head: { x: state.config.planeSize / 2 - state.config.snakeRadius - 0.02, y: 0 },
        heading: 0,
        length: state.targetLength,
      },
    }
    const firstHit = updateGame(shielded, neutralInput, 0.02)
    const secondHit = updateGame(
      {
        ...firstHit,
        snake: {
          ...firstHit.snake,
          head: { x: state.config.planeSize / 2 - state.config.snakeRadius - 0.02, y: 0 },
          heading: 0,
        },
      },
      neutralInput,
      0.02,
    )

    expect(firstHit.status).toBe('playing')
    expect(firstHit.activeEffects.some((effect) => effect.type === 'rainbowShield')).toBe(false)
    expect(secondHit.status).toBe('failed')
  })

  it('cluster food bursts into three to five non-cluster foods', () => {
    const state = createInitialState()
    const food = createFood({ ...state.snake.head }, state.config, 'cluster', state.snake.faceId)
    const next = updateGame({ ...state, foods: [food] }, neutralInput, 0, () => 0.1)
    const spawnedClusterFoods = next.foods.filter((entry) => entry.spawnedBy === 'cluster')

    expect(spawnedClusterFoods.length).toBeGreaterThanOrEqual(3)
    expect(spawnedClusterFoods.length).toBeLessThanOrEqual(5)
    expect(spawnedClusterFoods.every((entry) => entry.type !== 'cluster')).toBe(true)
  })
})
