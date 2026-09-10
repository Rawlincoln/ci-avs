import type { Device, Point, Viewport } from "./types";
import { DEVICE_SIZE } from "./palette";

export type Vec3 = { x: number; y: number; z: number };

export type Cam3 = {
  pos: Vec3;
  target: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  focal: number;
  cx: number;
  cy: number;
  dist: number;
};

export type Proj = { x: number; y: number; z: number };

/** Pitch 0 ≈ 35° architectural elevation. Full range: eye-level ↔ top-down. */
export const PITCH_MIN = -0.54;
export const PITCH_MAX = 0.94;
const BASE_ELEV = 0.62;

export function elevation(cam: Viewport): number {
  return Math.min(1.545, Math.max(0.06, BASE_ELEV + (cam.pitch || 0)));
}

export function orbitDistance(zoom: number): number {
  return Math.max(4.2, 30 / Math.max(0.18, zoom));
}

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

export function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function norm(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

/** World plan (x east, y south) + height → 3D (X east, Y up, Z south). */
export function world3(p: Point, height = 0): Vec3 {
  return { x: p.x, y: height, z: p.y };
}

export function makeCam3(cam: Viewport, origin: Point): Cam3 {
  const elev = elevation(cam);
  const yaw = cam.yaw || 0;
  const dist = orbitDistance(cam.zoom);
  const target: Vec3 = { x: cam.x, y: 0, z: cam.y };
  const a = yaw;
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  const pos: Vec3 = {
    x: target.x + dist * ce * Math.sin(a),
    y: target.y + dist * se,
    z: target.z + dist * ce * Math.cos(a),
  };
  const forward = norm(sub(target, pos));
  const worldUp = v3(0, 1, 0);
  let right = cross(forward, worldUp);
  if (len(right) < 1e-5) right = v3(1, 0, 0);
  else right = norm(right);
  const up = cross(right, forward);
  const focal = Math.max(240, origin.y / Math.tan(0.38));
  return { pos, target, right, up, forward, focal, cx: origin.x, cy: origin.y, dist };
}

export function project3(p: Vec3, c: Cam3): Proj | null {
  const rel = sub(p, c.pos);
  const vz = dot(rel, c.forward);
  if (vz < 0.18) return null;
  const vx = dot(rel, c.right);
  const vy = dot(rel, c.up);
  return {
    x: c.cx + (vx * c.focal) / vz,
    y: c.cy - (vy * c.focal) / vz,
    z: vz,
  };
}

export function unprojectFloor(screen: Point, cam: Viewport, origin: Point): Point {
  const c = makeCam3(cam, origin);
  const nx = (screen.x - c.cx) / c.focal;
  const ny = (c.cy - screen.y) / c.focal;
  const dir = norm(add(add(c.forward, scale(c.right, nx)), scale(c.up, ny)));
  if (Math.abs(dir.y) < 1e-4) {
    const t = c.dist * 0.55;
    return { x: c.pos.x + dir.x * t, y: c.pos.z + dir.z * t };
  }
  const t = -c.pos.y / dir.y;
  if (t < 0.08) {
    const t2 = Math.max(0.4, c.dist * 0.45);
    return { x: c.pos.x + dir.x * t2, y: c.pos.z + dir.z * t2 };
  }
  return { x: c.pos.x + dir.x * t, y: c.pos.z + dir.z * t };
}

export function depthOf(p: Point, cam: Viewport): number {
  const a = (cam.yaw || 0) + Math.PI / 4;
  const dx = p.x - cam.x;
  const dz = p.y - cam.y;
  return dx * Math.sin(a) + dz * Math.cos(a);
}

/** Top of the unit in metres (mount-aware). */
export function deviceTop(d: Device): number {
  if (d.mount === "ceiling") {
    if (d.device === "speaker") return 3.05;
    if (d.device === "display") return 2.75;
    if (d.device === "camera") return 2.95;
    if (d.device === "neatbar") return 2.65;
    return 2.8;
  }
  if (d.mount === "wall") {
    if (d.device === "display") return 2.12;
    if (d.device === "neatbar") return 1.05;
    if (d.device === "stagebox") return 1.18;
    if (d.device === "jbox" || d.device === "dibox") return 1.15;
    if (d.device === "splitter") return 0.42;
    if (d.device === "datajack" || d.device === "outlet") return 1.05;
    if (d.device === "panel") return 1.6;
    if (d.device === "amp") return 0.45;
    if (d.device === "dsp") return 0.42;
    if (d.device === "camera") return 2.4;
  }
  switch (d.device) {
    case "display":
      return 1.85;
    case "speaker":
      return 1.55;
    case "rack":
      return 2.0;
    case "mixer":
      return 0.92;
    case "camera":
      return 2.4;
    case "neatbar":
      return 1.55;
    case "monitor":
      return 1.22;
    case "pdu":
      return 1.7;
    case "panel":
      return 1.6;
    case "datajack":
    case "outlet":
      return 1.05;
    case "amp":
      return 0.45;
    case "dsp":
      return 0.42;
    default:
      return 0.9;
  }
}

export type BoxSpec = { w: number; h: number; d: number };

export function deviceBox(d: Device): BoxSpec {
  const s = DEVICE_SIZE[d.device] * (d.scale ?? 1);
  switch (d.device) {
    case "display":
      return { w: s, h: s * 0.58, d: 0.1 };
    case "monitor":
      return { w: 0.55, h: 0.36, d: 0.08 };
    case "neatbar":
      return { w: s, h: 0.1, d: 0.08 };
    case "speaker":
      return { w: 0.28, h: 0.46, d: 0.28 };
    case "rack":
      return { w: 0.6, h: 2.0, d: 0.85 };
    case "mixer":
      return { w: 0.9, h: 0.16, d: 0.58 };
    case "camera":
      return { w: 0.2, h: 0.16, d: 0.26 };
    case "outlet":
      return { w: 0.11, h: 0.11, d: 0.05 };
    case "datajack":
      return { w: 0.09, h: 0.14, d: 0.04 };
    case "mic":
      return { w: 0.08, h: 0.32, d: 0.08 };
    case "drums":
      return { w: 1.1, h: 0.85, d: 1.1 };
    case "keys":
      return { w: 1.2, h: 0.12, d: 0.4 };
    case "stagebox":
      return { w: 0.48, h: 0.14, d: 0.32 };
    case "zoompc":
      return { w: 0.42, h: 0.08, d: 0.28 };
    case "netswitch":
      return { w: 0.44, h: 0.05, d: 0.22 };
    case "pdu":
      return { w: 0.48, h: 0.09, d: 0.12 };
    case "panel":
      return { w: 0.55, h: 0.7, d: 0.12 };
    case "amp":
      return { w: 0.48, h: 0.09, d: 0.32 };
    case "dsp":
      return { w: 0.44, h: 0.08, d: 0.26 };
    default:
      return { w: Math.max(0.16, s * 0.42), h: Math.max(0.08, s * 0.22), d: Math.max(0.14, s * 0.32) };
  }
}

export function deviceBase(d: Device): number {
  const box = deviceBox(d);
  const top = deviceTop(d);
  if (d.mount === "ceiling") return Math.max(0, top - box.h);
  if (d.mount === "wall") return Math.max(0, top - box.h);
  return Math.max(0, top - box.h);
}

const LIGHT = norm(v3(0.42, 0.78, -0.46));

export function lit(normal: Vec3, ambient = 0.34): number {
  return ambient + (1 - ambient) * Math.max(0, dot(norm(normal), LIGHT));
}
