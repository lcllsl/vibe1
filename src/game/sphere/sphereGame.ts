import type { FoodType, GameInput, Vector3 } from '../../types/game'
import type { SphereEffect, SphereFood, SphereGameConfig, SphereGameState, SphereSnake, SphereTrailPoint } from './types'
import { add, angularDistance, cross, normalize, rotateAroundAxis, scale, tangentAt } from './vector'

export const defaultSphereConfig: SphereGameConfig = {
  sphereRadius: 52,
  baseSpeed: 3,
  boostMultiplier: 1.55,
  turnSpeed: Math.PI * 1.25,
  initialLength: 4,
  segmentSpacing: 0.32,
  snakeRadius: 0.22,
  foodRadius: 0.34,
  foodPickupRadiusMultiplier: 2.2,
  foodGrowth: 1.1,
  feastGrowthMultiplier: 3,
  selfCollisionIgnoreRatio: 0.2,
  speedUpMultiplier: 1.5,
  slowDownMultiplier: 0.5,
  speedEffectDuration: 10,
  rainbowShieldDuration: 8,
  rainbowGraceDuration: 1,
  superPotionDuration: 10,
  superPotionTempFoodInterval: 0.8,
  foodSpawnInterval: 1.8,
  temporaryFoodDuration: 5,
  clusterMinFoods: 3,
  clusterMaxFoods: 5,
  maxFoods: 5,
  difficultyInterval: 30,
  difficultySpeedStep: 0.035,
  maxDifficultyMultiplier: 1.8,
}

const foodWeights: Array<{ type: FoodType; weight: number }> = [
  { type: 'normal', weight: 70 },
  { type: 'feast', weight: 10 },
  { type: 'speedUp', weight: 5 },
  { type: 'slowDown', weight: 5 },
  { type: 'cluster', weight: 5 },
  { type: 'rainbowCandy', weight: 3 },
  { type: 'superPotion', weight: 2 },
]

let nextFoodId = 1

export function createSphereState(overrides: Partial<SphereGameConfig> = {}, random: () => number = Math.random): SphereGameState {
  const config = { ...defaultSphereConfig, ...overrides }
  const position = normalize({ x: 0, y: 0, z: 1 })
  const forward = normalize({ x: 0, y: 1, z: 0 })
  const snake = createSnake(position, forward, config)
  const firstFoodAxis = normalize(cross(position, forward))
  const firstFoodPosition = normalize(rotateAroundAxis(position, firstFoodAxis, 0.105))

  return {
    status: 'playing',
    snake,
    foods: [createFood(randomFoodType(random), firstFoodPosition, config)],
    activeEffects: [],
    config,
    elapsed: 0,
    score: 0,
    foodsEaten: 0,
    spawnTimer: 0,
    superPotionSpawnTimer: 0,
    collisionGraceUntil: 0,
  }
}

export function updateSphereGame(
  state: SphereGameState,
  input: GameInput,
  rawDeltaTime: number,
  random: () => number = Math.random,
): SphereGameState {
  if (state.status !== 'playing') {
    return state
  }

  const deltaTime = Math.min(rawDeltaTime, 0.08)
  const elapsed = state.elapsed + deltaTime
  const activeEffects = state.activeEffects.filter((effect) => effect.expiresAt > elapsed)
  const difficultyMultiplier = Math.min(
    state.config.maxDifficultyMultiplier,
    1 + Math.floor(elapsed / state.config.difficultyInterval) * state.config.difficultySpeedStep,
  )
  const effectMultiplier = getSpeedMultiplier(activeEffects, state.config)
  const speed = state.config.baseSpeed * difficultyMultiplier * effectMultiplier * (input.boost ? state.config.boostMultiplier : 1)
  const snake = moveSnake(state.snake, input, deltaTime, speed, state.config)
  let nextState: SphereGameState = {
    ...state,
    snake,
    elapsed,
    activeEffects,
    foods: state.foods.filter((food) => !food.temporary || food.expiresAt === undefined || food.expiresAt > elapsed),
    spawnTimer: state.spawnTimer + deltaTime,
  }

  const eatenFood = nextState.foods.find((food) => isSphereFoodCollision(snake, food, state.config))
  if (eatenFood) {
    nextState = consumeFood(nextState, eatenFood, random)
  }

  if (nextState.spawnTimer >= state.config.foodSpawnInterval && nextState.foods.length < state.config.maxFoods) {
    nextState = {
      ...nextState,
      spawnTimer: 0,
      foods: [...nextState.foods, createNearbyFood(nextState, random)],
    }
  }

  nextState = spawnPotionFoods(nextState, deltaTime, random)

  if (elapsed >= nextState.collisionGraceUntil && hasSelfCollision(nextState.snake, nextState.config)) {
    const shield = nextState.activeEffects.find((effect) => effect.type === 'rainbowShield')
    if (shield) {
      return {
        ...nextState,
        activeEffects: nextState.activeEffects.filter((effect) => effect !== shield),
        collisionGraceUntil: elapsed + state.config.rainbowGraceDuration,
      }
    }

    return { ...nextState, status: 'failed', lastFailureReason: '撞到自己了' }
  }

  return nextState
}

export function pauseSphereGame(state: SphereGameState): SphereGameState {
  return state.status === 'playing' ? { ...state, status: 'paused' } : state
}

export function resumeSphereGame(state: SphereGameState): SphereGameState {
  return state.status === 'paused' ? { ...state, status: 'playing' } : state
}

export function getSphereSegments(snake: SphereSnake, spacing: number): Vector3[] {
  const segments: Vector3[] = []
  let nextDistance = 0

  for (const point of snake.trail) {
    if (point.distance + 0.0001 >= nextDistance) {
      segments.push(point.position)
      nextDistance += spacing
    }
    if (nextDistance > snake.length) break
  }

  return segments
}

function createSnake(position: Vector3, forward: Vector3, config: SphereGameConfig): SphereSnake {
  const trail: SphereTrailPoint[] = []
  for (let distance = 0; distance <= config.initialLength + config.segmentSpacing; distance += config.segmentSpacing / 2) {
    const angle = -distance / config.sphereRadius
    const axis = normalize(cross(position, forward))
    trail.push({ position: normalize(rotateAroundAxis(position, axis, angle)), distance })
  }

  return {
    position,
    forward,
    trail,
    length: config.initialLength,
    radius: config.snakeRadius,
    speed: config.baseSpeed,
  }
}

function moveSnake(
  snake: SphereSnake,
  input: GameInput,
  deltaTime: number,
  speed: number,
  config: SphereGameConfig,
): SphereSnake {
  const turnDirection = Number(input.turnLeft) - Number(input.turnRight)
  const forward = tangentAt(snake.position, rotateAroundAxis(snake.forward, snake.position, turnDirection * config.turnSpeed * deltaTime))
  const distance = speed * deltaTime
  const movementAxis = normalize(cross(snake.position, forward))
  const position = normalize(rotateAroundAxis(snake.position, movementAxis, distance / config.sphereRadius))
  const movedForward = tangentAt(position, rotateAroundAxis(forward, movementAxis, distance / config.sphereRadius))
  const trail = [
    { position, distance: 0 },
    ...snake.trail.map((point) => ({ ...point, distance: point.distance + distance })),
  ].filter((point) => point.distance <= snake.length + config.segmentSpacing)

  return { ...snake, position, forward: movedForward, trail, speed }
}

function hasSelfCollision(snake: SphereSnake, config: SphereGameConfig): boolean {
  const ignoreDistance = Math.max(config.segmentSpacing * 3, snake.length * config.selfCollisionIgnoreRatio)
  return snake.trail.some((point) =>
    point.distance > ignoreDistance &&
    point.distance < snake.length - config.segmentSpacing &&
    angularDistance(snake.position, point.position) * config.sphereRadius < snake.radius * 1.72,
  )
}

export function isSphereFoodCollision(snake: SphereSnake, food: SphereFood, config: SphereGameConfig): boolean {
  const pickupRadius = snake.radius + food.radius * config.foodPickupRadiusMultiplier
  return angularDistance(snake.position, food.position) * config.sphereRadius <= pickupRadius
}

function consumeFood(state: SphereGameState, food: SphereFood, random: () => number): SphereGameState {
  const growth = food.type === 'feast' ? state.config.foodGrowth * state.config.feastGrowthMultiplier : food.growth
  let nextState: SphereGameState = {
    ...state,
    foods: state.foods.filter((entry) => entry.id !== food.id),
    foodsEaten: state.foodsEaten + 1,
    score: state.score + foodScore(food.type),
    snake: { ...state.snake, length: state.snake.length + growth },
  }

  if (food.type === 'cluster') {
    const count = state.config.clusterMinFoods + Math.floor(random() * (state.config.clusterMaxFoods - state.config.clusterMinFoods + 1))
    const foods = Array.from({ length: count }, () => createFood(randomFoodType(random, ['cluster']), randomSurfacePosition(state.snake.position, state.snake.forward, random, 0.05, 0.18), state.config))
    return { ...nextState, foods: [...nextState.foods, ...foods].slice(-state.config.maxFoods) }
  }

  const durationByType: Partial<Record<FoodType, number>> = {
    speedUp: state.config.speedEffectDuration,
    slowDown: state.config.speedEffectDuration,
    rainbowCandy: state.config.rainbowShieldDuration,
    superPotion: state.config.superPotionDuration,
  }
  const effectType = food.type === 'rainbowCandy' ? 'rainbowShield' : food.type
  const duration = durationByType[food.type]

  if (duration && ['speedUp', 'slowDown', 'rainbowShield', 'superPotion'].includes(effectType)) {
    const effect: SphereEffect = { type: effectType as SphereEffect['type'], startedAt: state.elapsed, expiresAt: state.elapsed + duration }
    nextState = {
      ...nextState,
      activeEffects: [...nextState.activeEffects.filter((entry) => entry.type !== effect.type), effect],
      superPotionSpawnTimer: effect.type === 'superPotion' ? 0 : nextState.superPotionSpawnTimer,
    }
  }

  return nextState
}

function spawnPotionFoods(state: SphereGameState, deltaTime: number, random: () => number): SphereGameState {
  if (!state.activeEffects.some((effect) => effect.type === 'superPotion')) {
    return { ...state, superPotionSpawnTimer: 0 }
  }

  const timer = state.superPotionSpawnTimer + deltaTime
  if (timer < state.config.superPotionTempFoodInterval || state.foods.length >= state.config.maxFoods + 3) {
    return { ...state, superPotionSpawnTimer: timer }
  }

  const food = createNearbyFood(state, random, true)
  return {
    ...state,
    superPotionSpawnTimer: 0,
    foods: [...state.foods, { ...food, temporary: true, expiresAt: state.elapsed + state.config.temporaryFoodDuration }],
  }
}

function createNearbyFood(state: SphereGameState, random: () => number, temporary = false): SphereFood {
  return createFood(
    randomFoodType(random, temporary ? ['superPotion'] : []),
    randomSurfacePosition(state.snake.position, state.snake.forward, random),
    state.config,
    temporary,
  )
}

function createFood(type: FoodType, position: Vector3, config: SphereGameConfig, temporary = false): SphereFood {
  return {
    id: `sphere-food-${nextFoodId++}`,
    type,
    position,
    radius: config.foodRadius,
    growth: ['normal', 'feast'].includes(type) ? config.foodGrowth : 0,
    temporary,
  }
}

function randomSurfacePosition(
  center: Vector3,
  forward: Vector3,
  random: () => number,
  minAngle = 0.065,
  maxAngle = 0.18,
): Vector3 {
  const side = normalize(cross(center, forward))
  const bearing = (random() - 0.5) * Math.PI * 0.9
  const direction = normalize(add(scale(forward, Math.cos(bearing)), scale(side, Math.sin(bearing))))
  const axis = normalize(cross(center, direction))
  return normalize(rotateAroundAxis(center, axis, minAngle + random() * (maxAngle - minAngle)))
}

function randomFoodType(random: () => number, excluded: FoodType[] = []): FoodType {
  const candidates = foodWeights.filter((entry) => !excluded.includes(entry.type))
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0)
  let target = random() * total
  for (const entry of candidates) {
    target -= entry.weight
    if (target <= 0) return entry.type
  }
  return candidates[0].type
}

function getSpeedMultiplier(effects: SphereEffect[], config: SphereGameConfig): number {
  let multiplier = 1
  if (effects.some((effect) => effect.type === 'speedUp')) multiplier *= config.speedUpMultiplier
  if (effects.some((effect) => effect.type === 'slowDown')) multiplier *= config.slowDownMultiplier
  if (effects.some((effect) => effect.type === 'superPotion')) multiplier *= config.speedUpMultiplier
  return multiplier
}

function foodScore(type: FoodType): number {
  return type === 'feast' ? 30 : type === 'superPotion' ? 50 : type === 'normal' ? 10 : 20
}
