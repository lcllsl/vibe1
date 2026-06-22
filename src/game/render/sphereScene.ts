import * as THREE from 'three'
import type { FoodType, Vector3 } from '../../types/game'
import { getSphereSegments } from '../sphere/sphereGame'
import { sampleTerrain, type TerrainType } from '../sphere/terrain'
import type { SphereFood, SphereGameState } from '../sphere/types'

const SURFACE_LIFT = 0.34
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const BODY_HEAD_COLOR = new THREE.Color(0x43c997)
const BODY_TAIL_COLOR = new THREE.Color(0xa9ebcf)
const TERRAIN_PARTICLE_COUNT = 120
const CAMERA_RADIAL_OFFSET = 34
const CAMERA_BACK_OFFSET = 23
const CAMERA_LOOK_AHEAD = 4
const FOOD_SPRITE_UV: Record<FoodType, { x: number; y: number }> = {
  normal: { x: 0, y: 0.5 },
  feast: { x: 0.25, y: 0.5 },
  speedUp: { x: 0.5, y: 0.5 },
  slowDown: { x: 0.75, y: 0.5 },
  cluster: { x: 0, y: 0 },
  rainbowCandy: { x: 0.25, y: 0 },
  superPotion: { x: 0.5, y: 0 },
}

interface TerrainParticle {
  position: THREE.Vector3
  velocity: THREE.Vector3
  color: THREE.Color
  life: number
  maxLife: number
}

export class SphereGameScene {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 180)
  private readonly renderer: THREE.WebGLRenderer
  private readonly snakeGroup = new THREE.Group()
  private readonly bodyMeshes: THREE.Mesh[] = []
  private readonly bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.4, 8, 14)
  private readonly foodSprites = new Map<string, THREE.Sprite>()
  private readonly foodMaterials = new Map<FoodType, THREE.SpriteMaterial>()
  private readonly foodAtlas: THREE.Texture
  private readonly headGroup: THREE.Group
  private readonly terrainParticles: THREE.Points
  private readonly terrainParticlePositions = new Float32Array(TERRAIN_PARTICLE_COUNT * 3)
  private readonly terrainParticleColors = new Float32Array(TERRAIN_PARTICLE_COUNT * 3)
  private readonly terrainParticleState: TerrainParticle[] = Array.from({ length: TERRAIN_PARTICLE_COUNT }, () => ({
    position: new THREE.Vector3(9999, 9999, 9999),
    velocity: new THREE.Vector3(),
    color: new THREE.Color(),
    life: 0,
    maxLife: 1,
  }))
  private readonly resizeObserver: ResizeObserver
  private readonly container: HTMLElement
  private readonly cameraPosition = new THREE.Vector3()
  private readonly cameraLookAt = new THREE.Vector3()
  private readonly cameraUp = new THREE.Vector3(0, 1, 0)
  private readonly segments: Vector3[] = []
  private readonly visualPositions: THREE.Vector3[] = []
  private readonly tempA = new THREE.Vector3()
  private readonly tempB = new THREE.Vector3()
  private readonly tempC = new THREE.Vector3()
  private readonly tempD = new THREE.Vector3()
  private readonly tempE = new THREE.Vector3()
  private readonly headBasis = new THREE.Matrix4()
  private terrainParticleCursor = 0
  private terrainParticleAccumulator = 0
  private lastParticleElapsed = 0
  private disposed = false

  constructor(container: HTMLElement, sphereRadius: number) {
    this.container = container
    this.foodAtlas = new THREE.TextureLoader().load('/food-sprites.png', (atlas) => {
      atlas.colorSpace = THREE.SRGBColorSpace
      this.foodMaterials.forEach((material, type) => {
        material.map?.dispose()
        material.map = this.createFoodTexture(type)
        material.needsUpdate = true
      })
    })
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0xcfeeff, 1)
    this.renderer.shadowMap.enabled = true
    container.append(this.renderer.domElement)

    this.scene.background = new THREE.Color(0xcfeeff)
    this.scene.fog = new THREE.Fog(0xcfeeff, 86, 158)
    this.scene.add(new THREE.HemisphereLight(0xf7fcff, 0x285f80, 2.55))

    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
    keyLight.position.set(20, 35, 45)
    keyLight.castShadow = true
    this.scene.add(keyLight)

    const sphereGeometry = createLowPolyEarthGeometry(sphereRadius)
    const sphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0x0b3750,
        emissiveIntensity: 0.035,
        roughness: 0.82,
        flatShading: true,
      }),
    )
    sphere.receiveShadow = true
    this.scene.add(sphere)

    const texture = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(sphereRadius + 0.025, 2)),
      new THREE.LineBasicMaterial({ color: 0x163f61, transparent: true, opacity: 0.1 }),
    )
    this.scene.add(texture)

    this.terrainParticles = this.createTerrainParticles()
    this.scene.add(this.terrainParticles)

    this.headGroup = createCartoonSnakeHead()
    this.snakeGroup.add(this.headGroup)
    this.scene.add(this.snakeGroup)

    this.cameraPosition.set(0, -CAMERA_BACK_OFFSET, sphereRadius + CAMERA_RADIAL_OFFSET)
    this.cameraLookAt.set(0, CAMERA_LOOK_AHEAD, sphereRadius + SURFACE_LIFT - 0.5)
    this.camera.position.copy(this.cameraPosition)
    this.camera.up.copy(this.cameraUp)
    this.camera.lookAt(this.cameraLookAt)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  update(state: SphereGameState): void {
    this.updateSnake(state)
    this.updateFoods(state)
    this.updateTerrainParticles(state)

    const radius = state.config.sphereRadius
    const normal = copyVector(this.tempA, state.snake.position).normalize()
    const head = this.tempB.copy(normal).multiplyScalar(radius + SURFACE_LIFT)
    const transportedUp = this.tempC.copy(this.cameraUp).addScaledVector(normal, -this.cameraUp.dot(normal))

    if (transportedUp.lengthSq() < 0.0001) {
      transportedUp.set(0, 1, 0).addScaledVector(normal, -normal.y)
    }
    if (transportedUp.lengthSq() < 0.0001) {
      transportedUp.set(1, 0, 0).addScaledVector(normal, -normal.x)
    }
    transportedUp.normalize()

    const desiredPosition = this.tempD.copy(normal).multiplyScalar(radius + CAMERA_RADIAL_OFFSET)
      .addScaledVector(transportedUp, -CAMERA_BACK_OFFSET)
    const desiredLookAt = this.tempE.copy(head).addScaledVector(transportedUp, CAMERA_LOOK_AHEAD)
      .addScaledVector(normal, -0.5)

    this.cameraPosition.lerp(desiredPosition, 0.075)
    this.cameraLookAt.lerp(desiredLookAt, 0.11)
    this.cameraUp.lerp(transportedUp, 0.08).normalize()
    this.camera.position.copy(this.cameraPosition)
    this.camera.up.copy(this.cameraUp)
    this.camera.lookAt(this.cameraLookAt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.resizeObserver.disconnect()
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
      else mesh.material?.dispose()
    })
    this.foodMaterials.forEach((material) => {
      material.map?.dispose()
      material.dispose()
    })
    this.foodAtlas.dispose()
    this.bodyGeometry.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private updateSnake(state: SphereGameState): void {
    const radius = state.config.sphereRadius + SURFACE_LIFT
    const segments = getSphereSegments(state.snake, state.config.segmentSpacing * 1.35, this.segments)
    this.ensureBodyMeshes(Math.max(0, segments.length - 1))
    const headNormal = copyVector(this.tempA, state.snake.position).normalize()
    const headForward = copyVector(this.tempB, state.snake.forward).normalize()
    const headSide = this.tempC.crossVectors(headForward, headNormal).normalize()
    this.headBasis.makeBasis(headSide, headForward, headNormal)

    this.headGroup.position.copy(headNormal).multiplyScalar(radius)
    this.headGroup.quaternion.setFromRotationMatrix(this.headBasis)

    const lengthFactor = THREE.MathUtils.smoothstep(state.snake.length, 3, 10)
    const waveAmplitude = THREE.MathUtils.lerp(0.0035, 0.012, lengthFactor)
    while (this.visualPositions.length < segments.length) this.visualPositions.push(new THREE.Vector3())
    this.visualPositions.length = segments.length

    for (let index = 0; index < segments.length; index += 1) {
      const normal = copyVector(this.visualPositions[index], segments[index]).normalize()
      if (index === 0) {
        normal.multiplyScalar(radius)
        continue
      }

      const previousNormal = copyVector(this.tempA, segments[index - 1]).normalize()
      const nextNormal = copyVector(this.tempB, segments[Math.min(index + 1, segments.length - 1)]).normalize()
      const pathTangent = previousNormal.sub(nextNormal)
      pathTangent.addScaledVector(normal, -pathTangent.dot(normal))
      if (pathTangent.lengthSq() < 0.000001) {
        normal.multiplyScalar(radius)
        continue
      }

      pathTangent.normalize()
      const side = this.tempC.crossVectors(pathTangent, normal).normalize()
      const bodyProgress = index / Math.max(segments.length - 1, 1)
      const headBlend = Math.min(1, index / 4)
      const tailBlend = 0.55 + bodyProgress * 0.45
      const waveAngle = Math.sin(state.elapsed * 5.8 - index * 0.72)
        * waveAmplitude * headBlend * tailBlend

      normal.multiplyScalar(Math.cos(waveAngle))
        .addScaledVector(side, Math.sin(waveAngle))
        .normalize()
        .multiplyScalar(radius)
    }

    for (let index = 1; index < segments.length; index += 1) {
      const mesh = this.bodyMeshes[index - 1]
      const taper = Math.max(0.58, 1 - index / Math.max(segments.length, 1) * 0.42)
      const bodyProgress = index / Math.max(segments.length - 1, 1)
      const previous = this.visualPositions[index - 1]
      const next = this.visualPositions[Math.min(index + 1, this.visualPositions.length - 1)]
      const tangent = this.tempD.copy(previous).sub(next).normalize()
      const material = mesh.material as THREE.MeshStandardMaterial

      mesh.visible = true
      mesh.position.copy(this.visualPositions[index])
      mesh.scale.setScalar(taper)
      mesh.quaternion.setFromUnitVectors(Y_AXIS, tangent)
      material.color.lerpColors(BODY_HEAD_COLOR, BODY_TAIL_COLOR, bodyProgress)
      material.emissive.copy(material.color).multiplyScalar(0.18)
    }
    for (let index = Math.max(0, segments.length - 1); index < this.bodyMeshes.length; index += 1) {
      this.bodyMeshes[index].visible = false
    }
  }

  private updateFoods(state: SphereGameState): void {
    const liveIds = new Set(state.foods.map((food) => food.id))
    this.foodSprites.forEach((sprite, id) => {
      if (!liveIds.has(id)) {
        this.scene.remove(sprite)
        this.foodSprites.delete(id)
      }
    })

    state.foods.forEach((food) => {
      const sprite = this.foodSprites.get(food.id) ?? this.createFoodSprite(food)
      const pulse = Math.sin(state.elapsed * 4 + food.position.x * 8) * 0.05
      copyVector(sprite.position, food.position).multiplyScalar(state.config.sphereRadius + 0.62 + pulse)
      const size = (food.temporary ? 2.15 : 2.7) * (1 + Math.sin(state.elapsed * 4.2 + food.position.y) * 0.035)
      sprite.scale.set(size, size, 1)
    })
  }

  private ensureBodyMeshes(count: number): void {
    while (this.bodyMeshes.length < count) {
      const mesh = new THREE.Mesh(
        this.bodyGeometry,
        new THREE.MeshStandardMaterial({ color: 0x77dcb7, emissive: 0x1d7658, emissiveIntensity: 0.08, roughness: 0.5 }),
      )
      mesh.castShadow = true
      this.bodyMeshes.push(mesh)
      this.snakeGroup.add(mesh)
    }
  }

  private createFoodSprite(food: SphereFood): THREE.Sprite {
    const sprite = new THREE.Sprite(this.getFoodMaterial(food.type))
    sprite.center.set(0.5, 0.42)
    this.foodSprites.set(food.id, sprite)
    this.scene.add(sprite)
    return sprite
  }

  private getFoodMaterial(type: FoodType): THREE.SpriteMaterial {
    const existing = this.foodMaterials.get(type)
    if (existing) return existing

    const material = new THREE.SpriteMaterial({
      map: this.foodAtlas.image ? this.createFoodTexture(type) : null,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: false,
    })
    this.foodMaterials.set(type, material)
    return material
  }

  private createFoodTexture(type: FoodType): THREE.Texture {
    const texture = this.foodAtlas.clone()
    const uv = FOOD_SPRITE_UV[type]
    texture.repeat.set(0.25, 0.5)
    texture.offset.set(uv.x, uv.y)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  private createTerrainParticles(): THREE.Points {
    this.terrainParticlePositions.fill(9999)
    const geometry = new THREE.BufferGeometry()
    const positionAttribute = new THREE.BufferAttribute(this.terrainParticlePositions, 3)
    const colorAttribute = new THREE.BufferAttribute(this.terrainParticleColors, 3)

    positionAttribute.setUsage(THREE.DynamicDrawUsage)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', positionAttribute)
    geometry.setAttribute('color', colorAttribute)

    const particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.42,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    )
    particles.frustumCulled = false
    return particles
  }

  private updateTerrainParticles(state: SphereGameState): void {
    if (state.elapsed < this.lastParticleElapsed) {
      this.terrainParticleState.forEach((particle) => { particle.life = 0 })
      this.terrainParticleAccumulator = 0
    }

    const deltaTime = Math.min(0.1, Math.max(0, state.elapsed - this.lastParticleElapsed))
    this.lastParticleElapsed = state.elapsed

    if (state.status === 'playing' && deltaTime > 0) {
      this.terrainParticleAccumulator += deltaTime
      while (this.terrainParticleAccumulator >= 0.065) {
        this.terrainParticleAccumulator -= 0.065
        this.emitTerrainParticles(state, 2)
      }
    }

    this.terrainParticleState.forEach((particle, index) => {
      const offset = index * 3
      if (particle.life <= 0) {
        this.terrainParticlePositions[offset] = 9999
        this.terrainParticlePositions[offset + 1] = 9999
        this.terrainParticlePositions[offset + 2] = 9999
        return
      }

      particle.life -= deltaTime
      particle.position.addScaledVector(particle.velocity, deltaTime)
      const fade = Math.max(0, particle.life / particle.maxLife)
      this.terrainParticlePositions[offset] = particle.position.x
      this.terrainParticlePositions[offset + 1] = particle.position.y
      this.terrainParticlePositions[offset + 2] = particle.position.z
      this.terrainParticleColors[offset] = particle.color.r * (0.3 + fade * 0.7)
      this.terrainParticleColors[offset + 1] = particle.color.g * (0.3 + fade * 0.7)
      this.terrainParticleColors[offset + 2] = particle.color.b * (0.3 + fade * 0.7)
    })

    const geometry = this.terrainParticles.geometry
    geometry.getAttribute('position').needsUpdate = true
    geometry.getAttribute('color').needsUpdate = true
  }

  private emitTerrainParticles(state: SphereGameState, count: number): void {
    const normal = copyVector(this.tempA, state.snake.position).normalize()
    const forward = copyVector(this.tempB, state.snake.forward).normalize()
    const side = this.tempC.crossVectors(forward, normal).normalize()
    const origin = this.tempD.copy(normal)
      .multiplyScalar(state.config.sphereRadius + 0.1)
      .addScaledVector(forward, -0.06)
    const terrain = sampleTerrain(state.snake.position).type
    const profile = terrainParticleProfile(terrain)

    for (let emitted = 0; emitted < count; emitted += 1) {
      const particle = this.terrainParticleState[this.terrainParticleCursor]
      const lateralDirection = emitted % 2 === 0 ? -1 : 1
      const sideways = lateralDirection * profile.tangentSpeed * (0.25 + Math.random() * 2)
      const longitudinal = (Math.random() - 0.68) * profile.backSpeed * 2.6
      particle.position.copy(origin)
        .addScaledVector(side, lateralDirection * (0.3 + Math.random() * 0.35))
        .addScaledVector(forward, (Math.random() - 0.55) * 0.45)
        .addScaledVector(normal, Math.random() * 0.11)
      particle.velocity.copy(normal).multiplyScalar(profile.normalSpeed * (0.3 + Math.random() * 1.65))
        .addScaledVector(side, sideways)
        .addScaledVector(forward, longitudinal)
      particle.color.set(profile.colors[Math.floor(Math.random() * profile.colors.length)])
      particle.maxLife = profile.life * (0.78 + Math.random() * 0.44)
      particle.life = particle.maxLife
      this.terrainParticleCursor = (this.terrainParticleCursor + 1) % TERRAIN_PARTICLE_COUNT
    }
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
}

function createLowPolyEarthGeometry(radius: number): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(radius, 6)
  const geometry = source.index ? source.toNonIndexed() : source

  if (geometry !== source) source.dispose()

  const positions = geometry.getAttribute('position')
  const colors = new Float32Array(positions.count * 3)
  const center = new THREE.Vector3()
  const color = new THREE.Color()

  for (let index = 0; index < positions.count; index += 3) {
    center.set(0, 0, 0)
    for (let offset = 0; offset < 3; offset += 1) {
      center.x += positions.getX(index + offset)
      center.y += positions.getY(index + offset)
      center.z += positions.getZ(index + offset)
    }
    center.normalize()

    const terrain = sampleTerrain(center)

    if (terrain.type === 'snow') {
      color.set(terrain.latitude > 0.93 ? 0xf4fbf7 : 0xdcefe5)
    } else if (terrain.type === 'desert') {
      if (terrain.continent < 0.52) {
        color.set(terrain.variation > 0 ? 0xd9c77d : 0xcbb66f)
      } else {
        color.set(terrain.variation > 0 ? 0xd6b66b : 0xcaa45b)
      }
    } else if (terrain.type === 'grass') {
      if (terrain.moisture > 0.35) {
        color.set(terrain.variation > 0 ? 0x4f9f63 : 0x3d8754)
      } else {
        color.set(terrain.variation > 0 ? 0x75ad62 : 0x5d9856)
      }
    } else if (terrain.continent > 0.35) {
      color.set(terrain.variation > 0 ? 0x2d8eb6 : 0x287fa7)
    } else {
      color.set(terrain.variation > 0 ? 0x176d9d : 0x125b8b)
    }

    for (let offset = 0; offset < 3; offset += 1) {
      const colorOffset = (index + offset) * 3
      colors[colorOffset] = color.r
      colors[colorOffset + 1] = color.g
      colors[colorOffset + 2] = color.b
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function terrainParticleProfile(terrain: TerrainType): {
  colors: number[]
  normalSpeed: number
  tangentSpeed: number
  backSpeed: number
  life: number
} {
  if (terrain === 'water') {
    return {
      colors: [0xbfefff, 0xffffff, 0x66c9ef],
      normalSpeed: 1.45,
      tangentSpeed: 1.1,
      backSpeed: 0.35,
      life: 0.55,
    }
  }
  if (terrain === 'desert') {
    return {
      colors: [0xe0c27b, 0xc99f58, 0xf1d69a],
      normalSpeed: 0.45,
      tangentSpeed: 0.95,
      backSpeed: 0.55,
      life: 0.9,
    }
  }
  if (terrain === 'grass') {
    return {
      colors: [0x7ed273, 0xb4e883, 0x3f9e5d],
      normalSpeed: 0.7,
      tangentSpeed: 1.05,
      backSpeed: 0.55,
      life: 0.6,
    }
  }
  return {
    colors: [0xffffff, 0xdff5ff, 0xbfe8ff],
    normalSpeed: 0.38,
    tangentSpeed: 0.65,
    backSpeed: 0.25,
    life: 1.15,
  }
}

function createCartoonSnakeHead(): THREE.Group {
  const group = new THREE.Group()
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0x35c795,
    emissive: 0x11664c,
    emissiveIntensity: 0.12,
    roughness: 0.38,
  })
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 18), skinMaterial)
  face.position.y = -0.08
  face.scale.set(0.92, 1.28, 0.72)
  face.castShadow = true
  group.add(face)

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), skinMaterial.clone())
  snout.position.set(0, 0.42, -0.015)
  snout.scale.set(1.02, 0.78, 0.66)
  snout.castShadow = true
  group.add(snout)

  const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.28 })
  const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x173b35, roughness: 0.2 })

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12), eyeWhiteMaterial.clone())
    eye.position.set(side * 0.235, 0.31, 0.34)
    eye.scale.set(0.92, 0.86, 1.05)
    eye.castShadow = true
    group.add(eye)

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 10), pupilMaterial.clone())
    pupil.position.set(side * 0.235, 0.345, 0.455)
    pupil.scale.set(0.82, 0.94, 0.72)
    group.add(pupil)
  }

  return group
}

function copyVector(target: THREE.Vector3, source: Vector3): THREE.Vector3 {
  return target.set(source.x, source.y, source.z)
}
