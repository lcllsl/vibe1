import type { ActiveEffect, ActiveEffectType, GameConfig } from '../../types/game'

export function hasActiveEffect(effects: ActiveEffect[], type: ActiveEffectType): boolean {
  return effects.some((effect) => effect.type === type)
}

export function upsertTimedEffect(
  effects: ActiveEffect[],
  type: ActiveEffectType,
  startedAt: number,
  duration: number,
): ActiveEffect[] {
  return [
    ...effects.filter((effect) => effect.type !== type),
    {
      type,
      startedAt,
      expiresAt: startedAt + duration,
    },
  ]
}

export function expireEffects(effects: ActiveEffect[], elapsed: number): ActiveEffect[] {
  return effects.filter((effect) => effect.expiresAt > elapsed)
}

export function consumeEffect(effects: ActiveEffect[], type: ActiveEffectType): ActiveEffect[] {
  let consumed = false

  return effects.filter((effect) => {
    if (!consumed && effect.type === type) {
      consumed = true
      return false
    }

    return true
  })
}

export function getEffectSpeedMultiplier(effects: ActiveEffect[], config: GameConfig): number {
  return effects.reduce((multiplier, effect) => {
    if (effect.type === 'speedUp' || effect.type === 'superPotion') {
      return multiplier * config.speedUpMultiplier
    }

    if (effect.type === 'slowDown') {
      return multiplier * config.slowDownMultiplier
    }

    return multiplier
  }, 1)
}
