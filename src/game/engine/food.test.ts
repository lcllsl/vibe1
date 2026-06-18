import { describe, expect, it } from 'vitest'
import type { FoodType } from '../../types/game'
import { pickFoodType } from './food'

describe('weighted food generation', () => {
  it('uses the configured Phase 3 food weights', () => {
    const samples = 10000
    const counts: Record<FoodType, number> = {
      normal: 0,
      feast: 0,
      speedUp: 0,
      slowDown: 0,
      cluster: 0,
      rainbowCandy: 0,
      superPotion: 0,
    }

    for (let index = 0; index < samples; index += 1) {
      const roll = (index + 0.5) / samples
      counts[pickFoodType(() => roll)] += 1
    }

    expect(counts.normal / samples).toBeCloseTo(0.7, 2)
    expect(counts.feast / samples).toBeCloseTo(0.1, 2)
    expect(counts.speedUp / samples).toBeCloseTo(0.05, 2)
    expect(counts.slowDown / samples).toBeCloseTo(0.05, 2)
    expect(counts.cluster / samples).toBeCloseTo(0.05, 2)
    expect(counts.rainbowCandy / samples).toBeCloseTo(0.03, 2)
    expect(counts.superPotion / samples).toBeCloseTo(0.02, 2)
  })
})
