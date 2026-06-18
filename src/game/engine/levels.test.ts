import { describe, expect, it } from 'vitest'
import type { FaceId, GameState } from '../../types/game'
import { getCrossedEdge, mapAcrossCubeEdge } from '../polyhedron/cubeTopology'
import { createInitialState, neutralInput, updateGame } from './gameState'
import { getBarrierStates, isDeadEnd } from './levels'

function readyAtEastEdge(state = createInitialState()): GameState {
  return {
    ...state,
    snake: {
      ...state.snake,
      head: { x: state.config.planeSize / 2 - state.config.snakeRadius - 0.02, y: 0 },
      heading: 0,
      length: state.targetLength,
    },
  }
}

describe('cube topology and level flow', () => {
  it('maps an east edge crossing from front to right with local position and inward heading', () => {
    const halfSize = 8.78
    const crossing = mapAcrossCubeEdge('front', 'east', { x: halfSize + 0.2, y: 2 }, 0, halfSize)

    expect(crossing.toFace).toBe('right')
    expect(crossing.position.x).toBeCloseTo(-halfSize + 0.08)
    expect(crossing.position.y).toBeCloseTo(2)
    expect(crossing.heading).toBeCloseTo(0)
  })

  it('keeps barriers closed until the target length is reached', () => {
    const state = createInitialState()
    const readyState = { ...state, snake: { ...state.snake, length: state.targetLength } }

    expect(getBarrierStates(state).every((barrier) => !barrier.open)).toBe(true)
    expect(getBarrierStates(readyState).some((barrier) => barrier.open)).toBe(true)
  })

  it('completes the previous face and enters an available neighbor through an open edge', () => {
    const state = readyAtEastEdge()
    const next = updateGame(state, neutralInput, 0.02)

    expect(next.status).toBe('playing')
    expect(next.snake.faceId).toBe('right')
    expect(next.faces.front).toBe('completed')
    expect(next.faces.right).toBe('active')
    expect(next.completedCount).toBe(1)
  })

  it('resets snake length and increments the next face initial length by one', () => {
    const state = readyAtEastEdge()
    const next = updateGame(state, neutralInput, 0.02)

    expect(next.snake.initialLength).toBe(state.snake.initialLength + state.config.initialLengthIncrement)
    expect(next.snake.length).toBe(next.snake.initialLength)
    expect(next.targetLength).toBe(next.snake.initialLength + next.config.targetLengthGrowth)
  })

  it('stops movement briefly after crossing to a new face and then restores speed', () => {
    const state = readyAtEastEdge(createInitialState({ baseSpeed: 4, faceTransitionDuration: 1, faceTransitionSpeedMultiplier: 0 }))
    const crossed = updateGame(state, neutralInput, 0.02)
    const slowed = updateGame(crossed, neutralInput, 0.1)
    const restored = updateGame(slowed, neutralInput, 1.1)
    const movingRestored = updateGame(restored, neutralInput, 0.1)

    expect(crossed.faceTransition?.fromFace).toBe('front')
    expect(crossed.faceTransition?.toFace).toBe('right')
    expect(crossed.faceTransition?.previousSnake.faceId).toBe('front')
    expect(crossed.faceTransition?.previousSnake.trail.length).toBeGreaterThan(1)
    expect(slowed.snake.speed).toBeCloseTo(0)
    expect(slowed.snake.head.x).toBeCloseTo(crossed.snake.head.x)
    expect(slowed.snake.head.y).toBeCloseTo(crossed.snake.head.y)
    expect(restored.faceTransition).toBeUndefined()
    expect(movingRestored.snake.speed).toBeCloseTo(4)
  })

  it('fails when trying to return to a completed face', () => {
    const crossed = updateGame(readyAtEastEdge(), neutralInput, 0.02)
    const afterTransition = updateGame(crossed, neutralInput, crossed.config.faceTransitionDuration + 0.1)
    const returning: GameState = {
      ...afterTransition,
      snake: {
        ...afterTransition.snake,
        head: { x: -afterTransition.config.planeSize / 2 + afterTransition.config.snakeRadius + 0.02, y: 0 },
        heading: Math.PI,
        length: afterTransition.targetLength,
      },
    }
    const next = updateGame(returning, neutralInput, 0.02)

    expect(next.status).toBe('failed')
    expect(next.lastFailureReason).toContain('永久护栏')
  })

  it('reports dead ends without immediately failing', () => {
    const state = createInitialState()
    const completedNeighbors: FaceId[] = ['top', 'right', 'bottom', 'left']
    const faces = completedNeighbors.reduce(
      (nextFaces, faceId) => ({ ...nextFaces, [faceId]: 'completed' as const }),
      state.faces,
    )
    const deadEndState = { ...state, faces, completedCount: completedNeighbors.length }

    expect(isDeadEnd(deadEndState)).toBe(true)
    expect(updateGame(deadEndState, neutralInput, 0).status).toBe('playing')
  })

  it('wins when the sixth active face reaches its target length', () => {
    const state = createInitialState()
    const faces = {
      front: 'active',
      right: 'completed',
      back: 'completed',
      left: 'completed',
      top: 'completed',
      bottom: 'completed',
    } as const
    const finalState: GameState = {
      ...state,
      faces,
      completedCount: 5,
      snake: {
        ...state.snake,
        length: state.targetLength,
      },
    }
    const next = updateGame(finalState, neutralInput, 0)

    expect(next.status).toBe('won')
    expect(next.completedCount).toBe(6)
    expect(next.faces.front).toBe('completed')
  })

  it('detects the crossed edge from local coordinates', () => {
    expect(getCrossedEdge({ x: 9.1, y: 0 }, 9)).toBe('east')
    expect(getCrossedEdge({ x: 0, y: -9.1 }, 9)).toBe('south')
    expect(getCrossedEdge({ x: 0, y: 0 }, 9)).toBeUndefined()
  })
})
