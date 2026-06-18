import { describe, expect, it } from 'vitest'
import { sampleTerrain, type TerrainType } from './terrain'

describe('sphere terrain', () => {
  it('classifies polar positions as snow', () => {
    expect(sampleTerrain({ x: 0, y: 1, z: 0 }).type).toBe('snow')
  })

  it('generates all movement-effect terrain types across the globe', () => {
    const terrains = new Set<TerrainType>()
    for (let latitudeStep = -8; latitudeStep <= 8; latitudeStep += 1) {
      const latitude = latitudeStep / 8 * Math.PI / 2
      for (let longitudeStep = 0; longitudeStep < 32; longitudeStep += 1) {
        const longitude = longitudeStep / 32 * Math.PI * 2
        terrains.add(sampleTerrain({
          x: Math.cos(latitude) * Math.cos(longitude),
          y: Math.sin(latitude),
          z: Math.cos(latitude) * Math.sin(longitude),
        }).type)
      }
    }

    expect(terrains).toEqual(new Set<TerrainType>(['water', 'desert', 'grass', 'snow']))
  })
})
