import type { CubeFace, EdgeId, FaceId, Vector2, Vector3 } from '../../types/game'

export type { CubeFace, EdgeId, FaceId, Vector2, Vector3 }

export interface CrossFaceResult {
  fromFace: FaceId
  toFace: FaceId
  edge: EdgeId
  position: Vector2
  heading: number
}
