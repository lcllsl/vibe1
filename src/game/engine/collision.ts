import type { GameConfig, SnakeState, Vector2 } from '../../types/game'
import { distance } from './vector'

export function hasSelfCollision(snake: SnakeState, config: GameConfig): boolean {
  const ignoredDistance = snake.length * config.selfCollisionIgnoreRatio
  const hitDistance = snake.radius * 1.35

  return snake.trail.some((point) => {
    if (point.distance <= ignoredDistance || point.distance >= snake.length) {
      return false
    }

    return distance(snake.head, point) <= hitDistance
  })
}

export function isOutsidePlane(position: Vector2, planeSize: number, radius: number): boolean {
  const half = planeSize / 2 - radius

  return position.x < -half || position.x > half || position.y < -half || position.y > half
}
