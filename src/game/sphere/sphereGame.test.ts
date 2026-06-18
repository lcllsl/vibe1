import { describe, expect, it } from 'vitest'
import { createSphereState, getSphereSegments, isSphereFoodCollision, updateSphereGame } from './sphereGame'
import { cross, dot, normalize, rotateAroundAxis } from './vector'

const neutralInput = { turnLeft: false, turnRight: false, boost: false }

describe('sphere endless game', () => {
  it('keeps the snake on the unit sphere while moving', () => {
    const state = createSphereState()
    const next = updateSphereGame(state, neutralInput, 0.05)
    const length = Math.hypot(next.snake.position.x, next.snake.position.y, next.snake.position.z)

    expect(length).toBeCloseTo(1, 8)
    expect(dot(next.snake.position, next.snake.forward)).toBeCloseTo(0, 8)
  })

  it('turns left and right in opposite tangent directions', () => {
    const state = createSphereState()
    const left = updateSphereGame(state, { ...neutralInput, turnLeft: true }, 0.05)
    const right = updateSphereGame(state, { ...neutralInput, turnRight: true }, 0.05)

    expect(left.snake.forward.x).toBeLessThan(0)
    expect(right.snake.forward.x).toBeGreaterThan(0)
  })

  it('boost increases travelled speed', () => {
    const state = createSphereState()
    const normal = updateSphereGame(state, neutralInput, 0.05)
    const boosted = updateSphereGame(state, { ...neutralInput, boost: true }, 0.05)

    expect(boosted.snake.speed).toBeGreaterThan(normal.snake.speed)
  })

  it('uses a forgiving pickup radius without changing the food model size', () => {
    const state = createSphereState()
    const axis = normalize(cross(state.snake.position, state.snake.forward))
    const pickupDistance = state.snake.radius + state.config.foodRadius * 2.05
    const food = {
      ...state.foods[0],
      position: rotateAroundAxis(state.snake.position, axis, pickupDistance / state.config.sphereRadius),
    }

    expect(state.config.foodPickupRadiusMultiplier).toBe(2.2)
    expect(pickupDistance).toBeGreaterThan(state.snake.radius + state.config.foodRadius)
    expect(isSphereFoodCollision(state.snake, food, state.config)).toBe(true)
  })

  it('samples body segments from spherical trail length', () => {
    const state = createSphereState({ initialLength: 5, segmentSpacing: 0.5 })
    const segments = getSphereSegments(state.snake, state.config.segmentSpacing)

    expect(segments.length).toBeGreaterThanOrEqual(9)
    expect(segments.length).toBeLessThanOrEqual(12)
  })

  it('increases endless difficulty over survival time', () => {
    let state = createSphereState({ difficultyInterval: 1, difficultySpeedStep: 0.1 })
    for (let index = 0; index < 25; index += 1) state = updateSphereGame(state, neutralInput, 0.05)

    expect(state.snake.speed).toBeGreaterThan(state.config.baseSpeed)
  })
})
