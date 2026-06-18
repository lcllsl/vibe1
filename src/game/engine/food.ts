import type { FaceId, Food, FoodType, GameConfig, SnakeState, Vector2 } from '../../types/game'
import { distance } from './vector'

let foodId = 0

export const foodWeights: ReadonlyArray<{ type: FoodType; weight: number }> = [
  { type: 'normal', weight: 70 },
  { type: 'feast', weight: 10 },
  { type: 'speedUp', weight: 5 },
  { type: 'slowDown', weight: 5 },
  { type: 'cluster', weight: 5 },
  { type: 'rainbowCandy', weight: 3 },
  { type: 'superPotion', weight: 2 },
]

export function pickFoodType(
  random: () => number = Math.random,
  excludedTypes: FoodType[] = [],
): FoodType {
  const availableWeights = foodWeights.filter((entry) => !excludedTypes.includes(entry.type))
  const totalWeight = availableWeights.reduce((sum, entry) => sum + entry.weight, 0)
  let roll = random() * totalWeight

  for (const entry of availableWeights) {
    roll -= entry.weight

    if (roll < 0) {
      return entry.type
    }
  }

  return availableWeights[availableWeights.length - 1]?.type ?? 'normal'
}

export function createFood(
  position: Vector2,
  config: GameConfig,
  type: FoodType = 'normal',
  faceId: FaceId = 'front',
  options: { temporary?: boolean; expiresAt?: number; spawnedBy?: FoodType } = {},
): Food {
  foodId += 1

  return {
    id: `food-${foodId}`,
    type,
    faceId,
    position,
    radius: config.foodRadius,
    growth: getFoodGrowth(type, config),
    temporary: options.temporary ?? false,
    expiresAt: options.expiresAt,
    spawnedBy: options.spawnedBy,
  }
}

export function isFoodCollision(head: Vector2, food: Food, snakeRadius: number): boolean {
  return distance(head, food.position) <= food.radius + snakeRadius
}

export function createRandomFood(
  config: GameConfig,
  snake: SnakeState,
  random: () => number = Math.random,
  options: { faceId?: FaceId; type?: FoodType; excludedTypes?: FoodType[]; temporary?: boolean; expiresAt?: number; spawnedBy?: FoodType } = {},
): Food {
  const half = config.planeSize / 2 - config.foodRadius * 2
  const type = options.type ?? pickFoodType(random, options.excludedTypes)
  const faceId = options.faceId ?? snake.faceId

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const position = {
      x: (random() * 2 - 1) * half,
      y: (random() * 2 - 1) * half,
    }

    const farFromHead = distance(position, snake.head) > config.initialLength * 0.5
    const farFromBody = snake.trail.every((point) => distance(position, point) > config.snakeRadius * 4)

    if (farFromHead && farFromBody) {
      return createFood(position, config, type, faceId, options)
    }
  }

  return createFood({ x: half * 0.7, y: -half * 0.5 }, config, type, faceId, options)
}

export function createClusterFoods(
  config: GameConfig,
  snake: SnakeState,
  random: () => number = Math.random,
): Food[] {
  const count = config.clusterMinFoods + Math.floor(random() * (config.clusterMaxFoods - config.clusterMinFoods + 1))

  return Array.from({ length: count }, () =>
    createRandomFood(config, snake, random, {
      faceId: snake.faceId,
      excludedTypes: ['cluster'],
      spawnedBy: 'cluster',
    }),
  )
}

export function createTemporaryFood(
  config: GameConfig,
  snake: SnakeState,
  faceId: FaceId,
  expiresAt: number,
  random: () => number = Math.random,
): Food {
  return createRandomFood(config, snake, random, {
    faceId,
    excludedTypes: ['superPotion'],
    temporary: true,
    expiresAt,
    spawnedBy: 'superPotion',
  })
}

function getFoodGrowth(type: FoodType, config: GameConfig): number {
  if (type === 'normal') {
    return config.foodGrowth
  }

  if (type === 'feast') {
    return config.foodGrowth * config.feastGrowthMultiplier
  }

  return 0
}
