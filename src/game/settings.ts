import { reactive } from 'vue'
import type { GameConfig, GameSettings } from '../types/game'
import { defaultConfig } from './engine/gameState'
import { defaultSphereConfig } from './sphere/sphereGame'
import type { SphereGameConfig } from './sphere/types'

export const defaultGameSettings: GameSettings = {
  polyhedronType: 'sphere',
  initialSpeed: defaultSphereConfig.baseSpeed,
  turnSpeed: defaultSphereConfig.turnSpeed,
  initialSnakeLength: defaultSphereConfig.initialLength,
  initialLengthIncrement: defaultConfig.initialLengthIncrement,
  foodSpawnInterval: defaultSphereConfig.foodSpawnInterval,
  superPotionTempFoodInterval: defaultSphereConfig.superPotionTempFoodInterval,
  cameraDistance: 8,
  cameraPitch: 54,
  showDebugInfo: false,
  soundEnabled: false,
}

export const gameSettings = reactive<GameSettings>({ ...defaultGameSettings })

export function createConfigFromSettings(settings: GameSettings): Partial<GameConfig> {
  return {
    baseSpeed: settings.initialSpeed,
    turnSpeed: settings.turnSpeed,
    initialLength: settings.initialSnakeLength,
    initialLengthIncrement: settings.initialLengthIncrement,
    foodSpawnInterval: settings.foodSpawnInterval,
    superPotionTempFoodInterval: settings.superPotionTempFoodInterval,
  }
}

export function createSphereConfigFromSettings(settings: GameSettings): Partial<SphereGameConfig> {
  return {
    baseSpeed: settings.initialSpeed,
    turnSpeed: settings.turnSpeed,
    initialLength: settings.initialSnakeLength,
    foodSpawnInterval: settings.foodSpawnInterval,
    superPotionTempFoodInterval: settings.superPotionTempFoodInterval,
  }
}

export function resetGameSettings(): void {
  Object.assign(gameSettings, defaultGameSettings)
}
