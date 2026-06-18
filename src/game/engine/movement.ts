import type { GameConfig, GameInput, SnakeState, TrailPoint, Vector2 } from '../../types/game'
import { add, distance, fromAngle, lerp, scale } from './vector'

export function moveSnake(
  snake: SnakeState,
  input: GameInput,
  deltaTime: number,
  config: GameConfig,
  speedMultiplier = 1,
): SnakeState {
  const turnDirection = Number(input.turnRight) - Number(input.turnLeft)
  const heading = snake.heading + turnDirection * config.turnSpeed * deltaTime
  const speed = config.baseSpeed * speedMultiplier * (input.boost ? config.boostMultiplier : 1)
  const movement = scale(fromAngle(heading), speed * deltaTime)
  const head = add(snake.head, movement)
  const travelled = distance(snake.head, head)
  const trail = updateTrail(head, snake.trail, snake.length, travelled, config.segmentSpacing)

  return {
    ...snake,
    head,
    heading,
    trail,
    speed,
  }
}

export function updateTrail(
  head: Vector2,
  previousTrail: TrailPoint[],
  snakeLength: number,
  travelled: number,
  segmentSpacing: number,
): TrailPoint[] {
  const updated: TrailPoint[] = [
    { ...head, distance: 0 },
    ...previousTrail.map((point) => ({ ...point, distance: point.distance + travelled })),
  ]

  const maxDistance = snakeLength + segmentSpacing * 4

  return updated.filter((point, index) => index === 0 || point.distance <= maxDistance)
}

export function sampleTrail(trail: TrailPoint[], targetDistance: number): Vector2 {
  if (trail.length === 0) {
    return { x: 0, y: 0 }
  }

  for (let index = 1; index < trail.length; index += 1) {
    const before = trail[index - 1]
    const after = trail[index]

    if (targetDistance <= after.distance) {
      const span = after.distance - before.distance || 1
      return lerp(before, after, (targetDistance - before.distance) / span)
    }
  }

  return trail[trail.length - 1]
}

export function getSnakeSegments(snake: SnakeState, segmentSpacing: number): Vector2[] {
  const count = Math.max(1, Math.floor(snake.length / segmentSpacing))
  const segments: Vector2[] = []

  for (let index = 0; index < count; index += 1) {
    segments.push(sampleTrail(snake.trail, index * segmentSpacing))
  }

  return segments
}

export function createFreshTrail(head: Vector2, heading: number, snakeLength: number, segmentSpacing: number): TrailPoint[] {
  const backward = scale(fromAngle(heading), -segmentSpacing)
  const count = Math.ceil(snakeLength / segmentSpacing) + 1
  const trail: TrailPoint[] = []

  for (let index = 0; index < count; index += 1) {
    trail.push({
      x: head.x + backward.x * index,
      y: head.y + backward.y * index,
      distance: index * segmentSpacing,
    })
  }

  return trail
}
