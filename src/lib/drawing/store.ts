import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSchedule, type Schedule } from "./bom";
import { blankMetric, compassionThirdFloor, applyStageCat6Trunks, applySpeakerHdmiTrunks, applyCenter55s, applyWallNeatBars, applyCatalogStamps } from "./compassion";
import { STOCK_CATALOG, findCatalogItem } from "./catalog";
import {
  dist,
  distToPolyline,
  distToSegment,
  orthoSnap,
  pointInRect,
  snapPoint,
  uid,
  applyHandle,
  nearestHandle,
  nearestDevice,
  roomEdgeHit,
  devicePickRadius,
  deviceLabelOffset,
  offsetElement,
} from "./geometry";
import type {
  CableKind,
  CatalogItem,
  DeviceKind,
  Drawing,
  Element,
  LayerId,
  Point,
  Tool,
  Underlay,
  ViewMode,
  Viewport,
} from "./types";
import { CABLE_META, DEFAULT_LAYERS, DEFAULT_VIEWPORT, normalizeViewport } from "./types";

const PERSIST_KEY = "ci-avs-drawings";
const LEGACY_PERSIST_KEY = "raceway-compassion-av-l3";
const MAX_HISTORY = 50;
const SAVE_DEBOUNCE_MS = 280;
const dragPersist = { pause: false };

export type LiveDrag = { id: string; dx: number; dy: number } | null;
export type SaveStatus = "saved" | "saving";

let liveDrag: LiveDrag = null;
const liveDragSubs = new Set<() => void>();

export function getLiveDrag(): LiveDrag {
  return liveDrag;
}

export function setLiveDrag(next: LiveDrag) {
  liveDrag = next;
  liveDragSubs.forEach((fn) => fn());
}

export function subscribeLiveDrag(fn: () => void) {
  liveDragSubs.add(fn);
  return () => {
    liveDragSubs.delete(fn);
  };
}

let saveStatus: SaveStatus = "saved";
const saveSubs = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: { name: string; value: string } | null = null;
let lastWritten = "";

export function getSaveStatus(): SaveStatus {
  return saveStatus;
}

export function subscribeSaveStatus(fn: () => void) {
  saveSubs.add(fn);
  return () => {
    saveSubs.delete(fn);
  };
}

function setSaveStatus(next: SaveStatus) {
  if (saveStatus === next) return;
  saveStatus = next;
  saveSubs.forEach((fn) => fn());
}

function writePersist(name: string, value: string) {
  pendingWrite = null;
  lastWritten = value;
  if (typeof localStorage === "undefined") {
    setSaveStatus("saved");
    return;
  }
  try {
    localStorage.setItem(name, value);
    if (name === PERSIST_KEY) localStorage.removeItem(LEGACY_PERSIST_KEY);
    setSaveStatus("saved");
  } catch {
    setSaveStatus("saving");
  }
}

function scheduleWrite(name: string, value: string) {
  if (value === lastWritten && !pendingWrite) {
    setSaveStatus("saved");
    return;
  }
  pendingWrite = { name, value };
  setSaveStatus("saving");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingWrite) writePersist(pendingWrite.name, pendingWrite.value);
  }, SAVE_DEBOUNCE_MS);
}

/** Flush the current sheet to disk. In-progress drafts are not stored. */
export function flushSave() {
  dragPersist.pause = false;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingWrite) writePersist(pendingWrite.name, pendingWrite.value);
}

function liveStorage() {
  return {
    getItem: (name: string) => {
      if (typeof localStorage === "undefined") return null;
      const value = localStorage.getItem(name) ?? localStorage.getItem(LEGACY_PERSIST_KEY);
      if (value) lastWritten = value;
      return value;
    },
    setItem: (name: string, value: string) => {
      if (typeof localStorage === "undefined") return;
      if (dragPersist.pause) return;
      scheduleWrite(name, value);
    },
    removeItem: (name: string) => {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(name);
      lastWritten = "";
    },
  };
}

type Draft = {
  committed: Point[];
  cursor: Point;
  fromId?: string;
};


type Store = {
  drawings: Drawing[];
  currentId: string;
  screen: "hub" | "studio";
  tool: Tool;
  deviceKind: DeviceKind;
  cableKind: CableKind;
  catalogId: string | null;
  customCatalog: CatalogItem[];
  recentCatalogIds: string[];
  showLibrary: boolean;
  equipSearchTick: number;
  viewport: Viewport;
  viewMode: ViewMode;
  selectedId: string | null;
  hoverId: string | null;
  draft: Draft | null;
  snap: boolean;
  ortho: boolean;
  showGrid: boolean;
  showLengths: boolean;
  showSchedule: boolean;
  spacePan: boolean;
  past: Drawing[];
  future: Drawing[];

  drawing: () => Drawing;
  schedule: () => Schedule;
  catalog: () => CatalogItem[];
  setScreen: (s: "hub" | "studio") => void;
  openProject: (id: string) => void;
  newProject: (opts?: { name?: string; template?: "blank" | "l3"; underlay?: Underlay }) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  setUnderlay: (u: Underlay | undefined) => void;
  setShowLibrary: (v: boolean) => void;
  focusEquipSearch: () => void;
  goBack: () => void;
  goHome: () => void;
  pickCatalogItem: (item: CatalogItem) => void;
  addCustomEquipment: (item: Omit<CatalogItem, "id" | "custom">) => CatalogItem;
  removeCustomEquipment: (id: string) => void;
  setTool: (t: Tool) => void;
  setDeviceKind: (k: DeviceKind) => void;
  setCableKind: (k: CableKind) => void;
  setViewport: (v: Partial<Viewport> | ((prev: Viewport) => Viewport)) => void;
  setViewMode: (m: ViewMode) => void;
  setHover: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  toggleLayer: (id: LayerId) => void;
  toggleSnap: () => void;
  toggleOrtho: () => void;
  toggleGrid: () => void;
  toggleLengths: () => void;
  toggleSchedule: () => void;
  setSpacePan: (v: boolean) => void;
  updateMeta: (patch: Partial<Drawing["meta"]> & { name?: string }) => void;
  loadTemplate: (build: () => Drawing) => void;
  resetPlot: () => void;
  newDrawing: () => void;
  switchDrawing: (id: string) => void;
  hitTest: (world: Point) => Element | null;
  pointerDown: (world: Point, handle?: string | null) => "pan" | "drag" | "draw";
  pointerMove: (world: Point) => void;
  pointerUp: () => void;
  beginMove: (id: string, world: Point) => void;
  nudgeLive: (world: Point) => void;
  cancelDraft: () => void;
  undoDraft: () => boolean;
  finishDraft: () => void;
  moveSelected: (dx: number, dy: number) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  updateSelected: (patch: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  importJson: (json: string) => boolean;
};

function cloneDrawing(d: Drawing): Drawing {
  return structuredClone(d);
}

function drawingIsAv(d: Drawing | undefined): boolean {
  if (!d || !Array.isArray(d.elements) || !d.meta) return false;
  return d.elements.every((el) => {
    if (el.kind === "cable") return el.cable in CABLE_META;
    if (el.kind === "trunk") return Array.isArray(el.points) && el.points.length >= 2;
    return true;
  });
}

const seed = compassionThirdFloor();

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const current = () => {
        const { drawings, currentId } = get();
        return drawings.find((d) => d.id === currentId) ?? drawings[0]!;
      };

      const commit = (next: Drawing, record = true) => {
        const { drawings, currentId, past } = get();
        const prev = drawings.find((d) => d.id === currentId);
        set({
          drawings: drawings.map((d) => (d.id === next.id ? next : d)),
          past: record && prev ? [...past.slice(-MAX_HISTORY + 1), cloneDrawing(prev)] : past,
          future: record ? [] : get().future,
        });
        if (!dragPersist.pause) flushSave();
      };

      const mutate = (fn: (d: Drawing) => Drawing, record = true) => {
        commit(fn(cloneDrawing(current())), record);
      };

      const checkpoint = () => {
        const cur = current();
        set((s) => ({ past: [...s.past.slice(-MAX_HISTORY + 1), cloneDrawing(cur)], future: [] }));
      };

      let dragging = false;
      let dragStart: Point | null = null;
      let dragHandle: string | null = null;

      const snapW = (p: Point) => (get().snap ? snapPoint(p, 0.5) : p);

      const devicesOf = () => current().elements.filter((el): el is Extract<Element, { kind: "device" }> => el.kind === "device");

      const cableSnap = () => {
        const z = get().viewport.zoom;
        return Math.max(1.35, 28 / (z * 22));
      };

      const applyCursor = (committed: Point[], world: Point): Point => {
        const s = get();
        if (s.tool === "cable") {
          const hit = nearestDevice(world, devicesOf(), cableSnap());
          if (hit) return hit.pos;
        }
        const p = snapW(world);
        const last = committed[committed.length - 1];
        if (last && (s.tool === "cable" || s.tool === "wall" || s.tool === "measure") && s.ortho) {
          return orthoSnap(last, p);
        }
        return p;
      };

      const nextCableLabel = (d: Drawing, kind: CableKind) => {
        const prefix: Record<CableKind, string> = {
          power: "P",
          cat6: "C6",
          hdmi: "H",
          sdi: "SDI",
          xlr: "X",
          usb: "U",
        };
        const used = new Set(
          d.elements.filter((el) => el.kind === "cable" && el.cable === kind).map((el) => el.kind === "cable" ? el.label : ""),
        );
        let i = 1;
        while (used.has(`${prefix[kind]}-${i}`)) i += 1;
        return `${prefix[kind]}-${i}`;
      };

      const commitCable = (pts: Point[], fromId?: string, toId?: string) => {
        if (pts.length < 2) return null;
        let id = "";
        mutate((d) => {
          id = uid("cb");
          d.elements.push({
            id,
            kind: "cable",
            cable: get().cableKind,
            points: pts,
            label: nextCableLabel(d, get().cableKind),
            fromId,
            toId,
          });
          return d;
        });
        return id;
      };



      return {
        drawings: [seed],
        currentId: seed.id,
        screen: "hub",
        tool: "select",
        deviceKind: "camera",
        cableKind: "cat6",
        catalogId: null,
        customCatalog: [],
        recentCatalogIds: [],
        showLibrary: false,
        equipSearchTick: 0,
        viewport: { ...DEFAULT_VIEWPORT },
        viewMode: "plan",
        selectedId: null,
        hoverId: null,
        draft: null,
        snap: true,
        ortho: true,
        showGrid: true,
        showLengths: false,
        showSchedule: false,
        spacePan: false,
        past: [],
        future: [],

        drawing: () => current(),
        schedule: () => buildSchedule(current()),
        catalog: () => [...STOCK_CATALOG, ...get().customCatalog],
        setScreen: (screen) => set({ screen, showLibrary: false, showSchedule: false, draft: null }),
        goBack: () => {
          const s = get();
          if (s.showLibrary) {
            set({ showLibrary: false });
            return;
          }
          if (s.showSchedule) {
            set({ showSchedule: false });
            return;
          }
          if (s.screen === "studio") {
            set({ screen: "hub", showLibrary: false, showSchedule: false, draft: null });
          }
        },
        goHome: () => {
          set({ screen: "hub", showLibrary: false, showSchedule: false, draft: null, selectedId: null });
        },
        openProject: (id) => {
          if (!get().drawings.some((d) => d.id === id)) return;
          set({
            currentId: id,
            screen: "studio",
            selectedId: null,
            draft: null,
            past: [],
            future: [],
            showLibrary: false,
            viewMode: "plan",
          });
          flushSave();
        },
        newProject: (opts) => {
          const d = opts?.template === "l3" ? compassionThirdFloor() : blankMetric(opts?.name ?? "Untitled drawing");
          if (opts?.name) {
            d.name = opts.name;
            d.meta = { ...d.meta, title: opts.name, project: opts.name };
          }
          if (opts?.underlay) d.underlay = opts.underlay;
          set((s) => ({
            drawings: [...s.drawings, d],
            currentId: d.id,
            screen: "studio",
            selectedId: null,
            draft: null,
            past: [],
            future: [],
            showLibrary: false,
            viewMode: "plan",
            viewport: { ...DEFAULT_VIEWPORT, x: -2, y: -2, zoom: 1 },
          }));
          flushSave();
        },
        deleteProject: (id) => {
          const s = get();
          const rest = s.drawings.filter((d) => d.id !== id);
          const next = rest.length ? rest : [blankMetric()];
          const currentId = s.currentId === id ? next[0]!.id : s.currentId;
          set({
            drawings: next,
            currentId,
            selectedId: null,
            draft: null,
            past: [],
            future: [],
            screen: "hub",
          });
          flushSave();
        },
        duplicateProject: (id) => {
          const src = get().drawings.find((d) => d.id === id);
          if (!src) return;
          const d = cloneDrawing(src);
          d.id = uid("dw");
          const base = src.name.replace(/\s+copy$/, "");
          d.name = `${base} copy`;
          d.meta = { ...d.meta, title: `${src.meta.title} copy` };
          set((s) => ({ drawings: [...s.drawings, d] }));
          flushSave();
        },
        setUnderlay: (u) =>
          mutate((d) => {
            if (u) d.underlay = u;
            else delete d.underlay;
            return d;
          }),
        setShowLibrary: (showLibrary) => set({ showLibrary }),
        focusEquipSearch: () => set((s) => ({ equipSearchTick: s.equipSearchTick + 1, showLibrary: false })),
        pickCatalogItem: (item) => {
          if (get().screen === "hub") {
            get().newProject({ template: "blank" });
          }
          const recent = [item.id, ...get().recentCatalogIds.filter((id) => id !== item.id)].slice(0, 12);
          if (item.cable && !item.kind) {
            set({ catalogId: item.id, cableKind: item.cable, tool: "cable", recentCatalogIds: recent, showLibrary: false });
            return;
          }
          set({
            catalogId: item.id,
            deviceKind: item.kind ?? get().deviceKind,
            tool: "device",
            recentCatalogIds: recent,
            showLibrary: false,
          });
        },
        addCustomEquipment: (raw) => {
          const item: CatalogItem = { ...raw, id: uid("eq"), custom: true };
          set((s) => ({ customCatalog: [...s.customCatalog, item] }));
          flushSave();
          return item;
        },
        removeCustomEquipment: (id) => {
          set((s) => ({
            customCatalog: s.customCatalog.filter((it) => it.id !== id),
            catalogId: s.catalogId === id ? null : s.catalogId,
          }));
          flushSave();
        },
        setTool: (t) => set({ tool: t, draft: null }),
        setDeviceKind: (k) => set({ deviceKind: k, tool: "device", catalogId: null }),
        setCableKind: (k) => set({ cableKind: k, tool: "cable", catalogId: null }),
        setViewport: (v) =>
          set((s) => ({
            viewport: normalizeViewport(typeof v === "function" ? v(s.viewport) : { ...s.viewport, ...v }),
          })),
        setViewMode: (m) => {
          const s = get();
          if (m === s.viewMode) return;
          if (m === "iso") {
            const rooms = current().elements.filter((el): el is Extract<Element, { kind: "room" }> => el.kind === "room");
            const hall = rooms.find((r) => r.scope === "contract") ?? rooms[0];
            const x = hall ? hall.x + hall.w / 2 : 4.5;
            const y = hall ? hall.y + hall.h / 2 : 12;
            set({
              viewMode: m,
              viewport: normalizeViewport({
                ...s.viewport,
                x,
                y,
                yaw: 0.22,
                pitch: 0.16,
                zoom: 0.72,
              }),
            });
            return;
          }
          set({ viewMode: m });
        },
        setHover: (id) => set({ hoverId: id }),
        setSelected: (id) => set({ selectedId: id }),
        toggleLayer: (id) =>
          mutate((d) => {
            d.layers[id] = !d.layers[id];
            return d;
          }, false),
        toggleSnap: () => set((s) => ({ snap: !s.snap })),
        toggleOrtho: () => set((s) => ({ ortho: !s.ortho })),
        toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
        toggleLengths: () => set((s) => ({ showLengths: !s.showLengths })),
        toggleSchedule: () => set((s) => ({ showSchedule: !s.showSchedule })),
        setSpacePan: (v) => set({ spacePan: v }),
        updateMeta: (patch) =>
          mutate((d) => {
            if (patch.name) d.name = patch.name;
            d.meta = { ...d.meta, ...patch };
            return d;
          }),
        loadTemplate: (build) => {
          const d = build();
          set((s) => ({
            drawings: [...s.drawings, d],
            currentId: d.id,
            selectedId: null,
            draft: null,
            past: [],
            future: [],
          }));
          flushSave();
        },
        resetPlot: () => {
          const cur = current();
          if (cur.meta.drawingNo !== "AV-L3-102") return;
          const d = compassionThirdFloor();
          d.id = cur.id;
          d.name = cur.name;
          commit(d);
        },
        newDrawing: () => {
          const d: Drawing = {
            id: uid("dw"),
            name: "Untitled drawing",
            meta: {
              project: "New project",
              drawingNo: "AV-001",
              title: "Cable Layout",
              author: "",
              date: new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              scaleLabel: "1:100",
              unit: "m",
            },
            elements: [],
            layers: { ...DEFAULT_LAYERS },
          };
          set((s) => ({
            drawings: [...s.drawings, d],
            currentId: d.id,
            screen: "studio",
            selectedId: null,
            draft: null,
            past: [],
            future: [],
            viewport: { ...DEFAULT_VIEWPORT, x: -2, y: -2, zoom: 1 },
          }));
          flushSave();
        },
        switchDrawing: (id) => {
          set({ currentId: id, selectedId: null, draft: null, past: [], future: [] });
          flushSave();
        },

        hitTest: (world) => {
          const d = current();
          const layers = d.layers;
          const zoom = get().viewport.zoom;
          const visible = d.elements.filter((el) => {
            if (el.kind === "wall" || el.kind === "room") return layers.architecture;
            if (el.kind === "note") return layers.notes;
            if (el.kind === "cable") {
              const layer = el.cable === "power" ? "power" : el.cable === "cat6" ? "data" : "av";
              return layers[layer];
            }
            if (el.kind === "trunk") return layers.data;
            if (el.kind === "device") {
              if (el.device === "door") return layers.architecture;
              if (["outlet", "switch", "panel", "pdu", "jbox"].includes(el.device)) return layers.power;
              if (["camera", "rack", "datajack", "netswitch", "zoompc"].includes(el.device)) return layers.data;
              return layers.av;
            }
            return true;
          });

          const selected = visible.find((el) => el.id === get().selectedId);
          if (selected && selected.kind !== "device") {
            const handle = nearestHandle(selected, world, 0.35);
            if (handle) return selected;
          }

          for (let i = visible.length - 1; i >= 0; i--) {
            const el = visible[i]!;
            if (el.kind === "device") {
              if (dist(world, el.pos) < devicePickRadius(el, zoom)) return el;
              if (el.label) {
                const o = deviceLabelOffset(el);
                const label = { x: el.pos.x + o.x, y: el.pos.y + o.y };
                if (dist(world, label) < Math.max(0.55, 20 / Math.max(0.2, zoom * 22))) return el;
              }
            }
            if (el.kind === "note" && pointInRect(world, { x: el.pos.x, y: el.pos.y, w: 8, h: 4 }))
              return el;
          }
          for (let i = visible.length - 1; i >= 0; i--) {
            const el = visible[i]!;
            if ((el.kind === "cable" || el.kind === "trunk") && distToPolyline(world, el.points) < 0.55) return el;
            if (el.kind === "wall" && distToSegment(world, el.a, el.b) < 0.45) return el;
          }
          for (let i = visible.length - 1; i >= 0; i--) {
            const el = visible[i]!;
            if (el.kind === "room" && roomEdgeHit(world, el)) return el;
          }
          return null;
        },

        pointerDown: (world, handle) => {
          const s = get();
          const p = snapW(world);
          const tool = s.spacePan ? "pan" : s.tool;
          if (tool === "pan") return "pan";

          if (handle && handle !== "move" && s.selectedId) {
            checkpoint();
            dragging = true;
            dragPersist.pause = true;
            dragStart = world;
            dragHandle = handle;
            if (s.tool === "device") set({ tool: "select" });
            return "drag";
          }

          if (tool === "select") {
            const selected = s.selectedId
              ? current().elements.find((el) => el.id === s.selectedId)
              : null;
            if (selected && handle && handle !== "move") {
              checkpoint();
              dragging = true;
              dragPersist.pause = true;
              dragStart = world;
              dragHandle = handle;
              return "drag";
            }
            const hit = s.hitTest(world);
            set({ selectedId: hit?.id ?? null, hoverId: hit?.id ?? null });
            if (!hit) {
              dragging = false;
              dragHandle = null;
              return "pan";
            }
            get().beginMove(hit.id, world);
            return "drag";
          }

          if (tool === "device") {
            const hit = s.hitTest(world);
            if (hit?.kind === "device") {
              get().beginMove(hit.id, world);
              return "drag";
            }
            const cat = findCatalogItem(get().catalog(), get().catalogId ?? undefined);
            let id = "";
            mutate((d) => {
              id = uid("dv");
              d.elements.push({
                id,
                kind: "device",
                device: cat?.kind ?? s.deviceKind,
                pos: p,
                rotation: 0,
                label: cat?.short ?? "",
                catalogId: cat?.id,
                brand: cat?.brand,
                model: cat?.model,
                circuit: cat?.spec,
              });
              return d;
            });
            set({ selectedId: id, tool: "select" });
            return "draw";
          }

          if (tool === "note") {
            mutate((d) => {
              d.elements.push({
                id: uid("nt"),
                kind: "note",
                pos: p,
                text: "Note",
              });
              return d;
            });
            return "draw";
          }

          if (tool === "cable") {
            const hit = nearestDevice(world, devicesOf(), cableSnap());
            const at = hit ? hit.pos : applyCursor(s.draft?.committed ?? [], world);
            const draft = s.draft;
            if (!draft) {
              set({ draft: { committed: [at], cursor: at, fromId: hit?.id }, hoverId: hit?.id ?? null });
              return "draw";
            }
            if (hit && hit.id !== draft.fromId) {
              const pts = [...draft.committed];
              const last = pts[pts.length - 1]!;
              if (dist(last, at) > 0.05) {
                if (s.ortho) {
                  const jog = orthoSnap(last, at);
                  if (dist(jog, at) > 0.08 && dist(jog, last) > 0.08) pts.push(jog);
                }
                pts.push(at);
              }
              const id = commitCable(pts, draft.fromId, hit.id);
              set({ draft: null, hoverId: null, selectedId: id });
              return "draw";
            }
            set({
              draft: { committed: [...draft.committed, at], cursor: at, fromId: draft.fromId },
              hoverId: hit?.id ?? null,
            });
            return "draw";
          }

          if (tool === "wall" || tool === "measure" || tool === "room") {
            const draft = s.draft;
            if (!draft) {
              set({ draft: { committed: [p], cursor: p } });
              return "draw";
            }
            const cursor = applyCursor(draft.committed, world);
            if (tool === "room") {
              const a = draft.committed[0]!;
              const x = Math.min(a.x, cursor.x);
              const y = Math.min(a.y, cursor.y);
              const w = Math.max(1, Math.abs(cursor.x - a.x));
              const h = Math.max(1, Math.abs(cursor.y - a.y));
              mutate((d) => {
                d.elements.push({
                  id: uid("rm"),
                  kind: "room",
                  x,
                  y,
                  w,
                  h,
                  name: "Room",
                });
                return d;
              });
              set({ draft: null });
              return "draw";
            }
            if (tool === "measure") {
              set({ draft: { committed: [draft.committed[0]!, cursor], cursor } });
              return "draw";
            }
            set({ draft: { committed: [...draft.committed, cursor], cursor } });
            return "draw";
          }
          return "draw";
        },

        pointerMove: (world) => {
          const s = get();
          if (dragging && s.tool === "select" && !s.spacePan && dragStart) {
            if (dragHandle && dragHandle !== "move") {
              mutate((d) => {
                d.elements = d.elements.map((el) =>
                  el.id === s.selectedId
                    ? applyHandle(el, dragHandle!, world, { snap: s.snap, ortho: s.ortho })
                    : el,
                );
                return d;
              }, false);
              return;
            }
            get().nudgeLive(world);
            return;
          }
          if (s.draft) {
            const hit = s.tool === "cable" ? nearestDevice(world, devicesOf(), cableSnap()) : null;
            set({
              draft: {
                committed: s.draft.committed,
                cursor: hit ? hit.pos : applyCursor(s.draft.committed, world),
                fromId: s.draft.fromId,
              },
              hoverId: hit?.id ?? (s.tool === "select" ? s.hoverId : null),
            });
            return;
          }
          if (s.tool === "select") {
            const hit = s.hitTest(world);
            if (hit?.id !== s.hoverId) set({ hoverId: hit?.id ?? null });
          } else if (s.tool === "cable" && !s.draft) {
            const hit = nearestDevice(world, devicesOf(), cableSnap());
            if (hit?.id !== s.hoverId) set({ hoverId: hit?.id ?? null });
          }
        },

        beginMove: (id, world) => {
          checkpoint();
          dragging = true;
          dragPersist.pause = true;
          dragStart = world;
          dragHandle = "move";
          set({ selectedId: id, hoverId: id, tool: "select" });
          setLiveDrag({ id, dx: 0, dy: 0 });
        },

        nudgeLive: (world) => {
          if (!dragging || !dragStart) return;
          const id = get().selectedId;
          if (!id) return;
          setLiveDrag({
            id,
            dx: world.x - dragStart.x,
            dy: world.y - dragStart.y,
          });
        },

        pointerUp: () => {
          const drag = getLiveDrag();
          const wasDragging = dragging;
          const handle = dragHandle;
          dragging = false;
          dragStart = null;
          dragHandle = null;
          dragPersist.pause = false;
          if (drag && handle === "move") {
            const { id, dx, dy } = drag;
            setLiveDrag(null);
            if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
              mutate((d) => {
                d.elements = d.elements.map((el) => {
                  if (el.id !== id) return el;
                  const moved = offsetElement(el, dx, dy);
                  if (get().snap && (moved.kind === "device" || moved.kind === "note")) {
                    return { ...moved, pos: snapPoint(moved.pos, 0.5) };
                  }
                  return moved;
                });
                return d;
              }, false);
              flushSave();
              return;
            }
          } else {
            setLiveDrag(null);
          }
          if (wasDragging && get().snap && handle && handle !== "move") {
            const id = get().selectedId;
            if (id) {
              mutate((d) => {
                d.elements = d.elements.map((el) => {
                  if (el.id !== id) return el;
                  if (el.kind === "device" || el.kind === "note") {
                    return { ...el, pos: snapPoint(el.pos, 0.5) };
                  }
                  return el;
                });
                return d;
              }, false);
            }
          } else if (wasDragging) {
            set((s) => ({ selectedId: s.selectedId }));
          }
          flushSave();
        },

        cancelDraft: () => set({ draft: null, hoverId: null }),

        undoDraft: () => {
          const draft = get().draft;
          if (!draft) return false;
          if (draft.committed.length > 1) {
            const committed = draft.committed.slice(0, -1);
            set({
              draft: { ...draft, committed, cursor: committed[committed.length - 1]! },
            });
            return true;
          }
          set({ draft: null, hoverId: null });
          return true;
        },

        finishDraft: () => {
          const s = get();
          const draft = s.draft;
          if (!draft) return;
          const pts =
            dist(draft.committed[draft.committed.length - 1]!, draft.cursor) > 0.05
              ? [...draft.committed, draft.cursor]
              : draft.committed;
          if (pts.length < 2) {
            set({ draft: null });
            return;
          }
          if (s.tool === "wall") {
            mutate((d) => {
              for (let i = 1; i < pts.length; i++) {
                d.elements.push({
                  id: uid("w"),
                  kind: "wall",
                  a: pts[i - 1]!,
                  b: pts[i]!,
                });
              }
              return d;
            });
          } else if (s.tool === "cable") {
            const end = nearestDevice(pts[pts.length - 1]!, devicesOf(), cableSnap());
            const id = commitCable(pts, draft.fromId, end?.id);
            set({ draft: null, selectedId: id });
            return;
          }
          set({ draft: null });
        },

        moveSelected: (dx, dy) => {
          const id = get().selectedId;
          if (!id) return;
          mutate((d) => {
            d.elements = d.elements.map((el) => {
              if (el.id !== id) return el;
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
                return {
                  ...el,
                  points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
                };
              }
              return el;
            });
            return d;
          });
        },

        deleteSelected: () => {
          if (get().undoDraft()) return;
          const id = get().selectedId;
          if (!id) return;
          mutate((d) => {
            d.elements = d.elements.filter((e) => e.id !== id);
            return d;
          });
          set({ selectedId: null });
        },

        duplicateSelected: () => {
          const id = get().selectedId;
          if (!id) return;
          let newId = "";
          mutate((d) => {
            const el = d.elements.find((e) => e.id === id);
            if (!el) return d;
            const copy = structuredClone(el);
            copy.id = uid("el");
            newId = copy.id;
            if (copy.kind === "device" || copy.kind === "note") {
              copy.pos = { x: copy.pos.x + 1, y: copy.pos.y + 1 };
            } else if (copy.kind === "room") {
              copy.x += 1;
              copy.y += 1;
            } else if (copy.kind === "wall") {
              copy.a = { x: copy.a.x + 1, y: copy.a.y + 1 };
              copy.b = { x: copy.b.x + 1, y: copy.b.y + 1 };
            } else if (copy.kind === "cable" || copy.kind === "trunk") {
              copy.points = copy.points.map((p) => ({ x: p.x + 1, y: p.y + 1 }));
            }
            d.elements.push(copy);
            return d;
          });
          if (newId) set({ selectedId: newId });
        },

        updateSelected: (patch) => {
          const id = get().selectedId;
          if (!id) return;
          mutate((d) => {
            d.elements = d.elements.map((el) =>
              el.id === id ? ({ ...el, ...patch } as Element) : el,
            );
            return d;
          });
        },

        undo: () => {
          if (get().undoDraft()) return;
          const { past, future, currentId } = get();
          if (past.length === 0) return;
          const prev = cloneDrawing(past[past.length - 1]!);
          const cur = cloneDrawing(current());
          const others = get().drawings.filter((d) => d.id !== currentId && d.id !== prev.id);
          set({
            drawings: [...others, prev],
            currentId: prev.id,
            past: past.slice(0, -1),
            future: [...future, cur],
            selectedId: null,
            draft: null,
            hoverId: null,
          });
          flushSave();
        },
        redo: () => {
          if (get().draft) {
            set({ draft: null, hoverId: null });
          }
          const { future, past, currentId } = get();
          if (future.length === 0) return;
          const next = cloneDrawing(future[future.length - 1]!);
          const cur = cloneDrawing(current());
          const others = get().drawings.filter((d) => d.id !== currentId && d.id !== next.id);
          set({
            drawings: [...others, next],
            currentId: next.id,
            future: future.slice(0, -1),
            past: [...past, cur],
            selectedId: null,
            draft: null,
            hoverId: null,
          });
          flushSave();
        },
        importJson: (json) => {
          try {
            const data = JSON.parse(json) as Drawing;
            if (!data || !Array.isArray(data.elements) || !drawingIsAv(data)) return false;
            data.id = uid("dw");
            if (!data.layers) data.layers = { ...DEFAULT_LAYERS };
            if (!data.meta) return false;
            set((s) => ({
              drawings: [...s.drawings, data],
              currentId: data.id,
              past: [],
              future: [],
            }));
            flushSave();
            return true;
          } catch {
            return false;
          }
        },
      };
    },
    {
      name: PERSIST_KEY,
      version: 21,
      storage: createJSONStorage(liveStorage),
      partialize: (s) => ({
        drawings: s.drawings,
        currentId: s.currentId,
        screen: s.screen,
        snap: s.snap,
        ortho: s.ortho,
        showGrid: s.showGrid,
        showLengths: s.showLengths,
        customCatalog: s.customCatalog,
        recentCatalogIds: s.recentCatalogIds,
        past: s.past.slice(-20),
        future: s.future.slice(-20),
      }),
      migrate: (persisted) => {
        const prev = persisted as {
          drawings?: Drawing[];
          currentId?: string;
          screen?: "hub" | "studio";
          snap?: boolean;
          ortho?: boolean;
          showGrid?: boolean;
          showLengths?: boolean;
          customCatalog?: CatalogItem[];
          recentCatalogIds?: string[];
          past?: Drawing[];
          future?: Drawing[];
        } | null;
        const kept = (prev?.drawings ?? [])
          .filter(drawingIsAv)
          .map(applyStageCat6Trunks)
          .map(applySpeakerHdmiTrunks)
          .map(applyCenter55s)
          .map(applyWallNeatBars)
          .map(applyCatalogStamps)
          .map((d) =>
            d.meta?.author === "Raceway" ? { ...d, meta: { ...d.meta, author: "CI AVS" } } : d,
          );
        const past = (prev?.past ?? []).filter(drawingIsAv).slice(-20);
        const future = (prev?.future ?? []).filter(drawingIsAv).slice(-20);
        const extras = {
          customCatalog: prev?.customCatalog ?? [],
          recentCatalogIds: prev?.recentCatalogIds ?? [],
          screen: prev?.screen ?? "hub",
        };
        if (kept.length > 0) {
          const currentId = kept.some((d) => d.id === prev?.currentId) ? prev!.currentId! : kept[0]!.id;
          return {
            drawings: kept,
            currentId,
            snap: prev?.snap ?? true,
            ortho: prev?.ortho ?? true,
            showGrid: prev?.showGrid ?? true,
            showLengths: prev?.showLengths ?? false,
            past,
            future,
            ...extras,
          };
        }
        const d = compassionThirdFloor();
        return {
          drawings: [d],
          currentId: d.id,
          snap: true,
          ortho: true,
          showGrid: true,
          showLengths: false,
          past,
          future,
          ...extras,
        };
      },
      skipHydration: true,
      onRehydrateStorage: () => () => {
        setSaveStatus("saved");
      },
    },
  ),
);

export function selectedElement(): Element | null {
  const s = useStore.getState();
  const id = s.selectedId;
  if (!id) return null;
  return s.drawing().elements.find((e) => e.id === id) ?? null;
}

export function useDrawing(): Drawing {
  return useStore((s) => s.drawings.find((d) => d.id === s.currentId) ?? s.drawings[0] ?? seed);
}
