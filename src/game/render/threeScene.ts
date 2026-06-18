import * as THREE from 'three'
import type { BarrierState, EdgeId, FaceId, Food, FoodType, GameState, Vector2, Vector3 } from '../../types/game'
import { getBarrierStates } from '../engine/levels'
import { getSnakeSegments } from '../engine/movement'
import { cubeEdgeIds, cubeFaceIds, cubeFaces, localToWorld } from '../polyhedron/cubeTopology'
import { gameSettings } from '../settings'

export class ThreeGameScene {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140)
  private readonly renderer: THREE.WebGLRenderer
  private readonly faceMeshes = new Map<FaceId, THREE.Mesh>()
  private readonly gridMeshes = new Map<FaceId, THREE.GridHelper>()
  private readonly barrierMeshes = new Map<EdgeId, THREE.Mesh>()
  private readonly barrierOpenAmounts = new Map<EdgeId, number>()
  private readonly snakeGroup = new THREE.Group()
  private readonly foodMeshes = new Map<string, THREE.Mesh>()
  private readonly sparkleMeshes: THREE.Mesh[] = []
  private readonly headMesh: THREE.Mesh
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x79ddb8,
    emissive: 0x1e7a5b,
    emissiveIntensity: 0.08,
    roughness: 0.5,
  })
  private readonly bodyMeshes: THREE.Mesh[] = []
  private readonly cameraLookAt = new THREE.Vector3()
  private readonly resizeObserver: ResizeObserver
  private readonly container: HTMLElement
  private disposed = false

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0xf8fcff, 1)
    this.renderer.shadowMap.enabled = true
    this.container.append(this.renderer.domElement)

    this.scene.background = new THREE.Color(0xf8fcff)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x91c7d6, 2.45))

    const keyLight = new THREE.DirectionalLight(0xffffff, 3)
    keyLight.position.set(10, 14, 12)
    keyLight.castShadow = true
    this.scene.add(keyLight)

    this.createCube()
    this.createBarriers()
    this.createSparkles()

    this.headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 20),
      new THREE.MeshStandardMaterial({
        color: 0x34c995,
        emissive: 0x13694f,
        emissiveIntensity: 0.12,
        roughness: 0.34,
      }),
    )
    this.headMesh.castShadow = true
    this.snakeGroup.add(this.headMesh)
    this.scene.add(this.snakeGroup)

    this.camera.position.set(0, 18, 18)
    this.camera.up.set(0, 0, 1)
    this.camera.lookAt(0, 0, 0)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.resize()
  }

  update(state: GameState): void {
    const halfSize = state.config.planeSize / 2
    const activeFace = state.snake.faceId
    const activeNormal = toThree(cubeFaces[activeFace].normal)
    const activeFaceInfo = cubeFaces[activeFace]
    const activeUp = toThree(activeFaceInfo.up)
    const activeRight = toThree(activeFaceInfo.right)
    const headWorld = this.toWorld(activeFace, state.snake.head, halfSize, 0.52)

    this.updateFaces(state)
    this.updateBarriers(getBarrierStates(state), activeFace, halfSize)
    this.updateSnake(state, halfSize)

    this.updateFoods(state, halfSize)
    this.updateSparkles(state, halfSize)

    const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(gameSettings.cameraPitch, 28, 86))
    const distance = THREE.MathUtils.clamp(gameSettings.cameraDistance, 12, 36)
    const cameraHeight = Math.sin(pitch) * distance
    const groundOffset = Math.cos(pitch) * distance
    const sideOffset = groundOffset * 0.38
    const target = headWorld
      .clone()
      .add(activeNormal.clone().multiplyScalar(-0.25))
      .add(activeUp.clone().multiplyScalar(Math.max(1.2, groundOffset * 0.16)))
    const cameraTarget = headWorld
      .clone()
      .add(activeNormal.clone().multiplyScalar(cameraHeight))
      .add(activeUp.clone().multiplyScalar(groundOffset))
      .add(activeRight.clone().multiplyScalar(sideOffset))

    const transitionBlend = state.faceTransition ? 0.022 : 0.105
    const lookBlend = state.faceTransition ? 0.034 : 0.16

    this.camera.position.lerp(cameraTarget, transitionBlend)
    this.cameraLookAt.lerp(target, lookBlend)
    this.camera.up.lerp(activeNormal, lookBlend).normalize()
    this.camera.lookAt(this.cameraLookAt)
    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.resizeObserver.disconnect()
    this.renderer.dispose()
    this.scene.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh

      if (mesh.geometry) {
        mesh.geometry.dispose()
      }

      const material = mesh.material

      if (Array.isArray(material)) {
        material.forEach((entry) => entry.dispose())
      } else if (material) {
        material.dispose()
      }
    })
    this.renderer.domElement.remove()
  }

  private createCube(): void {
    const size = 18

    cubeFaceIds.forEach((faceId) => {
      const material = new THREE.MeshStandardMaterial({
        color: 0xb8f1dd,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material)

      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(faceMatrix(faceId, size / 2))
      this.scene.add(mesh)
      this.faceMeshes.set(faceId, mesh)

      const grid = new THREE.GridHelper(size, 18, 0x89d5bf, 0xe7fff4)
      grid.matrixAutoUpdate = false
      grid.matrix.copy(faceMatrix(faceId, size / 2 + 0.01, true))
      this.scene.add(grid)
      this.gridMeshes.set(faceId, grid)
    })
  }

  private createBarriers(): void {
    cubeEdgeIds.forEach((edge) => {
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.18, 1, 8, 16),
        new THREE.MeshStandardMaterial({
          color: 0x74ccb0,
          emissive: 0x1b7b62,
          emissiveIntensity: 0.08,
          roughness: 0.38,
        }),
      )

      mesh.castShadow = true
      mesh.matrixAutoUpdate = false
      this.scene.add(mesh)
      this.barrierMeshes.set(edge, mesh)
      this.barrierOpenAmounts.set(edge, 0)
    })
  }

  private createSparkles(): void {
    const material = new THREE.MeshStandardMaterial({
      color: 0xfff6a8,
      emissive: 0xffdf8f,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      transparent: true,
      opacity: 0.78,
    })

    for (let index = 0; index < 34; index += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), material.clone())
      mesh.visible = false
      mesh.castShadow = false
      this.sparkleMeshes.push(mesh)
      this.scene.add(mesh)
    }
  }

  private updateFaces(state: GameState): void {
    cubeFaceIds.forEach((faceId) => {
      const mesh = this.faceMeshes.get(faceId)
      const grid = this.gridMeshes.get(faceId)
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined

      if (!mesh || !grid || !material) {
        return
      }

      if (state.faces[faceId] === 'active') {
        material.color.set(0xb7f5df)
        material.emissive.set(0x3fc69a)
        material.emissiveIntensity = 0.08
        grid.visible = true
      } else if (state.faceTransition?.fromFace === faceId) {
        material.color.set(0xc9f8e9)
        material.emissive.set(0x35b98e)
        material.emissiveIntensity = 0.05
        grid.visible = true
      } else if (state.faces[faceId] === 'completed') {
        material.color.set(0xb3c1bd)
        material.emissive.set(0x000000)
        material.emissiveIntensity = 0
        grid.visible = false
      } else {
        material.color.set(0xe0fbef)
        material.emissive.set(0x000000)
        material.emissiveIntensity = 0
        grid.visible = false
      }
    })
  }

  private updateBarriers(barriers: BarrierState[], faceId: FaceId, halfSize: number): void {
    barriers.forEach((barrier) => {
      const mesh = this.barrierMeshes.get(barrier.edge)
      const material = mesh?.material as THREE.MeshStandardMaterial | undefined

      if (!mesh || !material) {
        return
      }

      const previousOpenAmount = this.barrierOpenAmounts.get(barrier.edge) ?? 0
      const openAmount = THREE.MathUtils.lerp(previousOpenAmount, barrier.open ? 1 : 0, 0.18)

      this.barrierOpenAmounts.set(barrier.edge, openAmount)
      mesh.visible = true
      mesh.matrix.copy(barrierMatrix(faceId, barrier.edge, halfSize, openAmount))
      material.color.set(barrier.open ? 0x6be1ba : barrier.permanent ? 0x9ba4a3 : 0x74ccb0)
      material.emissive.set(barrier.open ? 0x41cfa3 : 0x246b5b)
      material.emissiveIntensity = barrier.open ? 0.28 : barrier.permanent ? 0.02 : 0.08
    })
  }

  private updateSnake(state: GameState, halfSize: number): void {
    const renderSnake = state.faceTransition?.previousSnake ?? state.snake
    const renderFaceId = state.faceTransition?.fromFace ?? state.snake.faceId
    const segments = getSnakeSegments(renderSnake, state.config.segmentSpacing)

    this.ensureBodyMeshes(Math.max(0, segments.length - 1))
    this.headMesh.position.copy(this.toWorld(renderFaceId, clampVector2(renderSnake.head, halfSize - state.config.snakeRadius), halfSize, 0.52))

    for (let index = 1; index < segments.length; index += 1) {
      const segment = segments[index]
      const mesh = this.bodyMeshes[index - 1]
      const scale = 1 - Math.min(index / segments.length, 0.45)
      const renderSegment = clampVector2(segment, halfSize - state.config.snakeRadius)
      const wiggle = state.faceTransition ? 0 : Math.sin(state.elapsed * 8 + index * 0.45) * 0.015

      mesh.visible = true
      mesh.position.copy(this.toWorld(renderFaceId, renderSegment, halfSize, 0.46))
      mesh.scale.setScalar(Math.max(0.58, scale + wiggle))
    }

    for (let index = segments.length - 1; index < this.bodyMeshes.length; index += 1) {
      this.bodyMeshes[index].visible = false
    }
  }

  private updateFoods(state: GameState, halfSize: number): void {
    const liveFoodIds = new Set(state.foods.map((food) => food.id))

    this.foodMeshes.forEach((mesh, foodId) => {
      if (!liveFoodIds.has(foodId)) {
        this.scene.remove(mesh)
        mesh.geometry.dispose()
        disposeMaterial(mesh.material)
        this.foodMeshes.delete(foodId)
      }
    })

    state.foods.forEach((food) => {
      const mesh = this.getFoodMesh(food)
      const lift = food.temporary ? 0.42 : 0.5
      const pulse = Math.sin(state.elapsed * getFoodPulse(food.type) + food.position.x) * 0.07

      mesh.visible = state.faces[food.faceId] !== 'completed'
      mesh.position.copy(this.toWorld(food.faceId, food.position, halfSize, lift + pulse))
      mesh.rotation.x += 0.01
      mesh.rotation.y += 0.025
      mesh.scale.setScalar((food.temporary ? 0.78 : 1) * (1 + Math.sin(state.elapsed * 4.2 + food.position.y) * 0.035))
    })
  }

  private updateSparkles(state: GameState, halfSize: number): void {
    const hasRainbowShield = state.activeEffects.some((effect) => effect.type === 'rainbowShield')
    const hasSuperPotion = state.activeEffects.some((effect) => effect.type === 'superPotion')

    const showStatusBurst = state.status === 'failed' || state.status === 'won'

    if (!hasRainbowShield && !hasSuperPotion && !showStatusBurst) {
      this.sparkleMeshes.forEach((mesh) => {
        mesh.visible = false
      })
      return
    }

    const activeFace = state.snake.faceId
    const normal = toThree(cubeFaces[activeFace].normal)
    const up = toThree(cubeFaces[activeFace].up)
    const right = toThree(cubeFaces[activeFace].right)
    const center = this.toWorld(activeFace, state.snake.head, halfSize, 0.75)
      const palette = state.status === 'failed'
      ? [0xff93ad, 0xffc7d6, 0xffffff]
      : state.status === 'won'
        ? [0xffe597, 0x9bf0d2, 0xffffff]
        : hasRainbowShield
          ? [0xff99c8, 0xffe28a, 0x9bd7ff, 0xb69cff]
          : [0x8cf1dd, 0xb1fff1, 0xfff4a8]

    this.sparkleMeshes.forEach((mesh, index) => {
      const material = mesh.material as THREE.MeshStandardMaterial
      const t = state.elapsed * (hasSuperPotion ? 2.2 : 1.55) + index * 0.74
      const radius = state.status === 'playing' ? (hasSuperPotion ? 2.4 : 1.15) : 2.8
      const wave = Math.sin(t * 1.7) * 0.24
      const offset = right
        .clone()
        .multiplyScalar(Math.cos(t) * radius)
        .add(up.clone().multiplyScalar(Math.sin(t * 0.8) * radius * 0.7))
        .add(normal.clone().multiplyScalar(0.25 + wave + (index % 5) * 0.03))

      mesh.visible = showStatusBurst || index < (hasSuperPotion ? 34 : 22)
      mesh.position.copy(center.clone().add(offset))
      mesh.scale.setScalar(0.85 + Math.sin(t * 2.5) * 0.22)
      material.color.set(palette[index % palette.length])
      material.emissive.set(palette[index % palette.length])
      material.opacity = state.status === 'playing' ? 0.62 : 0.78
    })
  }

  private getFoodMesh(food: Food): THREE.Mesh {
    const existing = this.foodMeshes.get(food.id)

    if (existing) {
      return existing
    }

    const mesh = new THREE.Mesh(createFoodGeometry(food.type), createFoodMaterial(food.type, food.temporary))

    mesh.castShadow = true
    this.scene.add(mesh)
    this.foodMeshes.set(food.id, mesh)

    return mesh
  }

  private toWorld(faceId: FaceId, position: Vector2, halfSize: number, lift: number): THREE.Vector3 {
    const face = cubeFaces[faceId]
    const base = localToWorld(faceId, position, halfSize)
    const normal = face.normal

    return new THREE.Vector3(base.x + normal.x * lift, base.y + normal.y * lift, base.z + normal.z * lift)
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private ensureBodyMeshes(count: number): void {
    while (this.bodyMeshes.length < count) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), this.bodyMaterial)
      mesh.castShadow = true
      this.bodyMeshes.push(mesh)
      this.snakeGroup.add(mesh)
    }
  }
}

function faceMatrix(faceId: FaceId, halfSize: number, grid = false): THREE.Matrix4 {
  const face = cubeFaces[faceId]
  const right = toThree(face.right)
  const up = toThree(grid ? face.normal : face.up)
  const normal = toThree(grid ? scale3(face.up, -1) : face.normal)
  const position = toThree(scale3(face.normal, halfSize))

  return new THREE.Matrix4().makeBasis(right, up, normal).setPosition(position)
}

function barrierMatrix(faceId: FaceId, edge: EdgeId, halfSize: number, openAmount: number): THREE.Matrix4 {
  const face = cubeFaces[faceId]
  const along = edge === 'north' || edge === 'south' ? face.right : face.up
  const across = edge === 'north' ? face.up : edge === 'south' ? scale3(face.up, -1) : edge === 'east' ? face.right : scale3(face.right, -1)
  const center = edgeCenter(edge, halfSize)
  const base = localToWorld(faceId, center, halfSize)
  const lift = 0.74 - openAmount * 0.56
  const position = toThree(add3(base, scale3(face.normal, lift)))
  const matrix = new THREE.Matrix4().makeBasis(toThree(across), toThree(along), toThree(face.normal)).setPosition(position)
  const scale = new THREE.Matrix4().makeScale(1, halfSize * 2, 1 - openAmount * 0.38)

  return matrix.multiply(scale)
}

function edgeCenter(edge: EdgeId, halfSize: number): Vector2 {
  if (edge === 'north') {
    return { x: 0, y: halfSize }
  }

  if (edge === 'south') {
    return { x: 0, y: -halfSize }
  }

  if (edge === 'east') {
    return { x: halfSize, y: 0 }
  }

  return { x: -halfSize, y: 0 }
}

function toThree(v: Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z)
}

function add3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function scale3(v: Vector3, amount: number): Vector3 {
  return { x: v.x * amount, y: v.y * amount, z: v.z * amount }
}

function clampVector2(position: Vector2, halfSize: number): Vector2 {
  return {
    x: THREE.MathUtils.clamp(position.x, -halfSize, halfSize),
    y: THREE.MathUtils.clamp(position.y, -halfSize, halfSize),
  }
}

function createFoodGeometry(type: FoodType): THREE.BufferGeometry {
  if (type === 'feast') {
    return new THREE.CapsuleGeometry(0.34, 0.3, 8, 20)
  }

  if (type === 'speedUp') {
    return new THREE.ConeGeometry(0.38, 0.72, 5)
  }

  if (type === 'slowDown') {
    return new THREE.CapsuleGeometry(0.3, 0.18, 8, 18)
  }

  if (type === 'cluster') {
    return new THREE.DodecahedronGeometry(0.42, 0)
  }

  if (type === 'rainbowCandy') {
    return new THREE.TorusKnotGeometry(0.24, 0.08, 48, 8)
  }

  if (type === 'superPotion') {
    return new THREE.CapsuleGeometry(0.26, 0.42, 8, 16)
  }

  return new THREE.SphereGeometry(0.35, 28, 18)
}

function createFoodMaterial(type: FoodType, temporary: boolean): THREE.MeshStandardMaterial {
  const colorByType: Record<FoodType, number> = {
    normal: 0xff7aa8,
    feast: 0xffc36c,
    speedUp: 0xffe66d,
    slowDown: 0xa7cdfa,
    cluster: 0xf5a0d8,
    rainbowCandy: 0xa98bff,
    superPotion: 0x65decf,
  }
  const color = colorByType[type]

  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: temporary ? 0.1 : type === 'superPotion' || type === 'rainbowCandy' ? 0.45 : 0.22,
    roughness: 0.34,
    transparent: temporary,
    opacity: temporary ? 0.72 : 1,
  })
}

function getFoodPulse(type: FoodType): number {
  return type === 'superPotion' || type === 'rainbowCandy' ? 7 : 5
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose())
    return
  }

  material.dispose()
}
