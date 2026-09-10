import { useEffect, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fitDrawing, isoOrigin, isoToWorld, orbitCamera, panByPixels, screenToWorld, zoomCamera } from "@/lib/drawing/render";
import { findCatalogItem, STOCK_CATALOG } from "@/lib/drawing/catalog";
import { selectedElement, useDrawing, useStore, flushSave } from "@/lib/drawing/store";
import type { Tool } from "@/lib/drawing/types";
import { cn } from "@/lib/utils";
import { DrawingCanvas } from "./DrawingCanvas";
import { Hub } from "./Hub";
import { Inspector, Legend, SheetKey } from "./Inspector";
import { AddEquipment } from "./AddEquipment";
import { Library } from "./Library";
import { SchedulePanel } from "./SchedulePanel";
import { CABLES, DEVICES, Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  h: "pan",
  w: "wall",
  r: "room",
  c: "cable",
  d: "device",
  n: "note",
  m: "measure",
};

export function Studio() {
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);

  const screen = useStore((s) => s.screen);

  useEffect(() => {
    const flush = () => flushSave();
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        if (e.key === "Escape") (t as HTMLInputElement).blur();
        return;
      }
      const s = useStore.getState();
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        s.setSpacePan(true);
        return;
      }
      if (e.key === "Escape") {
        if (s.showLibrary || s.showSchedule) {
          s.goBack();
          return;
        }
        s.cancelDraft();
        return;
      }
      if (e.key === "/" || e.key.toLowerCase() === "l") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          if (e.key.toLowerCase() === "l") s.setShowLibrary(true);
          else s.focusEquipSearch();
          return;
        }
      }
      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        const el = selectedElement();
        if (el?.kind === "device") {
          e.preventDefault();
          const delta = e.shiftKey ? -15 : 15;
          const next = (((el.rotation + delta) % 360) + 360) % 360;
          s.updateSelected({ rotation: next });
          return;
        }
      }
      if (e.key === "Enter") {
        s.finishDraft();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (s.draft) s.undoDraft();
        else s.deleteSelected();
        return;
      }
      const undoKey = (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "z" || e.code === "KeyZ");
      if (undoKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || e.code === "KeyY")) {
        e.preventDefault();
        e.stopPropagation();
        s.redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushSave();
        return;
      }
      if (e.key === "g") {
        s.toggleGrid();
        return;
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap) {
          const { width, height } = wrap.getBoundingClientRect();
          const step = s.viewMode === "iso" ? Math.PI / 4 : Math.PI / 12;
          s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, -step));
        }
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap) {
          const { width, height } = wrap.getBoundingClientRect();
          const step = s.viewMode === "iso" ? Math.PI / 4 : Math.PI / 12;
          s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, step));
        }
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap && s.viewMode === "iso") {
          const { width, height } = wrap.getBoundingClientRect();
          s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, 0, 0.12));
        }
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap && s.viewMode === "iso") {
          const { width, height } = wrap.getBoundingClientRect();
          s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, 0, -0.12));
        }
        return;
      }
      if (e.key === "[" || e.key === "-" || e.key === "_") {
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap) {
          const { width, height } = wrap.getBoundingClientRect();
          s.setViewport(zoomCamera(s.viewport, s.viewMode, width, height, s.viewport.zoom * 0.9));
        }
        return;
      }
      if (e.key === "]" || e.key === "=" || e.key === "+") {
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap) {
          const { width, height } = wrap.getBoundingClientRect();
          s.setViewport(zoomCamera(s.viewport, s.viewMode, width, height, s.viewport.zoom * 1.1));
        }
        return;
      }
      if (e.key === "0") {
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (wrap) {
          const { width, height } = wrap.getBoundingClientRect();
          s.setViewport(fitDrawing(s.drawing(), width, height, s.viewMode));
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const wrap = document.querySelector("[data-canvas-wrap]");
        if (!wrap) return;
        const { width, height } = wrap.getBoundingClientRect();
        const step = e.shiftKey ? 24 : 56;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (e.shiftKey && s.selectedId) {
          const origin = isoOrigin(width, height);
          const a =
            s.viewMode === "iso"
              ? isoToWorld({ x: 0, y: 0 }, s.viewport, origin)
              : screenToWorld({ x: 0, y: 0 }, s.viewport);
          const b =
            s.viewMode === "iso"
              ? isoToWorld({ x: dx, y: dy }, s.viewport, origin)
              : screenToWorld({ x: dx, y: dy }, s.viewport);
          s.moveSelected(b.x - a.x, b.y - a.y);
        } else {
          s.setViewport(panByPixels(s.viewport, s.viewMode, width, height, dx, dy));
        }
        return;
      }
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.metaKey && !e.ctrlKey) s.setTool(tool);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " ") useStore.getState().setSpacePan(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return (
    <TooltipProvider>
      {screen === "hub" ? (
        <Hub />
      ) : (
        <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
          <h1 className="sr-only">CI AVS — AV install design</h1>
          <TopBar />
          <div className="flex min-h-0 flex-1 max-md:flex-col">
            <Toolbar />
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" data-canvas-wrap>
              <DrawingCanvas />
              <AddEquipment />
              <Legend />
              <MobileKey />
              <MobilePalette />
              <SchedulePanel />
              <Library />
            </div>
            <Inspector />
          </div>
          <StatusBar />
        </div>
      )}
    </TooltipProvider>
  );
}

function StatusBar() {
  const drawing = useDrawing();
  const tool = useStore((s) => s.tool);
  const snap = useStore((s) => s.snap);
  const ortho = useStore((s) => s.ortho);
  const viewMode = useStore((s) => s.viewMode);
  const viewport = useStore((s) => s.viewport);
  const catalogId = useStore((s) => s.catalogId);
  const custom = useStore((s) => s.customCatalog);
  const picked = findCatalogItem([...STOCK_CATALOG, ...custom], catalogId ?? undefined);
  const n = drawing.elements.length;
  const angle =
    viewMode === "iso"
      ? Math.round(((((viewport.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180) / Math.PI)
      : Math.round(((((viewport.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 180) / Math.PI);
  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 font-mono text-xs tabular-nums text-muted max-md:hidden">
      <span className="uppercase tracking-wider">{viewMode === "iso" ? "3d" : tool}</span>
      <span>{n} objects</span>
      <span>unit {drawing.meta.unit}</span>
      <span>{snap ? "snap" : "free"}</span>
      <span>{ortho ? "ortho" : "any"}</span>
      <span>{Math.round(viewport.zoom * 100)}%</span>
      <span>{viewMode === "iso" ? `yaw ${angle}° · elev ${Math.round((0.62 + viewport.pitch) * (180 / Math.PI))}°` : `rot ${angle}°`}</span>
      {picked ? (
        <span className="truncate text-fg">
          {picked.brand} {picked.model}
        </span>
      ) : null}
      <span className="ml-auto truncate">{drawing.meta.project}</span>
    </footer>
  );
}

function MobileKey() {
  const tool = useStore((s) => s.tool);
  const [open, setOpen] = useState(false);
  if (tool === "cable" || tool === "device") return null;
  return (
    <div className="absolute left-2 top-14 z-10 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-9 rounded-md bg-bg/90 px-3 text-xs font-medium text-fg shadow-border"
      >
        {open ? "Close key" : "Sheet key"}
      </button>
      {open ? (
        <div className="mt-1 max-h-72 w-56 overflow-y-auto rounded-md bg-bg/95 p-2 shadow-border">
          <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-subtle">On this sheet</p>
          <SheetKey compact />
        </div>
      ) : null}
    </div>
  );
}

function MobilePalette() {
  const tool = useStore((s) => s.tool);
  const cableKind = useStore((s) => s.cableKind);
  const deviceKind = useStore((s) => s.deviceKind);
  if (tool !== "cable" && tool !== "device") return null;
  return (
    <div className="pointer-events-auto absolute inset-x-2 top-14 flex gap-1 overflow-x-auto rounded-md bg-bg/90 p-1 md:hidden">
      {tool === "cable"
        ? CABLES.map((c) => (
            <Chip
              key={c.id}
              active={cableKind === c.id}
              onClick={() => useStore.getState().setCableKind(c.id)}
            >
              <span className={cn("size-2 rounded-full", c.fill)} />
              {c.label}
            </Chip>
          ))
        : DEVICES.map((d) => (
            <Chip
              key={d.id}
              active={deviceKind === d.id}
              onClick={() => useStore.getState().setDeviceKind(d.id)}
            >
              {d.label}
            </Chip>
          ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-xs",
        active ? "bg-primary text-primary-fg" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}
