import type { Vector3 } from '../../types/game'

export function add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function scale(vector: Vector3, amount: number): Vector3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount }
}

export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function normalize(vector: Vector3): Vector3 {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1
  return scale(vector, 1 / length)
}

export function rotateAroundAxis(vector: Vector3, axis: Vector3, angle: number): Vector3 {
  const unitAxis = normalize(axis)
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)

  return add(
    add(scale(vector, cosine), scale(cross(unitAxis, vector), sine)),
    scale(unitAxis, dot(unitAxis, vector) * (1 - cosine)),
  )
}

export function tangentAt(position: Vector3, direction: Vector3): Vector3 {
  return normalize(add(direction, scale(position, -dot(position, direction))))
}

export function angularDistance(a: Vector3, b: Vector3): number {
  return Math.acos(Math.min(1, Math.max(-1, dot(normalize(a), normalize(b)))))
}
