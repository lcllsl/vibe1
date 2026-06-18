import type { ActiveEffect, EdgeId, FaceId, Food, GameConfig, GameInput, GameState, SnakeState } from '../../types/game'
import { getCrossedEdge, mapAcrossCubeEdge } from '../polyhedron/cubeTopology'
import { hasSelfCollision } from './collision'
import { consumeEffect, expireEffects, getEffectSpeedMultiplier, hasActiveEffect, upsertTimedEffect } from './effects'
import { createClusterFoods, createFood, createRandomFood, createTemporaryFood, isFoodCollision } from './food'
import { canOpenExits, createInitialFaces, getCompletedCount, getTargetLength, isDeadEnd, isFinalActiveFace } from './levels'
import { createFreshTrail, moveSnake } from './movement'

export const defaultConfig: GameConfig = {
  planeSize: 18,
  baseSpeed: 3,
  boostMultiplier: 1.55,
  turnSpeed: Math.PI * 1.25,
  initialLength: 4,
  segmentSpacing: 0.32,
  snakeRadius: 0.22,
  foodRadius: 0.34,
  foodGrowth: 1.1,
  feastGrowthMultiplier: 3,
  selfCollisionIgnoreRatio: 0.2,
  initialLengthIncrement: 1,
  targetLengthGrowth: 0.8,
  speedUpMultiplier: 1.5,
  slowDownMultiplier: 0.5,
  speedEffectDuration: 10,
  rainbowShieldDuration: 8,
  superPotionDuration: 10,
  superPotionTempFoodInterval: 0.8,
  foodSpawnInterval: 1.2,
  temporaryFoodDuration: 5,
  clusterMinFoods: 3,
  clusterMaxFoods: 5,
  faceTransitionDuration: 2,
  faceTransitionSpeedMultiplier: 0,
}

export const neutralInput: GameInput = {
  turnLeft: false,
  turnRight: false,
  boost: false,
}

export function createInitialSnake(
  config: GameConfig = defaultConfig,
  faceId: FaceId = 'front',
  initialLength = config.initialLength,
  head = { x: -2, y: 0 },
  heading = 0,
): SnakeState {
  const snake: SnakeState = {
    faceId,
    head,
    heading,
    trail: [],
    length: initialLength,
    initialLength,
    radius: config.snakeRadius,
    speed: config.baseSpeed,
  }

  snake.trail = createFreshTrail(snake.head, snake.heading, snake.length, config.segmentSpacing)

  return snake
}

export function createInitialState(
  overrides: Partial<GameConfig> = {},
  _random: () => number = Math.random,
): GameState {
  const config = { ...defaultConfig, ...overrides }
  const snake = createInitialSnake(config)
  const faces = createInitialFaces(snake.faceId)

  return {
    status: 'playing',
    snake,
    foods: [createFood({ x: 1.8, y: 0 }, config, 'normal', snake.faceId)],
    activeEffects: [],
    config,
    faces,
    completedCount: 0,
    targetLength: getTargetLength(snake.initialLength, config),
    isDeadEnd: false,
    elapsed: 0,
    foodsEaten: 0,
    superPotionSpawnTimer: 0,
  }
}

export function updateGame(state: GameState, input: GameInput, deltaTime: number, random: () => number = Math.random): GameState {
  if (state.status !== 'playing') {
    return state
  }

  const elapsed = state.elapsed + deltaTime
  const activeEffects = expireEffects(state.activeEffects, elapsed)
  const faceTransition = expireFaceTransition(state.faceTransition, elapsed)
  const foods = expireFoods(state.foods, elapsed)
  const snake = moveSnake(
    state.snake,
    input,
    Math.min(deltaTime, 0.08),
    state.config,
    getEffectSpeedMultiplier(activeEffects, state.config) * getFaceTransitionSpeedMultiplier(faceTransition, state.config),
  )
  let nextState: GameState = {
    ...state,
    foods,
    activeEffects,
    faceTransition,
    snake,
    elapsed,
  }

  const crossedEdge = getCrossedEdge(snake.head, getPlayableHalfSize(state.config))

  if (crossedEdge) {
    return handleBoundaryCrossing(nextState, crossedEdge, random)
  }

  const eatenFood = nextState.foods.find(
    (food) => food.faceId === snake.faceId && isFoodCollision(snake.head, food, snake.radius),
  )

  if (eatenFood) {
    nextState = applyFoodEffect(nextState, eatenFood, random)
  }

  nextState = spawnSuperPotionFoods(nextState, deltaTime, random)

  if (isFinalActiveFace(nextState)) {
    const faces = {
      ...nextState.faces,
      [nextState.snake.faceId]: 'completed',
    }

    return {
      ...nextState,
      status: 'won',
      faces,
      completedCount: getCompletedCount(faces),
      isDeadEnd: false,
    }
  }

  if (hasSelfCollision(nextState.snake, state.config)) {
    if (hasActiveEffect(nextState.activeEffects, 'rainbowShield')) {
      return {
        ...nextState,
        activeEffects: consumeEffect(nextState.activeEffects, 'rainbowShield'),
        isDeadEnd: isDeadEnd(nextState),
      }
    }

    return {
      ...nextState,
      status: 'failed',
      lastFailureReason: '撞到自己了',
    }
  }

  return {
    ...nextState,
    isDeadEnd: isDeadEnd(nextState),
  }
}

export function pauseGame(state: GameState): GameState {
  if (state.status !== 'playing') {
    return state
  }

  return { ...state, status: 'paused' }
}

export function resumeGame(state: GameState): GameState {
  if (state.status !== 'paused') {
    return state
  }

  return { ...state, status: 'playing' }
}

function handleBoundaryCrossing(state: GameState, edge: ReturnType<typeof getCrossedEdge>, random: () => number): GameState {
  if (!edge) {
    return state
  }

  const crossing = mapAcrossCubeEdge(
    state.snake.faceId,
    edge,
    state.snake.head,
    state.snake.heading,
    getPlayableHalfSize(state.config),
  )
  const neighborStatus = state.faces[crossing.toFace]
  const canCross = (canOpenExits(state) || hasActiveEffect(state.activeEffects, 'superPotion')) && neighborStatus === 'available'

  if (!canCross) {
    if (hasActiveEffect(state.activeEffects, 'rainbowShield')) {
      return {
        ...state,
        snake: bounceSnakeFromEdge(state.snake, edge, getPlayableHalfSize(state.config), state.config),
        activeEffects: consumeEffect(state.activeEffects, 'rainbowShield'),
        isDeadEnd: isDeadEnd(state),
      }
    }

    return {
      ...state,
      status: 'failed',
      lastFailureReason: neighborStatus === 'completed' ? '撞到已完成面的永久护栏' : '护栏还没有打开',
    }
  }

  const nextInitialLength = state.snake.initialLength + state.config.initialLengthIncrement
  const snake = createInitialSnake(
    state.config,
    crossing.toFace,
    nextInitialLength,
    crossing.position,
    crossing.heading,
  )
  const faces = {
    ...state.faces,
    [crossing.fromFace]: 'completed',
    [crossing.toFace]: 'active',
  }
  const nextState: GameState = {
    ...state,
    snake,
    faces,
    completedCount: getCompletedCount(faces),
    targetLength: getTargetLength(nextInitialLength, state.config),
    faceTransition: {
      fromFace: crossing.fromFace,
      toFace: crossing.toFace,
      previousSnake: state.snake,
      startedAt: state.elapsed,
      expiresAt: state.elapsed + state.config.faceTransitionDuration,
    },
    foods: [
      ...state.foods.filter((food) => faces[food.faceId] !== 'completed'),
      createRandomFood(state.config, snake, random),
    ],
  }

  return {
    ...nextState,
    isDeadEnd: isDeadEnd(nextState),
  }
}

function getPlayableHalfSize(config: GameConfig): number {
  return config.planeSize / 2 - config.snakeRadius
}

function applyFoodEffect(state: GameState, food: Food, random: () => number): GameState {
  let nextState: GameState = {
    ...state,
    foods: state.foods.filter((entry) => entry.id !== food.id),
    foodsEaten: state.foodsEaten + 1,
  }

  if (food.growth > 0) {
    nextState = {
      ...nextState,
      snake: {
        ...nextState.snake,
        length: nextState.snake.length + food.growth,
      },
    }
  }

  if (food.type === 'speedUp') {
    return addRandomReplacement(addEffect(nextState, 'speedUp', state.config.speedEffectDuration), random)
  }

  if (food.type === 'slowDown') {
    return addRandomReplacement(addEffect(nextState, 'slowDown', state.config.speedEffectDuration), random)
  }

  if (food.type === 'rainbowCandy') {
    return addRandomReplacement(addEffect(nextState, 'rainbowShield', state.config.rainbowShieldDuration), random)
  }

  if (food.type === 'superPotion') {
    return addRandomReplacement({
      ...addEffect(nextState, 'superPotion', state.config.superPotionDuration),
      superPotionSpawnTimer: state.config.superPotionTempFoodInterval,
    }, random)
  }

  if (food.type === 'cluster') {
    return {
      ...nextState,
      foods: [...nextState.foods, ...createClusterFoods(state.config, nextState.snake, random)],
    }
  }

  return {
    ...nextState,
    foods: [...nextState.foods, createRandomFood(state.config, nextState.snake, random)],
  }
}

function addRandomReplacement(state: GameState, random: () => number): GameState {
  return {
    ...state,
    foods: [...state.foods, createRandomFood(state.config, state.snake, random)],
  }
}

function addEffect(state: GameState, type: ActiveEffect['type'], duration: number): GameState {
  return {
    ...state,
    activeEffects: upsertTimedEffect(state.activeEffects, type, state.elapsed, duration),
  }
}

function expireFoods(foods: Food[], elapsed: number): Food[] {
  return foods.filter((food) => !food.temporary || food.expiresAt === undefined || food.expiresAt > elapsed)
}

function expireFaceTransition(
  transition: GameState['faceTransition'],
  elapsed: number,
): GameState['faceTransition'] {
  if (!transition || transition.expiresAt <= elapsed) {
    return undefined
  }

  return transition
}

function getFaceTransitionSpeedMultiplier(
  transition: GameState['faceTransition'],
  config: GameConfig,
): number {
  return transition ? config.faceTransitionSpeedMultiplier : 1
}

function spawnSuperPotionFoods(state: GameState, deltaTime: number, random: () => number): GameState {
  if (!hasActiveEffect(state.activeEffects, 'superPotion')) {
    return { ...state, superPotionSpawnTimer: 0 }
  }

  let timer = state.superPotionSpawnTimer + deltaTime
  let foods = state.foods

  while (timer >= state.config.superPotionTempFoodInterval) {
    timer -= state.config.superPotionTempFoodInterval
    const expiresAt = state.elapsed + state.config.temporaryFoodDuration
    const faceIds = Object.entries(state.faces)
      .filter(([, status]) => status !== 'completed')
      .map(([faceId]) => faceId as FaceId)

    foods = [
      ...foods,
      ...faceIds.map((faceId) => createTemporaryFood(state.config, state.snake, faceId, expiresAt, random)),
    ]
  }

  return {
    ...state,
    foods,
    superPotionSpawnTimer: timer,
  }
}

function bounceSnakeFromEdge(snake: SnakeState, edge: EdgeId, halfSize: number, config: GameConfig): SnakeState {
  const head = { ...snake.head }

  if (edge === 'east') {
    head.x = halfSize - snake.radius
  } else if (edge === 'west') {
    head.x = -halfSize + snake.radius
  } else if (edge === 'north') {
    head.y = halfSize - snake.radius
  } else {
    head.y = -halfSize + snake.radius
  }

  return {
    ...snake,
    head,
    heading: snake.heading + Math.PI,
    trail: createFreshTrail(head, snake.heading + Math.PI, snake.length, config.segmentSpacing),
  }
}
