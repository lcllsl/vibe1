import type { Vector2 } from '../../types/game'

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(v: Vector2, amount: number): Vector2 {
  return { x: v.x * amount, y: v.y * amount }
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function fromAngle(angle: number): Vector2 {
  return { x: Math.cos(angle), y: Math.sin(angle) }
}

export function lerp(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
