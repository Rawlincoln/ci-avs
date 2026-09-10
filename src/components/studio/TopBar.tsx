import { Box, ClipboardList, ChevronDown, Download, FileJson, FileText, Grid3x3, Image, Library, Magnet, Maximize2, Minus, Plus, Redo2, RotateCcw, RotateCw, Tag, Undo2, Upload } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { downloadJson, downloadPdf, downloadPng } from "@/lib/drawing/export";
import { fitDrawing, orbitCamera, zoomCamera } from "@/lib/drawing/render";
import { getSaveStatus, subscribeSaveStatus, useDrawing, useStore } from "@/lib/drawing/store";
import { cn } from "@/lib/utils";
import { canvasWrapSize } from "@/lib/drawing/export";
import { fileToUnderlay } from "@/lib/drawing/underlay";
import { NavButtons } from "./NavButtons";

export function TopBar() {
  const drawing = useDrawing();
  const snap = useStore((s) => s.snap);
  const ortho = useStore((s) => s.ortho);
  const showGrid = useStore((s) => s.showGrid);
  const showLengths = useStore((s) => s.showLengths);
  const showSchedule = useStore((s) => s.showSchedule);
  const viewMode = useStore((s) => s.viewMode);
  const zoom = useStore((s) => s.viewport.zoom);
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const hasDraft = useStore((s) => Boolean(s.draft));
  const canUndo = past > 0 || hasDraft;
  const canRedo = future > 0 && !hasDraft;
  const [exporting, setExporting] = useState(false);

  const onPdf = () => {
    if (exporting) return;
    setExporting(true);
    void downloadPdf("set").finally(() => setExporting(false));
  };

  const onPdf3d = () => {
    if (exporting) return;
    setExporting(true);
    void downloadPdf("3d").finally(() => setExporting(false));
  };

  const onImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      useStore.getState().importJson(text);
    };
    input.click();
  };

  const onUnderlay = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const underlay = await fileToUnderlay(file);
        useStore.getState().setUnderlay(underlay);
      } catch {
        /* ignore */
      }
    };
    input.click();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <NavButtons />
      <div className="flex min-w-0 items-center gap-2.5">
        <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => useStore.getState().goHome()}>
        <Mark />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight tracking-tight">CI AVS</p>
          <p className="truncate text-xs text-muted">{drawing.meta.drawingNo}</p>
        </div>
        </button>
      </div>
      <Separator vertical className="mx-1 h-7" />
      <div className="flex rounded-sm bg-bg p-0.5 shadow-border">
        <button
          type="button"
          onClick={() => useStore.getState().setViewMode("plan")}
          className={cn(
            "h-8 rounded-sm px-3 text-xs font-medium",
            viewMode === "plan" ? "bg-surface-2 text-fg" : "text-muted",
          )}
        >
          Plan 2D
        </button>
        <button
          type="button"
          onClick={() => useStore.getState().setViewMode("iso")}
          className={cn(
            "h-8 rounded-sm px-3 text-xs font-medium",
            viewMode === "iso" ? "bg-surface-2 text-fg" : "text-muted",
          )}
        >
          3D
        </button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="hidden md:inline-flex"
        onClick={() => useStore.getState().goHome()}
      >
        New
      </Button>
      {drawing.meta.drawingNo === "AV-L3-102" ? (
        <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => useStore.getState().resetPlot()}>
          Reset plot
        </Button>
      ) : null}
      <SaveBadge />
      <div className="ml-auto flex items-center gap-1">
        <Tooltip content="Undo last change · ⌘Z" side="bottom">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => useStore.getState().undo()}
          >
            <Undo2 className="size-4" />
            <span className="hidden md:inline">Undo</span>
          </Button>
        </Tooltip>
        <Tooltip content="Redo · ⌘⇧Z" side="bottom">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => useStore.getState().redo()}
          >
            <Redo2 className="size-4" />
            <span className="hidden sm:inline">Redo</span>
          </Button>
        </Tooltip>
        <Separator vertical className="mx-1 h-7" />
        <Toggle
          label="Snap"
          active={snap}
          onClick={() => useStore.getState().toggleSnap()}
          icon={<Magnet className="size-3.5" />}
        />
        <Toggle
          label="Ortho"
          active={ortho}
          onClick={() => useStore.getState().toggleOrtho()}
          icon={<RotateCcw className="size-3.5" />}
        />
        <Toggle
          label="Grid"
          active={showGrid}
          onClick={() => useStore.getState().toggleGrid()}
          icon={<Grid3x3 className="size-3.5" />}
        />
        <Toggle
          label="Tags"
          active={showLengths}
          onClick={() => useStore.getState().toggleLengths()}
          icon={<Tag className="size-3.5" />}
        />
        <span className="hidden w-12 text-center font-mono text-xs tabular-nums text-muted md:inline">
          {Math.round(zoom * 100)}%
        </span>
        <div className="hidden items-center md:flex">
        <Tooltip content="Zoom out" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => {
              const s = useStore.getState();
              const { width, height } = canvasWrapSize();
              s.setViewport(zoomCamera(s.viewport, s.viewMode, width, height, s.viewport.zoom / 1.15));
            }}
          >
            <Minus className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Zoom in" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => {
              const s = useStore.getState();
              const { width, height } = canvasWrapSize();
              s.setViewport(zoomCamera(s.viewport, s.viewMode, width, height, s.viewport.zoom * 1.15));
            }}
          >
            <Plus className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Rotate left · Q" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Rotate left"
            onClick={() => {
              const s = useStore.getState();
              const { width, height } = canvasWrapSize();
              const step = s.viewMode === "iso" ? Math.PI / 4 : Math.PI / 12;
              s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, -step));
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Fit view · 0" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fit view"
            onClick={() => {
              const s = useStore.getState();
              const { width, height } = canvasWrapSize();
              s.setViewport(fitDrawing(s.drawing(), width, height, s.viewMode));
            }}
          >
            <Maximize2 className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Rotate right · E" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Rotate right"
            onClick={() => {
              const s = useStore.getState();
              const { width, height } = canvasWrapSize();
              const step = s.viewMode === "iso" ? Math.PI / 4 : Math.PI / 12;
              s.setViewport(orbitCamera(s.viewport, s.viewMode, width, height, step));
            }}
          >
            <RotateCw className="size-4" />
          </Button>
        </Tooltip>
        </div>
        <Separator vertical className="mx-1 h-7" />
        <Tooltip content="Add equipment · /" side="bottom">
          <Button variant="ghost" size="icon-sm" aria-label="Add equipment" onClick={() => useStore.getState().focusEquipSearch()}>
            <Library className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Pull schedule" side="bottom">
          <Button
            variant={showSchedule ? "default" : "ghost"}
            size="icon-sm"
            aria-label="Cable schedule"
            onClick={() => useStore.getState().toggleSchedule()}
          >
            <ClipboardList className="size-4" />
          </Button>
        </Tooltip>
        <Tooltip content="Import JSON" side="bottom">
          <Button variant="ghost" size="icon-sm" aria-label="Import" onClick={onImport}>
            <Upload className="size-4" />
          </Button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="Export drawing" disabled={exporting}>
              <Download className="size-3.5" />
              {exporting ? "Exporting" : "Export"}
              <ChevronDown className="size-3.5 text-muted" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={downloadPng}>
              <Image className="size-4 text-muted" />
              PNG image
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPdf} disabled={exporting}>
              <FileText className="size-4 text-muted" />
              PDF drawing set
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onPdf3d} disabled={exporting}>
              <Box className="size-4 text-muted" />
              PDF 3D view
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onUnderlay}>
              <Upload className="size-4 text-muted" />
              Trace floor plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useStore.getState().setUnderlay(undefined)}>
              Clear floor plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={downloadJson}>
              <FileJson className="size-4 text-muted" />
              JSON project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function SaveBadge() {
  const status = useSyncExternalStore(subscribeSaveStatus, getSaveStatus, () => "saved" as const);
  return (
    <span
      className="hidden font-mono text-xs tracking-wide text-muted sm:inline"
      title="Edits save as you go. Undo or delete to drop a change. A cable you abandon is never stored."
    >
      {status === "saving" ? "Saving" : "Saved"}
    </span>
  );
}

function Toggle({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "hidden h-8 items-center gap-1.5 rounded-sm px-2 text-xs md:inline-flex",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Mark() {
  return (
    <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg" aria-hidden>
      <Box className="size-4" />
    </span>
  );
}
