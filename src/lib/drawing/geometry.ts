import type { Device, Element, Point, Room } from "./types";
import { DEVICE_SIZE } from "./palette";

export function uid(prefix = "el"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function midpoint(a: Point, b: Point): Point {
  return lerp(a, b, 0.5);
}

export function snap(v: number, step = 0.5): number {
  return Math.round(v / step) * step;
}

export function snapPoint(p: Point, step = 0.5): Point {
  return { x: snap(p.x, step), y: snap(p.y, step) };
}

export function orthoSnap(from: Point, to: Point): Point {
  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    return { x: to.x, y: from.y };
  }
  return { x: from.x, y: to.y };
}

export function polylineLength(points: Point[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += dist(points[i - 1]!, points[i]!);
  return n;
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function distToPolyline(p: Point, points: Point[]): number {
  let min = Infinity;
  for (let i = 1; i < points.length; i++) {
    min = Math.min(min, distToSegment(p, points[i - 1]!, points[i]!));
  }
  return min;
}

export function pointInRect(
  p: Point,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function formatLength(units: number, unit: "ft" | "m"): string {
  if (unit === "m") {
    return units >= 10 ? `${units.toFixed(1)} m` : `${units.toFixed(2)} m`;
  }
  const ft = Math.floor(units);
  const inches = Math.round((units - ft) * 12);
  if (inches === 12) return `${ft + 1}'-0"`;
  if (ft === 0) return `${inches}"`;
  return `${ft}'-${inches}"`;
}

export function pullLength(meters: number): number {
  return Math.ceil(meters * 1.15 + 2);
}

export function nearestPoint(p: Point, candidates: Point[], max = 1.25): Point | null {
  let best: Point | null = null;
  let bestD = max;
  for (const c of candidates) {
    const d = dist(p, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function nearestDevice(p: Point, devices: Device[], max = 0.85): Device | null {
  let best: Device | null = null;
  let bestD = max;
  for (const d of devices) {
    if (d.device === "door") continue;
    const n = dist(p, d.pos);
    if (n < bestD) {
      bestD = n;
      best = d;
    }
  }
  return best;
}


export function offsetElement(el: Element, dx: number, dy: number): Element {
  if (dx === 0 && dy === 0) return el;
  if (el.kind === "device" || el.kind === "note") {
    return { ...el, pos: { x: el.pos.x + dx, y: el.pos.y + dy } };
  }
  if (el.kind === "wall") {
    return {
      ...el,
      a: { x: el.a.x + dx, y: el.a.y + dy },
      b: { x: el.b.x + dx, y: el.b.y + dy },
    };
  }
  if (el.kind === "room") {
    return { ...el, x: el.x + dx, y: el.y + dy };
  }
  if (el.kind === "cable" || el.kind === "trunk") {
    return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  }
  return el;
}

export function roomCorners(r: { x: number; y: number; w: number; h: number }): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}

export const ROOM_EDGES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type RoomEdge = (typeof ROOM_EDGES)[number];

export type Handle = {
  id: string;
  pos: Point;
  cursor: string;
};

export function roomHandlePoints(r: Room): Handle[] {
  const { x, y, w, h } = r;
  return [
    { id: "nw", pos: { x, y }, cursor: "nwse-resize" },
    { id: "n", pos: { x: x + w / 2, y }, cursor: "ns-resize" },
    { id: "ne", pos: { x: x + w, y }, cursor: "nesw-resize" },
    { id: "e", pos: { x: x + w, y: y + h / 2 }, cursor: "ew-resize" },
    { id: "se", pos: { x: x + w, y: y + h }, cursor: "nwse-resize" },
    { id: "s", pos: { x: x + w / 2, y: y + h }, cursor: "ns-resize" },
    { id: "sw", pos: { x, y: y + h }, cursor: "nesw-resize" },
    { id: "w", pos: { x, y: y + h / 2 }, cursor: "ew-resize" },
  ];
}

export function deviceRadius(d: Device): number {
  return DEVICE_SIZE[d.device] * 0.55 * (d.scale ?? 1);
}

/** World-metre pick slop — large enough to grab at fit zoom. */
export function devicePickRadius(d: Device, zoom: number): number {
  const body = DEVICE_SIZE[d.device] * 0.75 * (d.scale ?? 1);
  const px = 30 / Math.max(0.2, zoom * 22);
  return Math.max(body, px, 0.65);
}

export function deviceLabelOffset(d: Device): Point {
  const west = d.pos.x < 4.5;
  switch (d.device) {
    case "display":
      return d.pos.y < 8 ? { x: 1.2, y: 0 } : { x: west ? -0.72 : 0.72, y: 0 };
    case "speaker":
      return { x: west ? -0.72 : 0.72, y: 0 };
    case "camera":
      return { x: west ? -0.7 : 0.7, y: 0.22 };
    case "mixer":
      return { x: 0, y: -0.72 };
    case "panel":
      return { x: 0, y: 0.95 };
    case "rack":
      return { x: 0, y: -0.9 };
    default:
      return { x: 0, y: 0.48 };
  }
}

export function handlesFor(el: Element): Handle[] {
  if (el.kind === "room") return roomHandlePoints(el);
  if (el.kind === "wall") {
    return [
      { id: "a", pos: el.a, cursor: "move" },
      { id: "b", pos: el.b, cursor: "move" },
    ];
  }
  if (el.kind === "cable" || el.kind === "trunk") {
    return el.points.map((pos, i) => ({ id: `v${i}`, pos, cursor: "grab" }));
  }
  if (el.kind === "device") {
    const rad = Math.max(deviceRadius(el), 0.32);
    const rot = ((el.rotation ?? 0) * Math.PI) / 180;
    const reach = rad + 0.55;
    const corner = (dx: number, dy: number): Point => ({
      x: el.pos.x + dx * Math.cos(rot) - dy * Math.sin(rot),
      y: el.pos.y + dx * Math.sin(rot) + dy * Math.cos(rot),
    });
    return [
      {
        id: "rotate",
        pos: { x: el.pos.x + Math.sin(rot) * reach, y: el.pos.y - Math.cos(rot) * reach },
        cursor: "grab",
      },
      { id: "scale-se", pos: corner(rad, rad), cursor: "nwse-resize" },
      { id: "scale-nw", pos: corner(-rad, -rad), cursor: "nwse-resize" },
      { id: "scale-ne", pos: corner(rad, -rad), cursor: "nesw-resize" },
      { id: "scale-sw", pos: corner(-rad, rad), cursor: "nesw-resize" },
    ];
  }
  return [];
}

export function nearestHandle(el: Element, world: Point, max: number): Handle | null {
  let best: Handle | null = null;
  let bestD = max;
  for (const h of handlesFor(el)) {
    const d = dist(world, h.pos);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

export function roomEdgeHit(world: Point, r: Room, edgeTol = 0.45): boolean {
  const c = roomCorners(r);
  for (let i = 0; i < 4; i++) {
    if (distToSegment(world, c[i]!, c[(i + 1) % 4]!) < edgeTol) return true;
  }
  const label = { x: r.x + r.w / 2, y: r.y + r.h * 0.3 };
  return dist(world, label) < 1.5;
}

export function resizeRect(
  r: { x: number; y: number; w: number; h: number },
  edge: string,
  p: Point,
  min = 0.5,
): { x: number; y: number; w: number; h: number } {
  let x1 = r.x;
  let y1 = r.y;
  let x2 = r.x + r.w;
  let y2 = r.y + r.h;
  if (edge === "w" || edge === "nw" || edge === "sw") x1 = p.x;
  if (edge === "e" || edge === "ne" || edge === "se") x2 = p.x;
  if (edge === "n" || edge === "nw" || edge === "ne") y1 = p.y;
  if (edge === "s" || edge === "sw" || edge === "se") y2 = p.y;
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.max(min, Math.abs(x2 - x1)), h: Math.max(min, Math.abs(y2 - y1)) };
}

export function applyHandle(
  el: Element,
  handle: string,
  world: Point,
  opts: { snap: boolean; ortho: boolean },
): Element {
  const p = opts.snap ? snapPoint(world, 0.5) : world;
  if (el.kind === "room" && ROOM_EDGES.includes(handle as RoomEdge)) {
    const next = resizeRect(el, handle, p);
    return { ...el, ...next };
  }
  if (el.kind === "wall") {
    const other = handle === "a" ? el.b : el.a;
    const q = opts.ortho ? orthoSnap(other, p) : p;
    return handle === "a" ? { ...el, a: q } : { ...el, b: q };
  }
  if ((el.kind === "cable" || el.kind === "trunk") && handle.startsWith("v")) {
    const index = Number(handle.slice(1));
    if (!Number.isFinite(index) || !el.points[index]) return el;
    const prev = el.points[index - 1] ?? el.points[index + 1];
    const q = opts.ortho && prev ? orthoSnap(prev, p) : p;
    const points = el.points.map((pt, i) => (i === index ? q : pt));
    return { ...el, points };
  }
  if (el.kind === "device" && handle === "rotate") {
    let deg = (Math.atan2(p.x - el.pos.x, el.pos.y - p.y) * 180) / Math.PI;
    if (opts.snap) deg = Math.round(deg / 15) * 15;
    else deg = Math.round(deg);
    return { ...el, rotation: ((deg % 360) + 360) % 360 };
  }
  if (el.kind === "device" && handle.startsWith("scale")) {
    const rad = Math.max(deviceRadius(el), 0.32);
    const corner = rad * Math.SQRT2;
    const next = (dist(p, el.pos) / Math.max(0.2, corner)) * (el.scale ?? 1);
    const scale = Math.max(0.4, Math.min(5, next));
    return { ...el, scale: Math.round(scale * 20) / 20 };
  }
  return el;
}
