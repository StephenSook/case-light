// Owns: small MeshBuilder helpers (thin-bar boxes, quads, triangles) shared by every line-art mesh.
// Talks to: nothing (pure); used by CaseLightCaseMesh, CaseLightHighlight, CaseLightBundle and CaseLightViewCue.
// Must not: touch the scene beyond creating the mesh object it is asked for (addMeshObject).

/**
 * Layout: position(3), normal(3), color(4); Triangles; UInt16 indices.
 * addBox is the ls-clad mesh-builder-scripting helper with numerically verified CCW winding
 * (copied as written); thin boxes are how CaseLight draws "thin light lines" with a stable
 * world-space width. addQuadZ draws a flat rectangle facing +Z (CCW seen from +Z).
 */

export type RGBA = [number, number, number, number]

export class MeshAccumulator {
  readonly builder: MeshBuilder
  private readonly verts: number[] = []
  private readonly indices: number[] = []
  private count = 0

  constructor() {
    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 }
    ])
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
  }

  get vertexCount(): number {
    return this.count
  }

  /** Axis-aligned box from centre + half extents. Verified CCW winding on all six faces. */
  addBox(cx: number, cy: number, cz: number, hw: number, hh: number, hd: number, color: RGBA): void {
    const x0 = cx - hw, x1 = cx + hw
    const y0 = cy - hh, y1 = cy + hh
    const z0 = cz - hd, z1 = cz + hd
    const face = (p0: number[], p1: number[], p2: number[], p3: number[], n: number[]) => {
      const vi = this.count
      for (const p of [p0, p1, p2, p3]) this.verts.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], color[3])
      this.indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
      this.count += 4
    }
    face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0])
    face([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0])
    face([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0])
    face([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0])
    face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1])
    face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1])
  }

  /** Line along X from x0 to x1 at (y, z), drawn as a thin box of thickness t. */
  lineX(x0: number, x1: number, y: number, z: number, t: number, color: RGBA): void {
    this.addBox((x0 + x1) / 2, y, z, Math.abs(x1 - x0) / 2 + t / 2, t / 2, t / 2, color)
  }

  /** Line along Y from y0 to y1 at (x, z). */
  lineY(x: number, y0: number, y1: number, z: number, t: number, color: RGBA): void {
    this.addBox(x, (y0 + y1) / 2, z, t / 2, Math.abs(y1 - y0) / 2 + t / 2, t / 2, color)
  }

  /** Line along Z from z0 to z1 at (x, y). */
  lineZ(x: number, y: number, z0: number, z1: number, t: number, color: RGBA): void {
    this.addBox(x, y, (z0 + z1) / 2, t / 2, t / 2, Math.abs(z1 - z0) / 2 + t / 2, color)
  }

  /** Rectangle outline in the XY plane at depth z. */
  rectOutline(xMin: number, yMin: number, xMax: number, yMax: number, z: number, t: number, color: RGBA): void {
    this.lineX(xMin, xMax, yMin, z, t, color)
    this.lineX(xMin, xMax, yMax, z, t, color)
    this.lineY(xMin, yMin, yMax, z, t, color)
    this.lineY(xMax, yMin, yMax, z, t, color)
  }

  /** Flat rectangle facing +Z (visible from +Z). */
  addQuadZ(xMin: number, yMin: number, xMax: number, yMax: number, z: number, color: RGBA): void {
    const vi = this.count
    const n = [0, 0, 1]
    for (const p of [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]]) {
      this.verts.push(p[0], p[1], z, n[0], n[1], n[2], color[0], color[1], color[2], color[3])
    }
    this.indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
    this.count += 4
  }

  /** Flat triangle facing +Z; vertices given counter-clockwise as seen from +Z. */
  addTriangleZ(a: number[], b: number[], c: number[], z: number, color: RGBA): void {
    const vi = this.count
    for (const p of [a, b, c]) this.verts.push(p[0], p[1], z, 0, 0, 1, color[0], color[1], color[2], color[3])
    this.indices.push(vi, vi + 1, vi + 2)
    this.count += 3
  }

  /** Upload and return the mesh. Call once, after all shapes are added. */
  finish(): RenderMesh {
    if (this.count > 65000) throw new Error("CaseLightMeshUtil: too many vertices for UInt16 indices: " + this.count)
    this.builder.appendVerticesInterleaved(this.verts)
    this.builder.appendIndices(this.indices)
    this.builder.updateMesh()
    return this.builder.getMesh()
  }
}

/** Create a child SceneObject carrying a RenderMeshVisual for a mesh. */
export function addMeshObject(parent: SceneObject, name: string, mesh: RenderMesh, material: Material): RenderMeshVisual {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = mesh
  if (material) rmv.mainMaterial = material
  return rmv
}
