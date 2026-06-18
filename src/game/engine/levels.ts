import type { BarrierState, FaceId, FaceStatus, GameConfig, GameState } from '../../types/game'
import { cubeEdgeIds, cubeFaceIds, getNeighbor } from '../polyhedron/cubeTopology'
import { hasActiveEffect } from './effects'

export function createInitialFaces(activeFace: FaceId = 'front'): Record<FaceId, FaceStatus> {
  return cubeFaceIds.reduce(
    (faces, faceId) => ({
      ...faces,
      [faceId]: faceId === activeFace ? 'active' : 'available',
    }),
    {} as Record<FaceId, FaceStatus>,
  )
}

export function getTargetLength(initialLength: number, config: GameConfig): number {
  return initialLength + config.targetLengthGrowth
}

export function canOpenExits(state: GameState): boolean {
  return state.snake.length >= state.targetLength
}

export function getBarrierStates(state: GameState): BarrierState[] {
  const activeFace = state.snake.faceId
  const exitsOpen = canOpenExits(state)
  const superPotionActive = hasActiveEffect(state.activeEffects, 'superPotion')

  return cubeEdgeIds.map((edge) => {
    const neighbor = getNeighbor(activeFace, edge)
    const permanent = state.faces[neighbor] === 'completed'
    const open = state.faces[neighbor] === 'available' && (exitsOpen || superPotionActive)

    return {
      edge,
      neighbor,
      permanent,
      open,
    }
  })
}

export function isDeadEnd(state: GameState): boolean {
  return getBarrierStates(state).every((barrier) => barrier.neighbor && state.faces[barrier.neighbor] === 'completed')
}

export function getCompletedCount(faces: Record<FaceId, FaceStatus>): number {
  return cubeFaceIds.filter((faceId) => faces[faceId] === 'completed').length
}

export function isFinalActiveFace(state: GameState): boolean {
  return state.completedCount === cubeFaceIds.length - 1 && canOpenExits(state)
}
