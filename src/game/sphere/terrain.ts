import type { Vector3 } from '../../types/game'

export type TerrainType = 'water' | 'desert' | 'grass' | 'snow'

export interface TerrainSample {
  type: TerrainType
  latitude: number
  continent: number
  variation: number
  moisture: number
}

export function sampleTerrain(position: Vector3): TerrainSample {
  const length = Math.hypot(position.x, position.y, position.z) || 1
  const x = position.x / length
  const y = position.y / length
  const z = position.z / length
  const latitude = Math.abs(y)
  const continent =
    Math.sin(x * 2.1 + z * 0.7) * 0.38
    + Math.sin(z * 2.6 - y * 0.8) * 0.32
    + Math.sin((x + z) * 3.7 + y) * 0.18
    + Math.cos(y * 5.1 - x) * 0.12
  const variation = Math.sin(x * 11 + y * 7 - z * 9)
  const moisture = Math.cos(z * 8 - x * 5 + y * 3)

  let type: TerrainType = 'water'
  if (latitude > 0.84) type = 'snow'
  else if (continent > 0.45) {
    type = continent < 0.52 || (latitude < 0.3 && moisture < -0.28) ? 'desert' : 'grass'
  }

  return { type, latitude, continent, variation, moisture }
}
