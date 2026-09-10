import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Home,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { formatLength, pointInRect, polylineLength } from "@/lib/drawing/geometry";
import {
  ZOOM_MAX,
  ZOOM_MIN,
  PITCH_MAX,
  PITCH_MIN,
  drawTitleBlock,
  fitDrawing,
  hitTitleField,
  isoOrigin,
  isoToWorld,
  northScreenAngle,
  orbitCamera,
  panCamera,
  panByPixels,
  pickHandle,
  hitDeviceAtScreen,
  placeWorldAt,
  projectPoint,
  renderDrawing,
  renderIso,
  screenToWorld,
  titleBlockLayout,
  zoomCamera,
} from "@/lib/drawing/render";
import { deviceTop } from "@/lib/drawing/camera3d";
import { findCatalogItem, STOCK_CATALOG } from "@/lib/drawing/catalog";
import { getLiveDrag, subscribeLiveDrag, useDrawing, useStore } from "@/lib/drawing/store";
import type { CableKind, Device, Element, Point, ViewMode, Viewport } from "@/lib/drawing/types";

function wrapSize(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height, rect };
}

type EditSession = {
  kind: "element" | "meta";
  id: string;
  field: string;
  value: string;
  multiline?: boolean;
};

function commitSession(session: EditSession, value: string) {
  const s = useStore.getState();
  const next = value.trimEnd();
  if (session.kind === "meta") {
    s.updateMeta(
      session.field === "title" ? { title: next, name: next } : { [session.field]: next },
    );
    return;
  }
  s.setSelected(session.id);
  if (session.field === "text") s.updateSelected({ text: next });
  else if (session.field === "name") s.updateSelected({ name: next });
  else s.updateSelected({ label: next });
}

function beginElementEdit(el: Element): EditSession {
  if (el.kind === "room") return { kind: "element", id: el.id, field: "name", value: el.name };
  if (el.kind === "note") return { kind: "element", id: el.id, field: "text", value: el.text, multiline: true };
  if (el.kind === "cable") return { kind: "element", id: el.id, field: "label", value: el.label };
  if (el.kind === "device") return { kind: "element", id: el.id, field: "label", value: el.label };
  return { kind: "element", id: el.id, field: "label", value: "" };
}

function projectWorld(
  e: { clientX: number; clientY: number },
  wrap: HTMLElement,
  cam: Viewport,
  mode: ViewMode,
): Point {
  const { width, height, rect } = wrapSize(wrap);
  const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (mode === "iso") return isoToWorld(local, cam, isoOrigin(width, height));
  return screenToWorld(local, cam);
}

export function DrawingCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const liveMoveRef = useRef(false);
  const orbitRef = useRef<{ x: number; y: number; cam: Viewport } | null>(null);
  const pendingOrbitRef = useRef<{ x: number; y: number; cam: Viewport } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    dist: number;
    angle: number;
    mid: Point;
    cam: Viewport;
  } | null>(null);
  const fittedFor = useRef<string | null>(null);

  const drawing = useDrawing();
  const viewport = useStore((s) => s.viewport);
  const viewMode = useStore((s) => s.viewMode);
  const selectedId = useStore((s) => s.selectedId);
  const hoverId = useStore((s) => s.hoverId);
  const draft = useStore((s) => s.draft);
  const tool = useStore((s) => s.tool);
  const cableKind = useStore((s) => s.cableKind);
  const showGrid = useStore((s) => s.showGrid);
  const showLengths = useStore((s) => s.showLengths);
  const spacePan = useStore((s) => s.spacePan);
  const catalogId = useStore((s) => s.catalogId);
  const custom = useStore((s) => s.customCatalog);
  const picked = findCatalogItem([...STOCK_CATALOG, ...custom], catalogId ?? undefined);
  const [cursor, setCursor] = useState("default");
  const [edit, setEdit] = useState<EditSession | null>(null);
  const editRef = useRef<EditSession | null>(null);
  editRef.current = edit;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let raf = 0;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      const rect = wrap.getBoundingClientRect();
      const state = useStore.getState();
      const d = state.drawing();
      if (fittedFor.current !== d.id && rect.width > 8 && rect.height > 8) {
        fittedFor.current = d.id;
        state.setViewport(fitDrawing(d, rect.width, rect.height, state.viewMode));
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = state.viewport;
      const preview = state.draft
        ? {
            points: [...state.draft.committed, state.draft.cursor],
            kind:
              state.tool === "wall" ||
              state.tool === "cable" ||
              state.tool === "room" ||
              state.tool === "measure"
                ? state.tool
                : ("cable" as const),
            cable: state.cableKind as CableKind,
          }
        : null;
      const liveDrag = getLiveDrag();
      const opts = {
        width: rect.width,
        height: rect.height,
        selectedId: state.selectedId,
        hoverId: state.hoverId,
        preview,
        showLengths: state.showLengths,
        showGrid: state.showGrid,
        routeKind: state.tool === "cable" ? state.cableKind : null,
        anchorId: state.draft?.fromId ?? null,
        liveDrag,
        onUnderlayReady: schedule,
      };
      if (state.viewMode === "iso") {
        renderIso(ctx, d, cam, opts);
      } else {
        renderDrawing(ctx, d, cam, opts);
      }
      drawTitleBlock(ctx, d, rect.width, rect.height);
      const origin = isoOrigin(rect.width, rect.height);
      (window as unknown as { __ciavs?: unknown }).__ciavs = {
        store: useStore,
        project: (p: Point) => projectPoint(p, cam, state.viewMode, origin),
        size: { width: rect.width, height: rect.height },
      };
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    };
    const unsub = useStore.subscribe(schedule);
    const unsubDrag = subscribeLiveDrag(schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    schedule();
    return () => {
      alive = false;
      unsub();
      unsubDrag();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useStore.getState();
      const { width, height, rect } = wrapSize(wrap);
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1 : -1;
        s.setViewport(
          orbitCamera(s.viewport, s.viewMode, width, height, factor * 0.08, 0, screen),
        );
        return;
      }
      if (e.shiftKey && s.viewMode === "iso") {
        const dPitch = e.deltaY > 0 ? -0.06 : 0.06;
        s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, 0, dPitch, screen));
        return;
      }
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s.viewport.zoom * factor));
      s.setViewport(zoomCamera(s.viewport, s.viewMode, width, height, zoom, screen));
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [viewMode]);

  const worldOf = (e: { clientX: number; clientY: number }) => {
    const s = useStore.getState();
    return projectWorld(e, wrapRef.current!, s.viewport, s.viewMode);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dx = pts[0]!.x - pts[1]!.x;
      const dy = pts[0]!.y - pts[1]!.y;
      pinchRef.current = {
        dist: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx),
        mid: { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 },
        cam: { ...useStore.getState().viewport },
      };
      panRef.current = null;
      orbitRef.current = null;
      return;
    }
    const s = useStore.getState();
    const orbit = e.button === 2 || (e.button === 0 && e.altKey);
    const pan = s.spacePan || s.tool === "pan" || e.button === 1;
    if (orbit) {
      orbitRef.current = { x: e.clientX, y: e.clientY, cam: { ...s.viewport } };
      return;
    }
    if (pan) {
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    const wrap = wrapRef.current!;
    const { width, height, rect } = wrapSize(wrap);
    const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (editRef.current) {
      commitSession(editRef.current, editRef.current.value);
      setEdit(null);
    }
    const titleField = hitTitleField(local, width, height);
    if (titleField) {
      const meta = s.drawing().meta;
      setEdit({ kind: "meta", id: titleField, field: titleField, value: meta[titleField] });
      return;
    }
    const origin = isoOrigin(width, height);
    const selected = s.selectedId ? s.drawing().elements.find((el) => el.id === s.selectedId) : null;
    const handle = selected ? pickHandle(selected, local, s.viewport, s.viewMode, origin) : null;
    if (handle && (s.tool === "select" || s.tool === "device")) {
      s.pointerDown(worldOf(e), handle.id);
      draggingRef.current = true;
      liveMoveRef.current = false;
      setCursor(handle.cursor === "grab" ? "grabbing" : handle.cursor);
      return;
    }
    if (s.tool === "select" || s.tool === "device") {
      const devices = s.drawing().elements.filter((el): el is Device => el.kind === "device");
      const hitDev = hitDeviceAtScreen(devices, local, s.viewport, s.viewMode, origin);
      if (hitDev && s.tool === "select") {
        s.beginMove(hitDev.id, worldOf(e));
        draggingRef.current = true;
        liveMoveRef.current = true;
        setCursor("grabbing");
        return;
      }
      if (s.tool === "select") {
        const result = s.pointerDown(worldOf(e), null);
        if (result === "pan") {
          if (s.viewMode === "iso" && !s.spacePan) {
            pendingOrbitRef.current = { x: e.clientX, y: e.clientY, cam: { ...s.viewport } };
          } else {
            pendingPanRef.current = { x: e.clientX, y: e.clientY };
          }
          draggingRef.current = false;
        } else if (result === "drag") {
          draggingRef.current = true;
          liveMoveRef.current = true;
          setCursor("grabbing");
        }
        return;
      }
    }
    s.pointerDown(worldOf(e));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const wrap = wrapRef.current!;
    const { width, height, rect } = wrapSize(wrap);
    const s = useStore.getState();

    if (pointers.current.size === 2 && pinchRef.current) {
      const pts = [...pointers.current.values()];
      const dx = pts[0]!.x - pts[1]!.x;
      const dy = pts[0]!.y - pts[1]!.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      const g = pinchRef.current;
      const scale = dist / Math.max(1, g.dist);
      const dAngle = angle - g.angle;
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, g.cam.zoom * scale));
      const screen = { x: mid.x - rect.left, y: mid.y - rect.top };
      const startScreen = { x: g.mid.x - rect.left, y: g.mid.y - rect.top };
      let cam = zoomCamera(g.cam, s.viewMode, width, height, zoom, startScreen);
      cam = orbitCamera(cam, s.viewMode, width, height, dAngle, 0, startScreen);
      cam = panCamera(
        cam,
        s.viewMode,
        startScreen,
        screen,
        width,
        height,
      );
      s.setViewport(cam);
      return;
    }

    if (orbitRef.current) {
      const dx = e.clientX - orbitRef.current.x;
      const dy = e.clientY - orbitRef.current.y;
      let dYaw = dx * 0.009;
      let dPitch = s.viewMode === "iso" ? -dy * 0.007 : 0;
      if (e.shiftKey) {
        const snap = Math.PI / 12;
        dYaw = Math.round(dYaw / snap) * snap;
        dPitch = Math.round(dPitch / snap) * snap;
      }
      s.setViewport(orbitCamera(orbitRef.current.cam, s.viewMode, width, height, dYaw, dPitch));
      return;
    }

    if (pendingOrbitRef.current && !orbitRef.current) {
      const dx = e.clientX - pendingOrbitRef.current.x;
      const dy = e.clientY - pendingOrbitRef.current.y;
      if (Math.hypot(dx, dy) > 7) {
        orbitRef.current = pendingOrbitRef.current;
        pendingOrbitRef.current = null;
        setCursor("grabbing");
      } else {
        return;
      }
    }

    if (orbitRef.current) {
      const dx = e.clientX - orbitRef.current.x;
      const dy = e.clientY - orbitRef.current.y;
      s.setViewport(
        orbitCamera(orbitRef.current.cam, s.viewMode, width, height, dx * 0.009, s.viewMode === "iso" ? -dy * 0.007 : 0),
      );
      return;
    }

    if (pendingPanRef.current && !panRef.current) {
      const dx = e.clientX - pendingPanRef.current.x;
      const dy = e.clientY - pendingPanRef.current.y;
      if (Math.hypot(dx, dy) > 7) {
        panRef.current = pendingPanRef.current;
        pendingPanRef.current = null;
      } else {
        return;
      }
    }

    if (panRef.current) {
      const from = {
        x: panRef.current.x - rect.left,
        y: panRef.current.y - rect.top,
      };
      const to = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      s.setViewport(panCamera(s.viewport, s.viewMode, from, to, width, height));
      panRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (liveMoveRef.current) {
      s.nudgeLive(worldOf(e));
      setCursor("grabbing");
      return;
    }

    if (draggingRef.current) {
      s.pointerMove(worldOf(e));
      setCursor("grabbing");
      return;
    }

    s.pointerMove(worldOf(e));
    if ((s.tool === "select" || s.tool === "device") && !panRef.current && !orbitRef.current) {
      const origin = isoOrigin(width, height);
      const devices = s.drawing().elements.filter((el): el is Device => el.kind === "device");
      const hitDev = hitDeviceAtScreen(devices, { x: e.clientX - rect.left, y: e.clientY - rect.top }, s.viewport, s.viewMode, origin);
      const selected = s.selectedId ? s.drawing().elements.find((el) => el.id === s.selectedId) : null;
      const handle = selected
        ? pickHandle(selected, { x: e.clientX - rect.left, y: e.clientY - rect.top }, s.viewport, s.viewMode, origin)
        : null;
      if (handle) setCursor(handle.cursor);
      else if (hitDev || s.hitTest(worldOf(e))) setCursor("grab");
      else setCursor(s.viewMode === "iso" ? "grab" : "default");
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchRef.current = null;
    panRef.current = null;
    pendingPanRef.current = null;
    orbitRef.current = null;
    pendingOrbitRef.current = null;
    draggingRef.current = false;
    liveMoveRef.current = false;
    useStore.getState().pointerUp();
    setCursor("default");
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const s = useStore.getState();
    if (s.tool === "wall" || s.tool === "cable" || s.tool === "room" || s.tool === "measure") {
      s.finishDraft();
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { width, height, rect } = wrapSize(wrap);
    const local = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const titleField = hitTitleField(local, width, height);
    if (titleField) {
      const meta = s.drawing().meta;
      setEdit({ kind: "meta", id: titleField, field: titleField, value: meta[titleField] });
      return;
    }
    const world = worldOf(e);
    let hit = s.hitTest(world);
    if (!hit) {
      hit =
        s.drawing().elements.find((el) => el.kind === "room" && pointInRect(world, el)) ??
        null;
    }
    if (hit && hit.kind !== "wall") {
      s.setSelected(hit.id);
      setEdit(beginElementEdit(hit));
    }
  };

  const rotating = Boolean(orbitRef.current);
  const cursorStyle =
    spacePan || tool === "pan"
      ? panRef.current
        ? "grabbing"
        : "grab"
      : rotating
        ? "grabbing"
        : tool === "select" || tool === "device"
          ? cursor === "default" && tool === "device"
            ? "crosshair"
            : cursor
          : "crosshair";

  const hint =
    viewMode === "iso"
      ? "Drag to orbit · space-drag pans · scroll zooms · tilt with the arrows or two-finger twist"
      : tool === "wall"
        ? "Click to draw walls · drag empty space to pan · Enter finish"
        : tool === "cable"
          ? "Click a device · click corners · click the destination"
          : tool === "room"
            ? "Click two corners of a room · drag empty space to pan"
            : tool === "device"
              ? picked
                ? `Click to place ${picked.brand} ${picked.model} · drag empty space to pan`
                : "Click to place · drag empty space to pan"
              : tool === "note"
                ? "Click to pin a callout · double-click to edit"
                : tool === "measure"
                  ? "Click two points to measure"
                  : "Drag to move · corners resize · circle rotates · double-click to rename";

  const measure =
    tool === "measure" && draft
      ? formatLength(polylineLength([...draft.committed, draft.cursor]), drawing.meta.unit)
      : null;

  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <div
        ref={wrapRef}
        data-canvas-wrap
        className="absolute inset-0 overflow-hidden bg-paper"
        style={{ cursor: cursorStyle, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="block size-full" />
      </div>
      {edit ? (
        <InlineEditor
          session={edit}
          wrapRef={wrapRef}
          onChange={(value) => setEdit({ ...edit, value })}
          onCommit={() => {
            commitSession(edit, edit.value);
            setEdit(null);
          }}
          onCancel={() => setEdit(null)}
        />
      ) : null}
      <ViewHud wrapRef={wrapRef} />
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
        <p className="max-w-md rounded-sm bg-bg/80 px-2.5 py-1.5 text-xs text-muted backdrop-blur-sm">
          {measure ? `Measure ${measure}` : hint}
        </p>
      </div>
    </div>
  );
}

function InlineEditor({
  session,
  wrapRef,
  onChange,
  onCommit,
  onCancel,
}: {
  session: EditSession;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const drawing = useDrawing();
  const viewport = useStore((s) => s.viewport);
  const viewMode = useStore((s) => s.viewMode);
  const wrap = wrapRef.current;
  const width = wrap?.clientWidth ?? 800;
  const height = wrap?.clientHeight ?? 600;
  const origin = isoOrigin(width, height);

  let left = 24;
  let top = 24;
  let boxW = 220;
  let boxH = session.multiline ? 72 : 32;

  if (session.kind === "meta") {
    const layout = titleBlockLayout(width, height);
    const field = layout.fields.find((f) => f.field === session.field) ?? layout.fields[1]!;
    left = field.x;
    top = field.y;
    boxW = field.w;
    boxH = Math.max(28, field.h);
  } else {
    const el = drawing.elements.find((e) => e.id === session.id);
    if (el) {
      const pos =
        el.kind === "room"
          ? { x: el.x + el.w / 2, y: el.y + el.h * 0.3 }
          : el.kind === "cable" || el.kind === "trunk"
            ? el.points[Math.floor(el.points.length / 2)] ?? el.points[0]!
            : el.kind === "wall"
              ? { x: (el.a.x + el.b.x) / 2, y: (el.a.y + el.b.y) / 2 }
              : el.pos;
      const screen = projectPoint(pos, viewport, viewMode, origin, el.kind === "device" ? deviceTop(el) : 0.2);
      left = screen.x - boxW / 2;
      top = screen.y - boxH / 2;
    }
  }

  const common = {
    value: session.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur: onCommit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && (!session.multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onCommit();
      }
    },
    autoFocus: true,
    suppressHydrationWarning: true,
  };

  return (
    <div
      className="pointer-events-auto absolute z-20"
      style={{ left, top, width: boxW, height: boxH }}
    >
      {session.multiline ? (
        <textarea
          {...common}
          className="h-full w-full resize-none rounded-sm bg-paper px-2 py-1 text-sm text-fg shadow-border outline-none"
        />
      ) : (
        <Input {...common} className="h-full bg-paper" />
      )}
    </div>
  );
}

function ViewHud({ wrapRef }: { wrapRef: React.RefObject<HTMLDivElement | null> }) {
  const viewMode = useStore((s) => s.viewMode);
  const viewport = useStore((s) => s.viewport);
  const size = wrapRef.current?.getBoundingClientRect();
  const width = size?.width ?? 800;
  const height = size?.height ?? 600;
  const north = northScreenAngle(viewport, viewMode, width, height);
  const deg =
    viewMode === "iso"
      ? Math.round((((viewport.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI))
      : Math.round((((viewport.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * (180 / Math.PI));

  const sizeOf = () => {
    const wrap = wrapRef.current ?? document.querySelector("[data-canvas-wrap]");
    if (!wrap) return { width: 800, height: 600 };
    const r = wrap.getBoundingClientRect();
    return { width: r.width, height: r.height };
  };

  const orbit = (dYaw: number, dPitch = 0) => {
    const s = useStore.getState();
    const { width: w, height: h } = sizeOf();
    s.setViewport(orbitCamera(s.viewport, s.viewMode, w, h, dYaw, dPitch));
  };

  const zoomBy = (factor: number) => {
    const s = useStore.getState();
    const { width: w, height: h } = sizeOf();
    s.setViewport(zoomCamera(s.viewport, s.viewMode, w, h, s.viewport.zoom * factor));
  };

  const panNudge = (dx: number, dy: number) => {
    const s = useStore.getState();
    const { width: w, height: h } = sizeOf();
    s.setViewport(panByPixels(s.viewport, s.viewMode, w, h, dx, dy));
  };

  const resetNorth = () => {
    const s = useStore.getState();
    const { width: w, height: h } = sizeOf();
    const origin = isoOrigin(w, h);
    const pivot = { x: w / 2, y: h / 2 };
    const world =
      s.viewMode === "iso"
        ? isoToWorld(pivot, s.viewport, origin)
        : screenToWorld(pivot, s.viewport);
    s.setViewport(
      placeWorldAt(
        { ...s.viewport, rotation: 0, yaw: 0, pitch: 0 },
        s.viewMode,
        world,
        pivot,
        origin,
      ),
    );
  };

  const reset = () => {
    const s = useStore.getState();
    const { width: w, height: h } = sizeOf();
    s.setViewport(fitDrawing(s.drawing(), w, h, s.viewMode));
  };

  const step = viewMode === "iso" ? Math.PI / 4 : Math.PI / 12;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2 max-md:top-14">
      <button
        type="button"
        aria-label="Reset north"
        onClick={resetNorth}
        className="pointer-events-auto relative grid size-14 place-items-center rounded-full bg-bg/85 text-fg shadow-border backdrop-blur-sm"
        title="Reset north"
      >
        <span
          className="absolute inset-1 rounded-full border border-border"
          style={{ transform: `rotate(${north}rad)` }}
        >
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-0.5 text-[9px] font-semibold text-primary">
            N
          </span>
          <span className="absolute left-1/2 top-1.5 h-3 w-0.5 -translate-x-1/2 bg-primary" />
        </span>
        <span className="font-mono text-[9px] tabular-nums text-muted">{deg}°</span>
      </button>
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md bg-bg/85 shadow-border backdrop-blur-sm">
        <HudBtn label="Zoom in" onClick={() => zoomBy(1.15)}>
          <Plus className="size-4" />
        </HudBtn>
        <span className="px-1 py-1 text-center font-mono text-[10px] tabular-nums text-muted">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <HudBtn label="Zoom out" onClick={() => zoomBy(1 / 1.15)}>
          <Minus className="size-4" />
        </HudBtn>
      </div>
      <div className="pointer-events-auto flex overflow-hidden rounded-md bg-bg/85 shadow-border backdrop-blur-sm">
        <HudBtn label="Pan left" onClick={() => panNudge(-56, 0)}>
          <ChevronLeft className="size-4" />
        </HudBtn>
        <HudBtn label="Pan up" onClick={() => panNudge(0, -56)}>
          <ChevronUp className="size-4" />
        </HudBtn>
        <HudBtn label="Pan down" onClick={() => panNudge(0, 56)}>
          <ChevronDown className="size-4" />
        </HudBtn>
        <HudBtn label="Pan right" onClick={() => panNudge(56, 0)}>
          <ChevronRight className="size-4" />
        </HudBtn>
      </div>
      <div className="pointer-events-auto flex overflow-hidden rounded-md bg-bg/85 shadow-border backdrop-blur-sm">
        <HudBtn label="Rotate left · Q" onClick={() => orbit(-step)}>
          <RotateCcw className="size-4" />
        </HudBtn>
        <HudBtn label="Fit view · 0" onClick={reset}>
          <Home className="size-4" />
        </HudBtn>
        <HudBtn label="Rotate right · E" onClick={() => orbit(step)}>
          <RotateCw className="size-4" />
        </HudBtn>
      </div>
      {viewMode === "iso" ? (
        <div className="pointer-events-auto flex overflow-hidden rounded-md bg-bg/85 shadow-border backdrop-blur-sm">
          <HudBtn label="Eye level" onClick={() => {
            const s = useStore.getState();
            s.setViewport({ ...s.viewport, pitch: PITCH_MIN + 0.08 });
          }}>
            <span className="font-mono text-[9px]">Eye</span>
          </HudBtn>
          <HudBtn label="Tilt lower" onClick={() => orbit(0, -0.12)}>
            <ChevronDown className="size-4" />
          </HudBtn>
          <HudBtn label="Tilt higher" onClick={() => orbit(0, 0.12)}>
            <ChevronUp className="size-4" />
          </HudBtn>
          <HudBtn label="Top down" onClick={() => {
            const s = useStore.getState();
            s.setViewport({ ...s.viewport, pitch: PITCH_MAX });
          }}>
            <span className="font-mono text-[9px]">Top</span>
          </HudBtn>
        </div>
      ) : null}
    </div>
  );
}

function HudBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} side="left">
      <Button variant="ghost" size="icon" className="size-10 max-md:size-8" aria-label={label} onClick={onClick}>
        {children}
      </Button>
    </Tooltip>
  );
}
