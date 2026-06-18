import type { ActiveEffectType, FoodType, Vector3 } from '../../types/game'

export interface SphereTrailPoint {
  position: Vector3
  distance: number
}

export interface SphereSnake {
  position: Vector3
  forward: Vector3
  trail: SphereTrailPoint[]
  length: number
  radius: number
  speed: number
}

export interface SphereFood {
  id: string
  type: FoodType
  position: Vector3
  radius: number
  growth: number
  temporary: boolean
  expiresAt?: number
}

export interface SphereEffect {
  type: ActiveEffectType
  startedAt: number
  expiresAt: number
}

export interface SphereGameConfig {
  sphereRadius: number
  baseSpeed: number
  boostMultiplier: number
  turnSpeed: number
  initialLength: number
  segmentSpacing: number
  snakeRadius: number
  foodRadius: number
  foodPickupRadiusMultiplier: number
  foodGrowth: number
  feastGrowthMultiplier: number
  selfCollisionIgnoreRatio: number
  speedUpMultiplier: number
  slowDownMultiplier: number
  speedEffectDuration: number
  rainbowShieldDuration: number
  rainbowGraceDuration: number
  superPotionDuration: number
  superPotionTempFoodInterval: number
  foodSpawnInterval: number
  temporaryFoodDuration: number
  clusterMinFoods: number
  clusterMaxFoods: number
  maxFoods: number
  difficultyInterval: number
  difficultySpeedStep: number
  maxDifficultyMultiplier: number
}

export interface SphereGameState {
  status: 'playing' | 'paused' | 'failed'
  snake: SphereSnake
  foods: SphereFood[]
  activeEffects: SphereEffect[]
  config: SphereGameConfig
  elapsed: number
  score: number
  foodsEaten: number
  spawnTimer: number
  superPotionSpawnTimer: number
  collisionGraceUntil: number
  lastFailureReason?: string
}
