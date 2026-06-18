import type { CubeFace, EdgeId, FaceId, Vector2, Vector3 } from '../../types/game'
import type { CrossFaceResult } from './topologyTypes'

const CUBE_HALF = 1

export const cubeFaces: Record<FaceId, CubeFace> = {
  front: {
    id: 'front',
    label: '前面',
    normal: { x: 0, y: 0, z: 1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    neighbors: { north: 'top', east: 'right', south: 'bottom', west: 'left' },
  },
  right: {
    id: 'right',
    label: '右面',
    normal: { x: 1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
    neighbors: { north: 'top', east: 'back', south: 'bottom', west: 'front' },
  },
  back: {
    id: 'back',
    label: '背面',
    normal: { x: 0, y: 0, z: -1 },
    right: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    neighbors: { north: 'top', east: 'left', south: 'bottom', west: 'right' },
  },
  left: {
    id: 'left',
    label: '左面',
    normal: { x: -1, y: 0, z: 0 },
    right: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    neighbors: { north: 'top', east: 'front', south: 'bottom', west: 'back' },
  },
  top: {
    id: 'top',
    label: '上面',
    normal: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: -1 },
    neighbors: { north: 'back', east: 'right', south: 'front', west: 'left' },
  },
  bottom: {
    id: 'bottom',
    label: '下面',
    normal: { x: 0, y: -1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    neighbors: { north: 'front', east: 'right', south: 'back', west: 'left' },
  },
}

export const cubeFaceIds: FaceId[] = ['front', 'right', 'back', 'left', 'top', 'bottom']
export const cubeEdgeIds: EdgeId[] = ['north', 'east', 'south', 'west']

export function getCrossedEdge(position: Vector2, halfSize: number): EdgeId | undefined {
  const overflow = {
    north: position.y - halfSize,
    east: position.x - halfSize,
    south: -halfSize - position.y,
    west: -halfSize - position.x,
  }
  const entries = Object.entries(overflow).filter(([, amount]) => amount > 0) as Array<[EdgeId, number]>

  if (entries.length === 0) {
    return undefined
  }

  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

export function getNeighbor(faceId: FaceId, edge: EdgeId): FaceId {
  return cubeFaces[faceId].neighbors[edge]
}

export function mapAcrossCubeEdge(
  fromFace: FaceId,
  edge: EdgeId,
  position: Vector2,
  heading: number,
  halfSize: number,
): CrossFaceResult {
  const toFace = getNeighbor(fromFace, edge)
  const worldPosition = localToWorld(fromFace, position, halfSize)
  const nudgedWorldPosition = add3(worldPosition, scale3(cubeFaces[toFace].normal, 0.001))
  const mappedPosition = worldToLocal(toFace, nudgedWorldPosition, halfSize)
  const worldDirection = headingToWorldDirection(fromFace, heading)
  const mappedHeading = worldDirectionToHeading(toFace, foldDirectionAcrossEdge(fromFace, edge, worldDirection))

  return {
    fromFace,
    toFace,
    edge,
    position: clampLocal(mappedPosition, halfSize - 0.08),
    heading: mappedHeading,
  }
}

export function localToWorld(faceId: FaceId, position: Vector2, halfSize = CUBE_HALF): Vector3 {
  const face = cubeFaces[faceId]

  return add3(
    scale3(face.normal, halfSize),
    add3(scale3(face.right, position.x), scale3(face.up, position.y)),
  )
}

export function worldToLocal(faceId: FaceId, world: Vector3, halfSize = CUBE_HALF): Vector2 {
  const face = cubeFaces[faceId]
  const fromCenter = sub3(world, scale3(face.normal, halfSize))

  return {
    x: dot3(fromCenter, face.right),
    y: dot3(fromCenter, face.up),
  }
}

export function headingToWorldDirection(faceId: FaceId, heading: number): Vector3 {
  const face = cubeFaces[faceId]

  return normalize3(add3(scale3(face.right, Math.cos(heading)), scale3(face.up, Math.sin(heading))))
}

export function worldDirectionToHeading(faceId: FaceId, direction: Vector3): number {
  const face = cubeFaces[faceId]
  const tangent = normalize3(sub3(direction, scale3(face.normal, dot3(direction, face.normal))))

  return Math.atan2(dot3(tangent, face.up), dot3(tangent, face.right))
}

function foldDirectionAcrossEdge(fromFace: FaceId, edge: EdgeId, direction: Vector3): Vector3 {
  const face = cubeFaces[fromFace]
  const edgeAxis = edge === 'north' || edge === 'south' ? face.right : face.up
  const outward =
    edge === 'north'
      ? face.up
      : edge === 'south'
        ? scale3(face.up, -1)
        : edge === 'east'
          ? face.right
          : scale3(face.right, -1)
  const alongAmount = dot3(direction, edgeAxis)
  const outwardAmount = dot3(direction, outward)
  const inwardOnNextFace = scale3(face.normal, -1)

  return normalize3(add3(scale3(edgeAxis, alongAmount), scale3(inwardOnNextFace, Math.max(0.01, outwardAmount))))
}

function clampLocal(position: Vector2, halfSize: number): Vector2 {
  return {
    x: Math.min(Math.max(position.x, -halfSize), halfSize),
    y: Math.min(Math.max(position.y, -halfSize), halfSize),
  }
}

function add3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function sub3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function scale3(v: Vector3, amount: number): Vector3 {
  return { x: v.x * amount, y: v.y * amount, z: v.z * amount }
}

function dot3(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function normalize3(v: Vector3): Vector3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1

  return { x: v.x / length, y: v.y / length, z: v.z / length }
}
