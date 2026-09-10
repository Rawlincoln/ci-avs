import {
  CABLE_COLOR,
  CABLE_DASH,
  CABLE_WIDTH,
  CONTRACT_EDGE,
  DEVICE_SIZE,
  GRID_MAJOR,
  GRID_MINOR,
  HOVER,
  INK,
  INK_MUTED,
  NIC_HATCH,
  PAPER,
  PREVIEW,
  ROOM_CONTRACT,
  ROOM_NIC,
  SELECT,
  TRUNK_FILL,
  TRUNK_STROKE,
  WALL_FILL,
} from "./palette";
import { dist, formatLength, midpoint, polylineLength, handlesFor, roomCorners, deviceLabelOffset, offsetElement, type Handle } from "./geometry";
import {
  deviceBase,
  deviceBox,
  deviceTop,
  elevation,
  lit,
  makeCam3,
  PITCH_MAX,
  PITCH_MIN,
  project3,
  unprojectFloor,
  v3,
  world3,
  type Cam3,
  type Proj,
  type Vec3,
} from "./camera3d";
import { getUnderlayImage } from "./underlay";
import {
  CABLE_META,
  DEFAULT_VIEWPORT,
  DEVICE_META,
  PX_PER_UNIT,
  normalizeViewport,
  type Cable,
  type CableKind,
  type Device,
  type DeviceKind,
  type Drawing,
  type DrawingMeta,
  type Element,
  type LayerId,
  type MountKind,
  type Point,
  type Room,
  type Trunk,
  type Underlay,
  type ViewMode,
  type Viewport,
  type Wall,
} from "./types";

export type Camera = Viewport;
export type Note = Extract<Element, { kind: "note" }>;

type RenderOpts = {
  width: number;
  height: number;
  selectedId?: string | null;
  hoverId?: string | null;
  preview?: { points: Point[]; kind: "wall" | "cable" | "room" | "measure"; cable?: CableKind } | null;
  showGrid?: boolean;
  showLengths?: boolean;
  dpr?: number;
  /** Cable tool: ring snap targets in this colour. */
  routeKind?: CableKind | null;
  anchorId?: string | null;
  liveDrag?: { id: string; dx: number; dy: number } | null;
  onUnderlayReady?: () => void;
};

/** Overview tags: only the pieces an architect would call out. The rest appear on hover, select, or zoom. */
function deviceShowsTag(d: Device, cam: Camera, selected: boolean, hover: boolean, routing = false) {
  if (!d.label) return false;
  if (selected || hover || routing) return true;
  if (cam.zoom > 1.55) return true;
  return (
    d.device === "display" ||
    d.device === "speaker" ||
    d.device === "camera" ||
    d.device === "mixer" ||
    d.device === "panel" ||
    d.device === "rack"
  );
}

export const ISO_W = Math.sqrt(3) / 2;
export const ISO_D = .5;
export { PITCH_MIN, PITCH_MAX };
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 6;
export function worldToScreen(p: Point, cam: Camera): Point {
	const s = cam.zoom * PX_PER_UNIT;
	const dx = p.x - cam.x;
	const dy = p.y - cam.y;
	const rot = cam.rotation || 0;
	if (!rot) return {
		x: dx * s,
		y: dy * s
	};
	const c = Math.cos(rot);
	const sn = Math.sin(rot);
	return {
		x: (dx * c - dy * sn) * s,
		y: (dx * sn + dy * c) * s
	};
}
export function screenToWorld(p: Point, cam: Camera): Point {
	const s = cam.zoom * PX_PER_UNIT;
	const dx = p.x / s;
	const dy = p.y / s;
	const rot = cam.rotation || 0;
	if (!rot) return {
		x: dx + cam.x,
		y: dy + cam.y
	};
	const c = Math.cos(rot);
	const sn = Math.sin(rot);
	return {
		x: dx * c + dy * sn + cam.x,
		y: -dx * sn + dy * c + cam.y
	};
}
export function isoOrigin(width: number, height: number): Point {
	return {
		x: width * .5,
		y: height * .58
	};
}
export function worldToIso(p: Point, z: number, cam: Camera, origin: Point): Point {
	const s = project3(world3(p, z), makeCam3(cam, origin));
	return s ?? { x: -8000, y: -8000 };
}
export function isoToWorld(p: Point, cam: Camera, origin: Point): Point {
	return unprojectFloor(p, cam, origin);
}
export function unproject(screen: Point, cam: Camera, mode: ViewMode, origin: Point): Point {
	return mode === "iso" ? isoToWorld(screen, cam, origin) : screenToWorld(screen, cam);
}
/** Keep a world point glued to a screen pixel after changing zoom / angles. */
export function placeWorldAt(cam: Camera, mode: ViewMode, world: Point, screen: Point, origin: Point): Camera {
	const originWorld = unproject(screen, {
		...cam,
		x: 0,
		y: 0
	}, mode, origin);
	return normalizeViewport({
		...cam,
		x: world.x - originWorld.x,
		y: world.y - originWorld.y
	});
}
export function zoomCamera(cam: Camera, mode: ViewMode, width: number, height: number, zoom: number, screen?: Point): Camera {
	const nextZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
	const origin = isoOrigin(width, height);
	const pivot = screen ?? {
		x: width / 2,
		y: height / 2
	};
	const world = unproject(pivot, cam, mode, origin);
	return placeWorldAt({
		...cam,
		zoom: nextZoom
	}, mode, world, pivot, origin);
}
export function orbitCamera(cam: Camera, mode: ViewMode, width: number, height: number, dYaw: number, dPitch = 0, screen?: Point): Camera {
	const origin = isoOrigin(width, height);
	const pivot = screen ?? {
		x: width / 2,
		y: height / 2
	};
	const world = unproject(pivot, cam, mode, origin);
	if (mode === "iso") {
		const yaw = (cam.yaw || 0) + dYaw;
		const pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, (cam.pitch || 0) + dPitch));
		return placeWorldAt({
			...cam,
			yaw,
			pitch
		}, mode, world, pivot, origin);
	}
	return placeWorldAt({
		...cam,
		rotation: (cam.rotation || 0) + dYaw
	}, mode, world, pivot, origin);
}
export function panCamera(cam: Camera, mode: ViewMode, from: Point, to: Point, width: number, height: number): Camera {
	const origin = isoOrigin(width, height);
	const w0 = unproject(from, cam, mode, origin);
	const w1 = unproject(to, cam, mode, origin);
	return normalizeViewport({
		...cam,
		x: cam.x - (w1.x - w0.x),
		y: cam.y - (w1.y - w0.y)
	});
}
export function panByPixels(cam: Camera, mode: ViewMode, width: number, height: number, dx: number, dy: number): Camera {
	return panCamera(cam, mode, {
		x: 0,
		y: 0
	}, {
		x: dx,
		y: dy
	}, width, height);
}
export function projectPoint(p: Point, cam: Camera, mode: ViewMode, origin: Point, z = 0): Point {
	return mode === "iso" ? worldToIso(p, z, cam, origin) : worldToScreen(p, cam);
}
export function northScreenAngle(cam: Camera, mode: ViewMode, width: number, height: number): number {
	if (mode === "iso") {
		const origin = isoOrigin(width, height);
		const a = worldToIso({
			x: cam.x,
			y: cam.y
		}, 0, cam, origin);
		const b = worldToIso({
			x: cam.x,
			y: cam.y - 1
		}, 0, cam, origin);
		return Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
	}
	return cam.rotation || 0;
}
export function elementLayer(el: Element): LayerId {
	if (el.kind === "wall" || el.kind === "room") return "architecture";
	if (el.kind === "note") return "notes";
	if (el.kind === "trunk") return "data";
	if (el.kind === "cable") return CABLE_META[el.cable].layer;
	return DEVICE_META[el.device].layer;
}
function setDash(ctx: CanvasRenderingContext2D, dash: number[], zoom: number) {
	ctx.setLineDash(dash.map((d) => d * Math.max(.6, zoom)));
}
export function renderDrawing(ctx: CanvasRenderingContext2D, drawing: Drawing, cam: Camera, opts: RenderOpts) {
	const { width, height, selectedId, hoverId, preview, showGrid = true, showLengths = false, routeKind = null, anchorId = null, liveDrag = null } = opts;
	if (liveDrag && (liveDrag.dx || liveDrag.dy)) {
		drawing = {
			...drawing,
			elements: drawing.elements.map((el) => (el.id === liveDrag.id ? offsetElement(el, liveDrag.dx, liveDrag.dy) : el)),
		};
	}
	ctx.save();
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, width, height);
	if (showGrid) drawGrid(ctx, cam, width, height);
	if (drawing.underlay) drawUnderlay(ctx, drawing.underlay, cam, opts.onUnderlayReady);
	const layers = drawing.layers;
	const rooms = drawing.elements.filter((e): e is Room => e.kind === "room");
	const walls = drawing.elements.filter((e): e is Wall => e.kind === "wall");
	const cables = drawing.elements.filter((e): e is Cable => e.kind === "cable");
	const trunks = drawing.elements.filter((e): e is Trunk => e.kind === "trunk");
	const devices = drawing.elements.filter((e): e is Device => e.kind === "device");
	const notes = drawing.elements.filter((e): e is Note => e.kind === "note");
	if (layers.architecture) for (const r of rooms) drawRoom(ctx, r, cam, r.id === selectedId, r.id === hoverId);
	if (layers.data) for (const t of trunks) drawTrunk(ctx, t, cam, t.id === selectedId, t.id === hoverId);
	if (layers.power || layers.data || layers.av) for (const c of cables) {
		if (!layers[elementLayer(c)]) continue;
		drawCable(ctx, c, cam, c.id === selectedId, c.id === hoverId, showLengths, drawing.meta.unit);
	}
	if (layers.architecture) for (const w of walls) drawWall(ctx, w, cam, w.id === selectedId, w.id === hoverId);
	for (const d of devices) {
		if (!layers[elementLayer(d)]) continue;
		drawDevice(ctx, d, cam, d.id === selectedId, d.id === hoverId, routeKind, d.id === anchorId);
	}
	if (layers.notes) for (const n of notes) drawNote(ctx, n, cam, n.id === selectedId, n.id === hoverId);
	if (preview) drawPreview(ctx, preview, cam, drawing.meta.unit);
	if (selectedId) {
		const selected = drawing.elements.find((e) => e.id === selectedId);
		if (selected && (selected.kind !== "device" || cam.zoom > 1.4)) {
			drawHandles(ctx, selected, (p) => worldToScreen(p, cam));
		}
	}
	ctx.restore();
}

function drawUnderlay(ctx: CanvasRenderingContext2D, u: Underlay, cam: Camera, onReady?: () => void) {
	const img = getUnderlayImage(u.src, onReady);
	if (!img) return;
	const a = worldToScreen({ x: u.x, y: u.y }, cam);
	const b = worldToScreen({ x: u.x + u.w, y: u.y + u.h }, cam);
	ctx.save();
	ctx.globalAlpha = u.opacity;
	ctx.drawImage(img, a.x, a.y, b.x - a.x, b.y - a.y);
	ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number) {
	const step = 22 * cam.zoom;
	if (step < 5) return;
	const corners = [
		screenToWorld({
			x: 0,
			y: 0
		}, cam),
		screenToWorld({
			x: w,
			y: 0
		}, cam),
		screenToWorld({
			x: w,
			y: h
		}, cam),
		screenToWorld({
			x: 0,
			y: h
		}, cam)
	];
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of corners) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const x0 = Math.floor(minX);
	const x1 = Math.ceil(maxX);
	const y0 = Math.floor(minY);
	const y1 = Math.ceil(maxY);
	if (x1 - x0 > 240 || y1 - y0 > 240) return;
	const strokeSet = (xs: number[], ys: number[], color: string) => {
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		for (const x of xs) {
			const a = worldToScreen({
				x,
				y: y0
			}, cam);
			const b = worldToScreen({
				x,
				y: y1
			}, cam);
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
		}
		for (const y of ys) {
			const a = worldToScreen({
				x: x0,
				y
			}, cam);
			const b = worldToScreen({
				x: x1,
				y
			}, cam);
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
		}
		ctx.stroke();
	};
	const minorX: number[] = [];
	const minorY: number[] = [];
	const majorX: number[] = [];
	const majorY: number[] = [];
	for (let x = x0; x <= x1; x++) (x % 5 === 0 ? majorX : minorX).push(x);
	for (let y = y0; y <= y1; y++) (y % 5 === 0 ? majorY : minorY).push(y);
	if (step >= 8) strokeSet(minorX, minorY, GRID_MINOR);
	if (step * 5 >= 18) strokeSet(majorX, majorY, GRID_MAJOR);
}
function pathPoly(ctx: CanvasRenderingContext2D, pts: Point[]) {
	ctx.beginPath();
	ctx.moveTo(pts[0].x, pts[0].y);
	for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
	ctx.closePath();
}
function hatchPoly(ctx: CanvasRenderingContext2D, pts: Point[]) {
	ctx.save();
	pathPoly(ctx, pts);
	ctx.clip();
	ctx.strokeStyle = NIC_HATCH;
	ctx.lineWidth = 1;
	const minX = Math.min(...pts.map((p) => p.x));
	const maxX = Math.max(...pts.map((p) => p.x));
	const minY = Math.min(...pts.map((p) => p.y));
	const maxY = Math.max(...pts.map((p) => p.y));
	const span = maxY - minY;
	for (let i = minX - span; i < maxX; i += 16) {
		ctx.beginPath();
		ctx.moveTo(i, minY);
		ctx.lineTo(i + span, maxY);
		ctx.stroke();
	}
	ctx.restore();
}
function drawRoom(ctx: CanvasRenderingContext2D, r: Room, cam: Camera, selected: boolean, hover: boolean) {
	const pts = roomCorners(r).map((p) => worldToScreen(p, cam));
	const nic = r.scope !== "contract";
	pathPoly(ctx, pts);
	ctx.fillStyle = selected ? "rgba(138, 106, 59, 0.16)" : hover ? HOVER : nic ? ROOM_NIC : ROOM_CONTRACT;
	ctx.fill();
	if (nic) hatchPoly(ctx, pts);
	if (!nic) {
		const inset = .14;
		pathPoly(ctx, roomCorners({
			x: r.x + inset,
			y: r.y + inset,
			w: r.w - inset * 2,
			h: r.h - inset * 2
		}).map((p) => worldToScreen(p, cam)));
		ctx.strokeStyle = CONTRACT_EDGE;
		ctx.lineWidth = Math.max(1.1, 1.2 * cam.zoom);
		ctx.setLineDash([]);
		ctx.stroke();
	}
	const nameAt = worldToScreen({
		x: r.x + r.w / 2,
		y: r.y + r.h * (nic ? 0.5 : 0.28)
	}, cam);
	const size = nic
		? Math.max(9, 9.5 * Math.min(1.1, cam.zoom))
		: Math.max(11, 12.5 * Math.min(1.15, cam.zoom));
	ctx.font = `${nic ? "500" : "600"} ${size}px "IBM Plex Sans", system-ui, sans-serif`;
	ctx.letterSpacing = "0.22em";
	ctx.fillStyle = nic ? "rgba(107, 101, 92, 0.5)" : INK_MUTED;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(r.name.toUpperCase(), nameAt.x, nameAt.y);
	ctx.letterSpacing = "0px";
}
function drawTrunk(ctx: CanvasRenderingContext2D, t: Trunk, cam: Camera, selected: boolean, hover: boolean) {
	if (t.points.length < 2) return;
	const width = Math.max(7, 8.5 * cam.zoom);
	ctx.lineCap = "butt";
	ctx.lineJoin = "miter";
	ctx.setLineDash([]);
	ctx.beginPath();
	const s0 = worldToScreen(t.points[0]!, cam);
	ctx.moveTo(s0.x, s0.y);
	for (let i = 1; i < t.points.length; i++) {
		const s = worldToScreen(t.points[i]!, cam);
		ctx.lineTo(s.x, s.y);
	}
	ctx.strokeStyle = selected ? "rgba(138, 106, 59, 0.45)" : hover ? "rgba(138, 131, 118, 0.55)" : TRUNK_FILL;
	ctx.lineWidth = width;
	ctx.stroke();
	ctx.strokeStyle = selected ? SELECT : TRUNK_STROKE;
	ctx.lineWidth = Math.max(1.1, 1.2 * cam.zoom);
	ctx.stroke();
	if (t.label && (selected || hover || cam.zoom > 1.1)) {
		const mid = t.points[Math.floor(t.points.length / 2)] ?? t.points[0]!;
		const sm = worldToScreen(mid, cam);
		drawHaloLabel(ctx, sm.x, sm.y, t.label, TRUNK_STROKE, cam.zoom);
	}
}
function drawWall(ctx: CanvasRenderingContext2D, w: Wall, cam: Camera, selected: boolean, hover: boolean) {
	const a = worldToScreen(w.a, cam);
	const b = worldToScreen(w.b, cam);
	ctx.strokeStyle = selected ? SELECT : hover ? "#4a453e" : WALL_FILL;
	ctx.lineWidth = Math.max(3, 3.6 * cam.zoom);
	ctx.lineCap = "square";
	ctx.lineJoin = "miter";
	ctx.setLineDash([]);
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	ctx.lineTo(b.x, b.y);
	ctx.stroke();
}
function drawCable(ctx: CanvasRenderingContext2D, c: Cable, cam: Camera, selected: boolean, hover: boolean, showLengths: boolean, unit: "ft" | "m") {
	if (c.points.length < 2) return;
	const color = selected ? SELECT : CABLE_COLOR[c.cable];
	const weight = CABLE_WIDTH[c.cable];
	ctx.strokeStyle = color;
	ctx.lineWidth = selected || hover ? Math.max(2.4, (weight + .5) * cam.zoom) : Math.max(1.5, weight * cam.zoom);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.globalAlpha = hover && !selected ? .88 : 1;
	setDash(ctx, CABLE_DASH[c.cable], cam.zoom);
	ctx.beginPath();
	const s0 = worldToScreen(c.points[0], cam);
	ctx.moveTo(s0.x, s0.y);
	for (let i = 1; i < c.points.length; i++) {
		const s = worldToScreen(c.points[i], cam);
		ctx.lineTo(s.x, s.y);
	}
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
	const start = worldToScreen(c.points[0], cam);
	const end = worldToScreen(c.points[c.points.length - 1], cam);
	drawCap(ctx, start, color, cam.zoom);
	drawCap(ctx, end, color, cam.zoom);
	if (selected || hover || showLengths && cam.zoom > .7) {
		const len = polylineLength(c.points);
		const sm = worldToScreen(cableLabelPoint(c.points), cam);
		const label = showLengths ? c.label ? `${c.label}  ${formatLength(len, unit)}` : formatLength(len, unit) : c.label;
		if (label) drawHaloLabel(ctx, sm.x, sm.y, label, color, cam.zoom);
	}
	if (selected) for (const p of c.points) {
		const s = worldToScreen(p, cam);
		ctx.fillStyle = PAPER;
		ctx.strokeStyle = SELECT;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
}
function cableLabelPoint(points: Point[]): Point {
	const total = polylineLength(points);
	let acc = 0;
	const half = total / 2;
	for (let i = 1; i < points.length; i++) {
		const d = dist(points[i - 1], points[i]);
		if (acc + d >= half) {
			const t = d === 0 ? 0 : (half - acc) / d;
			return {
				x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
				y: points[i - 1].y + (points[i].y - points[i - 1].y) * t
			};
		}
		acc += d;
	}
	return points[Math.floor(points.length / 2)];
}
function drawCap(ctx: CanvasRenderingContext2D, p: Point, color: string, zoom: number) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(p.x, p.y, Math.max(2.2, 2.4 * zoom), 0, Math.PI * 2);
	ctx.fill();
}
function drawHandles(ctx: CanvasRenderingContext2D, el: Element, project: (p: Point) => Point) {
	ctx.save();
	const origin = el.kind === "device" ? project(el.pos) : null;
	for (const h of handlesFor(el)) {
		const s = project(h.pos);
		ctx.strokeStyle = SELECT;
		ctx.fillStyle = PAPER;
		ctx.lineWidth = 1.5;
		if (h.id === "rotate") {
			if (origin) {
				ctx.beginPath();
				ctx.moveTo(origin.x, origin.y);
				ctx.lineTo(s.x, s.y);
				ctx.stroke();
			}
			ctx.beginPath();
			ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			continue;
		}
		ctx.beginPath();
		ctx.rect(s.x - 4.5, s.y - 4.5, 9, 9);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}
export function pickHandle(el: Element, screen: Point, cam: Camera, mode: ViewMode, origin: Point): Handle | null {
	const z = el.kind === "device" ? (mode === "iso" ? deviceTop(el) : 1.2) : 0;
	const center = el.kind === "device" ? projectPoint(el.pos, cam, mode, origin, z) : null;
	const distCenter = center ? Math.hypot(center.x - screen.x, center.y - screen.y) : Number.POSITIVE_INFINITY;
	let best: Handle | null = null;
	let bestD = el.kind === "device" ? 18 : 8;
	for (const h of handlesFor(el)) {
		const s = projectPoint(h.pos, cam, mode, origin, z);
		const d = Math.hypot(s.x - screen.x, s.y - screen.y);
		if (d > bestD) continue;
		if (center && d > distCenter - 4) continue;
		bestD = d;
		best = h;
	}
	return best;
}

export function hitDeviceAtScreen(
	devices: Device[],
	screen: Point,
	cam: Camera,
	mode: ViewMode,
	origin: Point,
): Device | null {
	let best: Device | null = null;
	let bestD = Infinity;
	for (let i = devices.length - 1; i >= 0; i--) {
		const d = devices[i]!;
		if (d.device === "door") continue;
		const z = mode === "iso" ? deviceTop(d) : 0;
		const s = projectPoint(d.pos, cam, mode, origin, z);
		const glyph = DEVICE_SIZE[d.device] * 0.55 * (d.scale ?? 1) * cam.zoom * PX_PER_UNIT;
		const rad = Math.max(22, glyph + 10);
		const distPx = Math.hypot(s.x - screen.x, s.y - screen.y);
		if (distPx <= rad && distPx < bestD) {
			best = d;
			bestD = distPx;
		}
		if (d.label) {
			const o = deviceLabelOffset(d);
			const lab = projectPoint({ x: d.pos.x + o.x, y: d.pos.y + o.y }, cam, mode, origin, z);
			const ld = Math.hypot(lab.x - screen.x, lab.y - screen.y);
			if (ld <= 26 && ld < bestD) {
				best = d;
				bestD = ld;
			}
		}
	}
	return best;
}
function drawHaloLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, zoom: number) {
	ctx.font = `500 ${Math.max(9, 10 * Math.min(1.3, zoom))}px "IBM Plex Mono", ui-monospace, monospace`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.lineWidth = 4;
	ctx.strokeStyle = PAPER;
	ctx.strokeText(text, x, y - 8);
	ctx.fillStyle = color;
	ctx.fillText(text, x, y - 8);
}
function drawDevice(ctx: CanvasRenderingContext2D, d: Device, cam: Camera, selected: boolean, hover: boolean, routeKind: CableKind | null = null, anchored = false) {
	const s = worldToScreen(d.pos, cam);
	const body = cam.zoom * (d.scale ?? 1);
	ctx.save();
	ctx.translate(s.x, s.y);
	ctx.rotate((cam.rotation || 0) + d.rotation * Math.PI / 180);
	const pad = DEVICE_SIZE[d.device] * .6 * PX_PER_UNIT * body;
	if (routeKind && d.device !== "door") {
		ctx.beginPath();
		ctx.strokeStyle = anchored ? CABLE_COLOR[routeKind] : hover ? CABLE_COLOR[routeKind] : "rgba(26,25,22,0.16)";
		ctx.lineWidth = anchored || hover ? 2 : 1;
		ctx.setLineDash(anchored ? [] : hover ? [] : [2, 2]);
		ctx.arc(0, 0, pad * 1.05, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
		if (hover || anchored) {
			ctx.beginPath();
			ctx.fillStyle = hover ? CABLE_COLOR[routeKind] : CABLE_COLOR[routeKind];
			ctx.globalAlpha = 0.16;
			ctx.arc(0, 0, pad * 1.05, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
	} else if (selected) {
		ctx.beginPath();
		ctx.strokeStyle = SELECT;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([3, 2]);
		ctx.strokeRect(-pad, -pad, pad * 2, pad * 2);
		ctx.setLineDash([]);
	} else if (hover) {
		ctx.beginPath();
		ctx.fillStyle = HOVER;
		ctx.arc(0, 0, pad, 0, Math.PI * 2);
		ctx.fill();
	}
	strokeSymbol(ctx, d, body);
	ctx.restore();
	if (deviceShowsTag(d, cam, selected, hover, Boolean(routeKind))) {
		drawDeviceTag(ctx, d, s, cam);
	}
}

function drawDeviceTag(ctx: CanvasRenderingContext2D, d: Device, screen: Point, cam: Camera) {
	const off = deviceLabelOffset(d);
	const px = off.x * PX_PER_UNIT * cam.zoom;
	const py = off.y * PX_PER_UNIT * cam.zoom;
	const tx = screen.x + px;
	const ty = screen.y + py;
	ctx.font = `500 ${Math.max(9, 9.5 * Math.min(1.2, cam.zoom))}px "IBM Plex Sans", system-ui, sans-serif`;
	ctx.textAlign = px < -2 ? "right" : px > 2 ? "left" : "center";
	ctx.textBaseline = "middle";
	ctx.lineWidth = 3.5;
	ctx.strokeStyle = PAPER;
	ctx.fillStyle = INK;
	ctx.strokeText(d.label, tx, ty);
	ctx.fillText(d.label, tx, ty);
}
function strokeSymbol(ctx: CanvasRenderingContext2D, d: Device, zoom: number) {
	const u = PX_PER_UNIT * zoom;
	ctx.strokeStyle = INK;
	ctx.fillStyle = PAPER;
	ctx.lineWidth = Math.max(1.3, 1.4 * zoom);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.setLineDash([]);
	switch (d.device) {
		case "outlet": {
			const r = .26 * u;
			ctx.beginPath();
			ctx.arc(0, 0, r, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-r * .34, 0, r * .16, 0, Math.PI * 2);
			ctx.arc(r * .34, 0, r * .16, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
			break;
		}
		case "switch": {
			const s = .38 * u;
			ctx.beginPath();
			ctx.rect(-s, -s, s * 2, s * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, s * .55);
			ctx.lineTo(0, -s * .15);
			ctx.lineTo(s * .35, -s * .45);
			ctx.stroke();
			break;
		}
		case "panel": {
			const w = 1.1 * u;
			const h = 1.6 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-w / 2 + 4, -h / 4);
			ctx.lineTo(w / 2 - 4, -h / 4);
			ctx.moveTo(-w / 2 + 4, 0);
			ctx.lineTo(w / 2 - 4, 0);
			ctx.moveTo(-w / 2 + 4, h / 4);
			ctx.lineTo(w / 2 - 4, h / 4);
			ctx.stroke();
			break;
		}
		case "rack": {
			const w = 1.2 * u;
			const h = 1.8 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			for (let i = -3; i <= 3; i++) {
				ctx.beginPath();
				ctx.moveTo(-w / 2 + 3, i * h / 8);
				ctx.lineTo(w / 2 - 3, i * h / 8);
				ctx.stroke();
			}
			break;
		}
		case "camera":
			ctx.beginPath();
			ctx.moveTo(-.15 * u, -.28 * u);
			ctx.lineTo(.28 * u, 0);
			ctx.lineTo(-.15 * u, .28 * u);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-.22 * u, 0, .16 * u, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			break;
		case "jbox": {
			const s = .38 * u;
			ctx.beginPath();
			ctx.rect(-s, -s, s * 2, s * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-s * .55, -s * .55);
			ctx.lineTo(s * .55, s * .55);
			ctx.moveTo(s * .55, -s * .55);
			ctx.lineTo(-s * .55, s * .55);
			ctx.stroke();
			break;
		}
		case "datajack": {
			const s = .22 * u;
			ctx.beginPath();
			ctx.roundRect(-s, -s * 1.15, s * 2, s * 2.3, 2);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = INK;
			ctx.beginPath();
			ctx.roundRect(-s * .42, -s * .55, s * .84, s * .42, 1);
			ctx.fill();
			ctx.beginPath();
			ctx.roundRect(-s * .42, s * .08, s * .84, s * .42, 1);
			ctx.fill();
			break;
		}
		case "pdu": {
			const w = .5 * u;
			const h = 1.4 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			break;
		}
		case "door": {
			const len = .9 * u;
			ctx.strokeStyle = INK;
			ctx.lineWidth = Math.max(1.4, 1.6 * zoom);
			ctx.beginPath();
			ctx.moveTo(-len * .15, 0);
			ctx.lineTo(len, 0);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, len, -Math.PI / 2, 0);
			ctx.stroke();
			break;
		}
		case "display": {
			const w = 1.5 * u;
			const h = .5 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			break;
		}
		case "speaker":
			ctx.beginPath();
			ctx.moveTo(-.28 * u, .38 * u);
			ctx.lineTo(-.18 * u, -.38 * u);
			ctx.lineTo(.18 * u, -.38 * u);
			ctx.lineTo(.28 * u, .38 * u);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, .05 * u, .12 * u, 0, Math.PI * 2);
			ctx.stroke();
			break;
		case "mixer": {
			const w = 1.35 * u;
			const h = .85 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			for (let i = -3; i <= 3; i++) {
				ctx.beginPath();
				ctx.moveTo(i * w / 9, -h / 2 + 4);
				ctx.lineTo(i * w / 9, h / 2 - 4);
				ctx.stroke();
			}
			break;
		}
		case "stagebox": {
			const w = .95 * u;
			const h = .55 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			break;
		}
		case "neatbar": {
			const w = 1.35 * u;
			const h = .28 * u;
			ctx.beginPath();
			ctx.roundRect(-w / 2, -h / 2, w, h, 3);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, .08 * u, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
			break;
		}
		case "neatpad": {
			const s = .28 * u;
			ctx.beginPath();
			ctx.roundRect(-s, -s * 1.3, s * 2, s * 2.6, 3);
			ctx.fill();
			ctx.stroke();
			break;
		}
		case "mic":
			ctx.beginPath();
			ctx.ellipse(0, -.12 * u, .12 * u, .18 * u, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, .06 * u);
			ctx.lineTo(0, .32 * u);
			ctx.stroke();
			break;
		case "drums":
			ctx.beginPath();
			ctx.arc(-.18 * u, .1 * u, .28 * u, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(.22 * u, -.05 * u, .16 * u, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(.05 * u, .28 * u, .12 * u, 0, Math.PI * 2);
			ctx.stroke();
			break;
		case "keys": {
			const w = 1.2 * u;
			const h = .4 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			for (let i = 0; i < 7; i++) {
				ctx.beginPath();
				ctx.moveTo(-w / 2 + (i + 1) * w / 8, -h / 2);
				ctx.lineTo(-w / 2 + (i + 1) * w / 8, h / 2);
				ctx.stroke();
			}
			break;
		}
		case "amp": {
			const w = 1.05 * u;
			const h = .42 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-w / 2 + 4, 0);
			ctx.lineTo(w / 2 - 4, 0);
			ctx.stroke();
			break;
		}
		case "dsp": {
			const w = .85 * u;
			const h = .5 * u;
			ctx.beginPath();
			ctx.roundRect(-w / 2, -h / 2, w, h, 3);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-w / 4, 0, .08 * u, 0, Math.PI * 2);
			ctx.arc(w / 4, 0, .08 * u, 0, Math.PI * 2);
			ctx.fillStyle = INK;
			ctx.fill();
			break;
		}
		case "splitter": {
			const w = .85 * u;
			const h = .48 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-w / 2 - .12 * u, 0);
			ctx.lineTo(-w / 2, 0);
			ctx.stroke();
			for (const y of [-.14, 0, .14]) {
				ctx.beginPath();
				ctx.moveTo(w / 2, y * u);
				ctx.lineTo(w / 2 + .14 * u, y * u);
				ctx.stroke();
			}
			break;
		}
		case "dibox": {
			const w = .72 * u;
			const h = .48 * u;
			ctx.beginPath();
			ctx.roundRect(-w / 2, -h / 2, w, h, 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-w * .22, 0, .1 * u, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(w * .22, 0, .1 * u, 0, Math.PI * 2);
			ctx.stroke();
			break;
		}
		default: {
			const w = .85 * u;
			const h = .5 * u;
			ctx.beginPath();
			ctx.rect(-w / 2, -h / 2, w, h);
			ctx.fill();
			ctx.stroke();
			if (d.device === "netswitch") {
				for (let i = -3; i <= 3; i++) {
					ctx.beginPath();
					ctx.rect(i * w / 10 - .04 * u, h / 2 - .12 * u, .08 * u, .12 * u);
					ctx.fillStyle = INK;
					ctx.fill();
				}
			}
			break;
		}
	}
	if (d.mount === "ceiling") {
		ctx.beginPath();
		ctx.strokeStyle = INK_MUTED;
		ctx.setLineDash([3, 2]);
		ctx.arc(0, 0, .55 * u, 0, Math.PI * 2);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

/** Sheet-key / palette mark — same geometry as the plan, fitted into a square. */
export function paintDeviceGlyph(
  ctx: CanvasRenderingContext2D,
  kind: DeviceKind,
  mount: MountKind | undefined,
  size: number,
) {
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const zoom = size / (PX_PER_UNIT * 2.05);
  strokeSymbol(
    ctx,
    {
      id: "glyph",
      kind: "device",
      device: kind,
      pos: { x: 0, y: 0 },
      rotation: 0,
      label: "",
      mount,
    },
    zoom,
  );
  ctx.restore();
}

function drawNote(ctx: CanvasRenderingContext2D, n: Note, cam: Camera, selected: boolean, hover: boolean) {
	const s = worldToScreen(n.pos, cam);
	const lines = n.text.split("\n");
	const size = Math.max(10, 11 * Math.min(1.15, cam.zoom));
	ctx.font = `400 ${size}px "IBM Plex Sans", system-ui, sans-serif`;
	const width = Math.max(...lines.map((l) => ctx.measureText(l).width));
	const pad = 8;
	const h = lines.length * size * 1.35 + 16;
	const w = width + 16;
	ctx.fillStyle = selected ? "rgba(243, 238, 228, 0.96)" : "rgba(243, 238, 228, 0.88)";
	ctx.strokeStyle = selected ? SELECT : hover ? INK_MUTED : "rgba(26,25,22,0.16)";
	ctx.lineWidth = 1;
	roundRect(ctx, s.x, s.y, w, h, 4);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = INK;
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	lines.forEach((line, i) => {
		ctx.fillText(line, s.x + pad, s.y + pad + i * size * 1.35);
	});
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}
function drawPreview(ctx: CanvasRenderingContext2D, preview: NonNullable<RenderOpts["preview"]>, cam: Camera, unit: "ft" | "m") {
	if (preview.kind === "room" && preview.points.length >= 2) {
		const a = preview.points[0];
		const b = preview.points[1];
		pathPoly(ctx, roomCorners({
			x: Math.min(a.x, b.x),
			y: Math.min(a.y, b.y),
			w: Math.abs(b.x - a.x),
			h: Math.abs(b.y - a.y)
		}).map((p) => worldToScreen(p, cam)));
		ctx.strokeStyle = PREVIEW;
		ctx.fillStyle = "rgba(138, 106, 59, 0.1)";
		ctx.lineWidth = 1.5;
		ctx.setLineDash([6, 4]);
		ctx.fill();
		ctx.stroke();
		ctx.setLineDash([]);
		return;
	}
	if (preview.points.length < 2) {
		const p = worldToScreen(preview.points[0], cam);
		ctx.fillStyle = PREVIEW;
		ctx.beginPath();
		ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
		ctx.fill();
		return;
	}
	ctx.strokeStyle = preview.kind === "cable" && preview.cable ? CABLE_COLOR[preview.cable] : PREVIEW;
	ctx.lineWidth = preview.kind === "wall" ? Math.max(4, 6 * cam.zoom) : 2;
	ctx.lineCap = "round";
	if (preview.kind === "cable" && preview.cable) setDash(ctx, CABLE_DASH[preview.cable], cam.zoom);
	else ctx.setLineDash([6, 4]);
	ctx.beginPath();
	const s0 = worldToScreen(preview.points[0], cam);
	ctx.moveTo(s0.x, s0.y);
	for (let i = 1; i < preview.points.length; i++) {
		const s = worldToScreen(preview.points[i], cam);
		ctx.lineTo(s.x, s.y);
	}
	ctx.stroke();
	ctx.setLineDash([]);
	const len = polylineLength(preview.points);
	const last = preview.points[preview.points.length - 1];
	const prev = preview.points[preview.points.length - 2];
	const sm = worldToScreen(midpoint(prev, last), cam);
	drawHaloLabel(ctx, sm.x, sm.y, formatLength(len, unit), INK, cam.zoom);
}
export function renderExportCanvas(drawing: Drawing, cam: Camera, width: number, height: number, viewMode: ViewMode = "plan", dpr = 2): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(width * dpr));
	canvas.height = Math.max(1, Math.round(height * dpr));
	const ctx = canvas.getContext("2d");
	if (!ctx) return canvas;
	ctx.scale(dpr, dpr);
	if (viewMode === "iso") renderIso(ctx, drawing, cam, {
		width,
		height,
		showLengths: false
	});
	else renderDrawing(ctx, drawing, cam, {
		width,
		height,
		showGrid: true,
		showLengths: false
	});
	drawTitleBlock(ctx, drawing, width, height);
	return canvas;
}
export function titleBlockLayout(width: number, height: number) {
	const w = 280;
	const h = 92;
	const x = width - w - 16;
	const y = height - h - 16;
	const fields: { field: keyof DrawingMeta; x: number; y: number; w: number; h: number }[] = [
		{ field: "drawingNo", x: x + w - 118, y: y + 4, w: 108, h: 22 },
		{ field: "title", x: x + 8, y: y + 32, w: 264, h: 22 },
		{ field: "project", x: x + 8, y: y + 52, w: 264, h: 18 },
		{ field: "scaleLabel", x: x + 8, y: y + 70, w: 90, h: 18 },
		{ field: "date", x: x + 100, y: y + 70, w: 110, h: 18 },
	];
	return {
		box: { x, y, w, h },
		fields,
	};
}
export function hitTitleField(local: Point, width: number, height: number): keyof DrawingMeta | null {
	const layout = titleBlockLayout(width, height);
	if (!pointInRectScreen(local, layout.box)) return null;
	for (const f of layout.fields) if (pointInRectScreen(local, f)) return f.field;
	return "title";
}
function pointInRectScreen(p: Point, r: { x: number; y: number; w: number; h: number }) {
	return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
export function drawTitleBlock(ctx: CanvasRenderingContext2D, drawing: Drawing, width: number, height: number) {
	const w = 280;
	const h = 92;
	const x = width - w - 16;
	const y = height - h - 16;
	ctx.fillStyle = "rgba(243, 238, 228, 0.94)";
	ctx.strokeStyle = INK;
	ctx.lineWidth = 1.25;
	ctx.fillRect(x, y, w, h);
	ctx.strokeRect(x, y, w, h);
	ctx.beginPath();
	ctx.moveTo(x, y + 28);
	ctx.lineTo(x + w, y + 28);
	ctx.stroke();
	ctx.fillStyle = INK;
	ctx.font = `600 13px "IBM Plex Sans", sans-serif`;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillText("CI AVS", x + 28, y + 14);
	drawTitleNorth(ctx, x + 14, y + 14);
	ctx.font = `400 10px "IBM Plex Mono", monospace`;
	ctx.fillStyle = INK_MUTED;
	ctx.textAlign = "right";
	ctx.fillText(drawing.meta.drawingNo, x + w - 10, y + 14);
	ctx.textAlign = "left";
	ctx.fillStyle = INK;
	ctx.font = `500 12px "IBM Plex Sans", sans-serif`;
	ctx.fillText(drawing.meta.title, x + 10, y + 44);
	ctx.font = `400 10px "IBM Plex Sans", sans-serif`;
	ctx.fillStyle = INK_MUTED;
	ctx.fillText(drawing.meta.project, x + 10, y + 62);
	ctx.font = `400 10px "IBM Plex Mono", monospace`;
	ctx.fillText(`${drawing.meta.scaleLabel}   ${drawing.meta.date}`, x + 10, y + 78);
}
function drawTitleNorth(ctx: CanvasRenderingContext2D, x: number, y: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.fillStyle = INK;
	ctx.beginPath();
	ctx.moveTo(0, -7);
	ctx.lineTo(3, 6);
	ctx.lineTo(0, 3.5);
	ctx.lineTo(-3, 6);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
export function fitDrawing(drawing: Drawing, width: number, height: number, mode: ViewMode = "plan"): Viewport {
	const els = drawing.elements;
	if (els.length === 0) return {
		...DEFAULT_VIEWPORT,
		x: -4,
		y: -4,
		zoom: 1
	};
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const consider = (p: Point) => {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	};
	for (const el of els) if (el.kind === "wall") {
		consider(el.a);
		consider(el.b);
	} else if (el.kind === "room") {
		consider({
			x: el.x,
			y: el.y
		});
		consider({
			x: el.x + el.w,
			y: el.y + el.h
		});
	} else if (el.kind === "cable" || el.kind === "trunk") el.points.forEach(consider);
	else consider(el.pos);
	const pad = 6;
	minX -= pad;
	minY -= pad;
	maxX += pad;
	maxY += pad;
	const dw = maxX - minX || 40;
	const dh = maxY - minY || 30;
	const zoom = Math.min(width / (dw * PX_PER_UNIT), height / (dh * PX_PER_UNIT), 1.6);
	if (mode === "iso") {
		return normalizeViewport({
			x: (minX + maxX) / 2,
			y: (minY + maxY) / 2,
			zoom: Math.max(0.38, Math.min(1.35, 17 / Math.max(dw, dh, 10))),
			rotation: 0,
			yaw: 0.12,
			pitch: 0.08,
		});
	}
	return normalizeViewport({
		x: minX,
		y: minY,
		zoom: Math.max(.25, zoom),
		rotation: 0,
		yaw: 0,
		pitch: 0
	});
}
function boundsOf(rooms: Room[]) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const r of rooms) {
		minX = Math.min(minX, r.x);
		minY = Math.min(minY, r.y);
		maxX = Math.max(maxX, r.x + r.w);
		maxY = Math.max(maxY, r.y + r.h);
	}
	if (!Number.isFinite(minX)) return { minX: -4, minY: -4, maxX: 20, maxY: 24 };
	return { minX, minY, maxX, maxY };
}

function shadeHex(hex: string, t: number): string {
	const n = hex.replace("#", "");
	const r = parseInt(n.slice(0, 2), 16);
	const g = parseInt(n.slice(2, 4), 16);
	const b = parseInt(n.slice(4, 6), 16);
	const k = Math.max(0.12, Math.min(1.15, t));
	return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

type Face = { pts: Vec3[]; fill: string; stroke?: string; lw?: number };

function pushBox(
	faces: Face[],
	cx: number,
	y0: number,
	cz: number,
	w: number,
	h: number,
	d: number,
	yaw: number,
	hex: string,
	opts?: { skipBottom?: boolean; stroke?: string },
) {
	const c = Math.cos(yaw);
	const s = Math.sin(yaw);
	const hw = w / 2;
	const hd = d / 2;
	const y1 = y0 + h;
	const corner = (lx: number, lz: number): { x: number; z: number } => ({
		x: cx + lx * c - lz * s,
		z: cz + lx * s + lz * c,
	});
	const p = [
		corner(-hw, -hd),
		corner(hw, -hd),
		corner(hw, hd),
		corner(-hw, hd),
	];
	const P = (i: number, y: number): Vec3 => v3(p[i]!.x, y, p[i]!.z);
	const sides: { idx: [number, number]; n: Vec3 }[] = [
		{ idx: [0, 1], n: v3(Math.sin(yaw), 0, -Math.cos(yaw)) },
		{ idx: [1, 2], n: v3(Math.cos(yaw), 0, Math.sin(yaw)) },
		{ idx: [2, 3], n: v3(-Math.sin(yaw), 0, Math.cos(yaw)) },
		{ idx: [3, 0], n: v3(-Math.cos(yaw), 0, -Math.sin(yaw)) },
	];
	const stroke = opts?.stroke;
	for (const side of sides) {
		const [a, b] = side.idx;
		faces.push({
			pts: [P(a, y0), P(b, y0), P(b, y1), P(a, y1)],
			fill: shadeHex(hex, lit(side.n)),
			stroke,
			lw: 0.7,
		});
	}
	faces.push({
		pts: [P(0, y1), P(1, y1), P(2, y1), P(3, y1)],
		fill: shadeHex(hex, lit(v3(0, 1, 0))),
		stroke,
		lw: 0.7,
	});
	if (!opts?.skipBottom) {
		faces.push({
			pts: [P(0, y0), P(3, y0), P(2, y0), P(1, y0)],
			fill: shadeHex(hex, 0.28),
			stroke,
			lw: 0.5,
		});
	}
}

function drawFaces(ctx: CanvasRenderingContext2D, cam3: Cam3, faces: Face[], width: number, height: number) {
	const ready: { face: Face; proj: Proj[]; z: number }[] = [];
	const pad = 120;
	for (const face of faces) {
		const proj: Proj[] = [];
		let z = 0;
		let ok = true;
		for (const p of face.pts) {
			const s = project3(p, cam3);
			if (!s || s.z < 0.9) {
				ok = false;
				break;
			}
			if (s.x < -pad || s.x > width + pad || s.y < -pad || s.y > height + pad) {
				ok = false;
				break;
			}
			proj.push(s);
			z += s.z;
		}
		if (!ok || proj.length < 3) continue;
		ready.push({ face, proj, z: z / proj.length });
	}
	ready.sort((a, b) => b.z - a.z);
	for (const item of ready) {
		const { face, proj } = item;
		ctx.beginPath();
		ctx.moveTo(proj[0]!.x, proj[0]!.y);
		for (let i = 1; i < proj.length; i++) ctx.lineTo(proj[i]!.x, proj[i]!.y);
		ctx.closePath();
		ctx.fillStyle = face.fill;
		ctx.fill();
		if (face.stroke) {
			ctx.strokeStyle = face.stroke;
			ctx.lineWidth = face.lw ?? 0.8;
			ctx.stroke();
		}
	}
}

function drawProjectedPoly(ctx: CanvasRenderingContext2D, cam3: Cam3, pts: Vec3[], stroke: string, widthPx: number, dash: number[]) {
	const proj: Proj[] = [];
	for (const p of pts) {
		const s = project3(p, cam3);
		if (s) proj.push(s);
	}
	if (proj.length < 2) return;
	ctx.beginPath();
	ctx.moveTo(proj[0]!.x, proj[0]!.y);
	for (let i = 1; i < proj.length; i++) ctx.lineTo(proj[i]!.x, proj[i]!.y);
	ctx.strokeStyle = stroke;
	ctx.lineWidth = widthPx;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.setLineDash(dash);
	ctx.stroke();
	ctx.setLineDash([]);
}

function deviceHex(d: Device): string {
	switch (d.device) {
		case "display":
		case "monitor":
			return "#2c2924";
		case "speaker":
			return "#3d3933";
		case "rack":
			return "#4a453c";
		case "camera":
			return "#5c564c";
		case "mixer":
		case "stagebox":
			return "#3a3630";
		case "outlet":
			return "#cfc6b8";
		default:
			return "#d4cbbd";
	}
}

export function renderIso(ctx: CanvasRenderingContext2D, drawing: Drawing, cam: Camera, opts: RenderOpts) {
	const { width, height, selectedId, hoverId, preview, showLengths = false, showGrid = true, liveDrag = null, routeKind = null } = opts;
	if (liveDrag && (liveDrag.dx || liveDrag.dy)) {
		drawing = {
			...drawing,
			elements: drawing.elements.map((el) => (el.id === liveDrag.id ? offsetElement(el, liveDrag.dx, liveDrag.dy) : el)),
		};
	}
	const origin = isoOrigin(width, height);
	const cam3 = makeCam3(cam, origin);
	const H = 3.2;
	const layers = drawing.layers;
	const rooms = drawing.elements.filter((e): e is Room => e.kind === "room");
	const walls = drawing.elements.filter((e): e is Wall => e.kind === "wall");
	const cables = drawing.elements.filter((e): e is Cable => e.kind === "cable");
	const trunks = drawing.elements.filter((e): e is Trunk => e.kind === "trunk");
	const devices = drawing.elements.filter((e): e is Device => e.kind === "device");
	const notes = drawing.elements.filter((e): e is Note => e.kind === "note");
	const b = boundsOf(rooms);

	const sky = ctx.createLinearGradient(0, 0, 0, height);
	sky.addColorStop(0, "#cfc8bb");
	sky.addColorStop(0.42, "#e4ddd2");
	sky.addColorStop(1, PAPER);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, width, height);

	const ground: Vec3[] = [
		world3({ x: b.minX - 8, y: b.minY - 8 }),
		world3({ x: b.maxX + 8, y: b.minY - 8 }),
		world3({ x: b.maxX + 8, y: b.maxY + 8 }),
		world3({ x: b.minX - 8, y: b.maxY + 8 }),
	];
	const gp = ground.map((p) => project3(p, cam3)).filter((p): p is Proj => !!p);
	if (gp.length >= 3) {
		ctx.beginPath();
		ctx.moveTo(gp[0]!.x, gp[0]!.y);
		for (let i = 1; i < gp.length; i++) ctx.lineTo(gp[i]!.x, gp[i]!.y);
		ctx.closePath();
		ctx.fillStyle = "#e7dfd2";
		ctx.fill();
	}

	if (showGrid && cam.zoom > 0.28) {
		ctx.strokeStyle = GRID_MAJOR;
		ctx.lineWidth = 1;
		ctx.globalAlpha = 0.55;
		ctx.beginPath();
		const x0 = Math.floor(b.minX - 1);
		const x1 = Math.ceil(b.maxX + 1);
		const y0 = Math.floor(b.minY - 1);
		const y1 = Math.ceil(b.maxY + 1);
		if (x1 - x0 < 90 && y1 - y0 < 90) {
			for (let x = x0; x <= x1; x++) {
				const a = project3(world3({ x, y: y0 }), cam3);
				const c = project3(world3({ x, y: y1 }), cam3);
				if (a && c) {
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(c.x, c.y);
				}
			}
			for (let y = y0; y <= y1; y++) {
				const a = project3(world3({ x: x0, y }), cam3);
				const c = project3(world3({ x: x1, y }), cam3);
				if (a && c) {
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(c.x, c.y);
				}
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	if (layers.architecture) {
		for (const r of rooms) {
			const pts = roomCorners(r).map((p) => world3(p, 0.01));
			const proj = pts.map((p) => project3(p, cam3)).filter((p): p is Proj => !!p);
			if (proj.length < 3) continue;
			ctx.beginPath();
			ctx.moveTo(proj[0]!.x, proj[0]!.y);
			for (let i = 1; i < proj.length; i++) ctx.lineTo(proj[i]!.x, proj[i]!.y);
			ctx.closePath();
			const nic = r.scope !== "contract";
			ctx.fillStyle = r.id === selectedId ? "rgba(138, 106, 59, 0.22)" : nic ? "rgba(232, 226, 216, 0.7)" : "rgba(214, 204, 186, 0.92)";
			ctx.fill();
			if (nic) {
				ctx.save();
				ctx.clip();
				hatchPoly(ctx, proj);
				ctx.restore();
			}
		}
	}

	const faces: Face[] = [];
	if (layers.architecture) {
		const hall = rooms.find((r) => r.scope === "contract");
		const inHall = (x: number, y: number) =>
			!!hall && x >= hall.x - 0.15 && x <= hall.x + hall.w + 0.15 && y >= hall.y - 0.15 && y <= hall.y + hall.h + 0.15;
		for (const w of walls) {
			const dx = w.b.x - w.a.x;
			const dy = w.b.y - w.a.y;
			const length = Math.hypot(dx, dy) || 1;
			const mx = (w.a.x + w.b.x) / 2;
			const mz = (w.a.y + w.b.y) / 2;
			const yaw = Math.atan2(-dx, dy);
			const selected = w.id === selectedId;
			const main = inHall(mx, mz);
			pushBox(
				faces,
				mx,
				0,
				mz,
				main ? 0.12 : 0.1,
				main ? H : 1.05,
				length,
				yaw,
				selected ? "#8a6a3b" : main ? "#6a6458" : "#d2c9ba",
				{
					skipBottom: true,
					stroke: selected ? SELECT : main ? "rgba(26,25,22,0.22)" : "rgba(26,25,22,0.12)",
				},
			);
		}
		if (layers.data) {
			for (const t of trunks) {
				const z = t.mount === "ceiling" ? 2.86 : 2.42;
				for (let i = 1; i < t.points.length; i++) {
					const a = t.points[i - 1]!;
					const bpt = t.points[i]!;
					const dx = bpt.x - a.x;
					const dy = bpt.y - a.y;
					const length = Math.hypot(dx, dy) || 1;
					const yaw = Math.atan2(-dx, dy);
					pushBox(
						faces,
						(a.x + bpt.x) / 2,
						z - 0.04,
						(a.y + bpt.y) / 2,
						0.12,
						0.08,
						length,
						yaw,
						t.id === selectedId ? "#8a6a3b" : "#9a9286",
						{ skipBottom: true, stroke: "rgba(26,25,22,0.2)" },
					);
				}
			}
		}
		for (const r of rooms) {
			if (r.scope !== "contract") continue;
			const c = roomCorners(r);
			for (let i = 0; i < 4; i++) {
				const a = c[i]!;
				const bpt = c[(i + 1) % 4]!;
				faces.push({
					pts: [world3(a, H), world3(bpt, H), world3(bpt, H - 0.04), world3(a, H - 0.04)],
					fill: "rgba(44, 41, 36, 0.16)",
					stroke: "rgba(44, 41, 36, 0.28)",
					lw: 0.8,
				});
			}
		}
	}

	const visibleDevices = devices.filter((d) => {
		const layer = elementLayer(d);
		return layers[layer] && d.device !== "door";
	});

	for (const d of visibleDevices) {
		const box = deviceBox(d);
		const y0 = deviceBase(d);
		const yaw = (d.rotation || 0) * Math.PI / 180;
		const hex = d.id === selectedId ? "#8a6a3b" : deviceHex(d);
		pushBox(faces, d.pos.x, y0, d.pos.y, box.w, box.h, box.d, yaw, hex, {
			skipBottom: true,
			stroke: d.id === selectedId || d.id === hoverId ? SELECT : "rgba(26,25,22,0.35)",
		});
		if (d.device === "display" || d.device === "monitor") {
			const c = Math.cos(yaw);
			const s = Math.sin(yaw);
			const inset = 0.04;
			const hw = box.w / 2 - inset;
			const hh = box.h / 2 - inset;
			const yMid = y0 + box.h / 2;
			const face = box.d / 2 + 0.005;
			const local = [
				{ x: -hw, y: yMid - hh, z: face },
				{ x: hw, y: yMid - hh, z: face },
				{ x: hw, y: yMid + hh, z: face },
				{ x: -hw, y: yMid + hh, z: face },
			];
			faces.push({
				pts: local.map((p) =>
					v3(d.pos.x + p.x * c - p.z * s, p.y, d.pos.y + p.x * s + p.z * c),
				),
				fill: "#1a1916",
			});
		}
	}

	drawFaces(ctx, cam3, faces, width, height);

	if (layers.power || layers.data || layers.av) {
		const byId = new Map(devices.map((d) => [d.id, d]));
		for (const c of cables) {
			if (!layers[elementLayer(c)]) continue;
			const from = c.fromId ? byId.get(c.fromId) : undefined;
			const to = c.toId ? byId.get(c.toId) : undefined;
			const h0 = from ? deviceTop(from) * 0.55 + deviceBase(from) * 0.45 : 0.08;
			const h1 = to ? deviceTop(to) * 0.55 + deviceBase(to) * 0.45 : 0.08;
			const ceiling = (from?.mount === "ceiling" || to?.mount === "ceiling");
			const cruise = ceiling ? 2.86 : 2.42;
			const n = Math.max(1, c.points.length - 1);
			const pts: Vec3[] = [];
			const first = c.points[0]!;
			const last = c.points[c.points.length - 1]!;
			pts.push(world3(first, h0));
			pts.push(world3(first, cruise));
			for (let i = 1; i < c.points.length - 1; i++) pts.push(world3(c.points[i]!, cruise));
			pts.push(world3(last, cruise));
			pts.push(world3(last, h1));
			const active = c.id === selectedId || c.id === hoverId;
			drawProjectedPoly(
				ctx,
				cam3,
				pts,
				c.id === selectedId ? SELECT : CABLE_COLOR[c.cable],
				active ? 2.8 : CABLE_WIDTH[c.cable],
				CABLE_DASH[c.cable],
			);
			if ((active || showLengths) && c.points.length >= 2) {
				const mid = cableLabelPoint(c.points);
				const sm = project3(world3(mid, (h0 + h1) / 2), cam3);
				if (sm) {
					const len = polylineLength(c.points);
					const label = showLengths
						? c.label
							? `${c.label}  ${formatLength(len, drawing.meta.unit)}`
							: formatLength(len, drawing.meta.unit)
						: c.label;
					if (label) drawHaloLabel(ctx, sm.x, sm.y, label, CABLE_COLOR[c.cable], cam.zoom);
				}
			}
		}
	}

	if (preview && preview.kind === "room" && preview.points.length >= 2) {
		const a = preview.points[0]!;
		const bpt = preview.points[1]!;
		drawProjectedPoly(
			ctx,
			cam3,
			roomCorners({
				x: Math.min(a.x, bpt.x),
				y: Math.min(a.y, bpt.y),
				w: Math.abs(bpt.x - a.x),
				h: Math.abs(bpt.y - a.y),
			}).map((p) => world3(p, 0.04)).concat([world3({ x: Math.min(a.x, bpt.x), y: Math.min(a.y, bpt.y) }, 0.04)]),
			PREVIEW,
			1.6,
			[6, 4],
		);
	} else if (preview && preview.points.length >= 2) {
		drawProjectedPoly(
			ctx,
			cam3,
			preview.points.map((p) => world3(p, 0.12)),
			preview.kind === "cable" && preview.cable ? CABLE_COLOR[preview.cable] : PREVIEW,
			2,
			preview.kind === "cable" && preview.cable ? CABLE_DASH[preview.cable] : [6, 4],
		);
	}

	for (const d of visibleDevices) {
		if (!deviceShowsTag(d, cam, d.id === selectedId, d.id === hoverId, Boolean(routeKind))) continue;
		const top = project3(world3(d.pos, deviceTop(d) + 0.08), cam3);
		if (top) drawDeviceTag(ctx, d, { x: top.x, y: top.y }, cam);
	}

	if (layers.notes) for (const n of notes) {
		const p = project3(world3(n.pos, 0.2), cam3);
		if (!p) continue;
		ctx.font = `400 ${Math.max(10, 11 * cam.zoom)}px "IBM Plex Sans", sans-serif`;
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		ctx.fillStyle = n.id === selectedId ? INK : INK_MUTED;
		ctx.strokeStyle = PAPER;
		ctx.lineWidth = 3;
		ctx.strokeText(n.text, p.x, p.y);
		ctx.fillText(n.text, p.x, p.y);
	}

	if (layers.architecture) for (const r of rooms) {
		const c = project3(world3({ x: r.x + r.w / 2, y: r.y + r.h * 0.35 }, 0.04), cam3);
		if (!c) continue;
		ctx.font = `500 ${Math.max(9, 10 * cam.zoom)}px "IBM Plex Sans", sans-serif`;
		ctx.letterSpacing = "0.18em";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = INK_MUTED;
		ctx.fillText(r.name.toUpperCase(), c.x, c.y);
		ctx.letterSpacing = "0px";
	}

	if (selectedId) {
		const selected = drawing.elements.find((e) => e.id === selectedId);
		if (selected && (selected.kind !== "device" || cam.zoom > 1.4)) {
			const z = selected.kind === "device" ? deviceTop(selected) : 0.1;
			drawHandles(ctx, selected, (p) => worldToIso(p, z, cam, origin));
		}
	}

	ctx.fillStyle = "rgba(26,25,22,0.45)";
	ctx.font = `400 10px "IBM Plex Sans", sans-serif`;
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";
	const elev = Math.round((elevation(cam) * 180) / Math.PI);
	ctx.fillText(`Perspective · ${elev}°`, 14, height - 14);
}
