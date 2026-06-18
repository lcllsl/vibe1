export type GameStatus = 'playing' | 'paused' | 'failed' | 'won'
export type FaceStatus = 'available' | 'active' | 'completed'
export type FaceId = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'
export type EdgeId = 'north' | 'east' | 'south' | 'west'
export type FoodType = 'normal' | 'feast' | 'speedUp' | 'slowDown' | 'cluster' | 'rainbowCandy' | 'superPotion'
export type ActiveEffectType = 'speedUp' | 'slowDown' | 'rainbowShield' | 'superPotion'
export type PolyhedronType = 'sphere' | 'cube' | 'tetrahedron' | 'octahedron' | 'dodecahedron' | 'icosahedron'

export interface Vector2 {
  x: number
  y: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface TrailPoint extends Vector2 {
  distance: number
}

export interface Food {
  id: string
  type: FoodType
  faceId: FaceId
  position: Vector2
  radius: number
  growth: number
  temporary: boolean
  expiresAt?: number
  spawnedBy?: FoodType
}

export interface ActiveEffect {
  type: ActiveEffectType
  expiresAt: number
  startedAt: number
}

export interface FaceTransition {
  fromFace: FaceId
  toFace: FaceId
  previousSnake: SnakeState
  startedAt: number
  expiresAt: number
}

export interface SnakeState {
  faceId: FaceId
  head: Vector2
  heading: number
  trail: TrailPoint[]
  length: number
  initialLength: number
  radius: number
  speed: number
}

export interface GameConfig {
  planeSize: number
  baseSpeed: number
  boostMultiplier: number
  turnSpeed: number
  initialLength: number
  segmentSpacing: number
  snakeRadius: number
  foodRadius: number
  foodGrowth: number
  feastGrowthMultiplier: number
  selfCollisionIgnoreRatio: number
  initialLengthIncrement: number
  targetLengthGrowth: number
  speedUpMultiplier: number
  slowDownMultiplier: number
  speedEffectDuration: number
  rainbowShieldDuration: number
  superPotionDuration: number
  superPotionTempFoodInterval: number
  foodSpawnInterval: number
  temporaryFoodDuration: number
  clusterMinFoods: number
  clusterMaxFoods: number
  faceTransitionDuration: number
  faceTransitionSpeedMultiplier: number
}

export interface GameSettings {
  polyhedronType: PolyhedronType
  initialSpeed: number
  turnSpeed: number
  initialSnakeLength: number
  initialLengthIncrement: number
  foodSpawnInterval: number
  superPotionTempFoodInterval: number
  cameraDistance: number
  cameraPitch: number
  showDebugInfo: boolean
  soundEnabled: boolean
}

export interface GameInput {
  turnLeft: boolean
  turnRight: boolean
  boost: boolean
}

export interface GameState {
  status: GameStatus
  snake: SnakeState
  foods: Food[]
  activeEffects: ActiveEffect[]
  config: GameConfig
  faces: Record<FaceId, FaceStatus>
  completedCount: number
  targetLength: number
  isDeadEnd: boolean
  elapsed: number
  foodsEaten: number
  superPotionSpawnTimer: number
  faceTransition?: FaceTransition
  lastFailureReason?: string
}

export interface CubeFace {
  id: FaceId
  label: string
  normal: Vector3
  right: Vector3
  up: Vector3
  neighbors: Record<EdgeId, FaceId>
}

export interface BarrierState {
  edge: EdgeId
  neighbor: FaceId
  open: boolean
  permanent: boolean
}
