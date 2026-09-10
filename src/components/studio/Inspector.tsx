import { Eye, EyeOff, Minus, Plus, RotateCcw, RotateCw } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CABLE_COLOR, CABLE_DASH, PAPER, TRUNK_STROKE } from "@/lib/drawing/palette";
import { formatLength, polylineLength, pullLength } from "@/lib/drawing/geometry";
import { paintDeviceGlyph } from "@/lib/drawing/render";
import { sheetKey } from "@/lib/drawing/sheetKey";
import { selectedElement, useDrawing, useStore } from "@/lib/drawing/store";
import {
  CABLE_META,
  DEVICE_META,
  LAYER_META,
  type CableKind,
  type DeviceKind,
  type LayerId,
  type MountKind,
} from "@/lib/drawing/types";
import { cn } from "@/lib/utils";

function focusRow(id: string) {
  const s = useStore.getState();
  s.setTool("select");
  s.setSelected(id);
}

function DeviceGlyph({ device, mount }: { device: DeviceKind; mount?: MountKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const css = 28;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, css, css);
    paintDeviceGlyph(ctx, device, mount, css);
  }, [device, mount]);
  return (
    <canvas
      ref={ref}
      width={28}
      height={28}
      className="size-7 shrink-0 rounded-sm bg-paper"
      aria-hidden
    />
  );
}

export function SheetKey({ compact = false }: { compact?: boolean }) {
  const drawing = useDrawing();
  const selectedId = useStore((s) => s.selectedId);
  const key = sheetKey(drawing);
  return (
    <ul className="grid">
      {key.map((row) => {
        const active = row.id === selectedId;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => focusRow(row.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-1 text-left",
                compact ? "h-11" : "h-9",
                active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <DeviceGlyph device={row.device} mount={row.mountKind} />
              <span className="w-10 shrink-0 font-mono text-xs text-fg">{row.tag}</span>
              <span className="min-w-0 truncate text-xs">{row.name}</span>
              {row.mount ? (
                <span className="ml-auto shrink-0 text-xs uppercase tracking-wide text-subtle">{row.mount}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Inspector() {
  const drawing = useDrawing();
  const selectedId = useStore((s) => s.selectedId);
  const layers = drawing.layers;
  const el = useStore((s) => {
    void s.selectedId;
    void s.drawings;
    void s.currentId;
    return selectedElement();
  });

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface md:flex">
      <div className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">On this sheet</p>
        <div className="mt-2">
          <SheetKey />
        </div>
      </div>
      <Separator />
      <div className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">Drawing</p>
        <div className="mt-3 grid gap-3">
          <Field
            label="Title"
            value={drawing.meta.title}
            onChange={(v) => useStore.getState().updateMeta({ title: v, name: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Number"
              value={drawing.meta.drawingNo}
              onChange={(v) => useStore.getState().updateMeta({ drawingNo: v })}
            />
            <Field
              label="Scale"
              value={drawing.meta.scaleLabel}
              onChange={(v) => useStore.getState().updateMeta({ scaleLabel: v })}
            />
          </div>
          {drawing.underlay ? (
            <Field
              label="Plan opacity"
              value={String(drawing.underlay.opacity)}
              onChange={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return;
                useStore.getState().setUnderlay({ ...drawing.underlay!, opacity: Math.min(1, Math.max(0.08, n)) });
              }}
            />
          ) : null}
        </div>
      </div>
      <Separator />
      <div className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">Layers</p>
        <ul className="mt-2 grid gap-1">
          {(Object.keys(LAYER_META) as LayerId[]).map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => useStore.getState().toggleLayer(id)}
                className="flex h-9 w-full items-center justify-between rounded-sm px-2 text-sm text-fg hover:bg-surface-2"
              >
                {LAYER_META[id].label}
                {layers[id] ? (
                  <Eye className="size-4 text-muted" />
                ) : (
                  <EyeOff className="size-4 text-subtle" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Separator />
      <div className="px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-subtle">Selection</p>
        {!el ? (
          <p className="mt-3 text-sm text-muted">
            Select a device to drag, rotate, resize, or rename it.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {el.kind === "room" ? (
              <>
                <Field
                  label="Name"
                  value={el.name}
                  onChange={(v) => useStore.getState().updateSelected({ name: v })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Width m"
                    value={String(el.w)}
                    onChange={(v) => {
                      const n = Number(v);
                      if (Number.isFinite(n) && n > 0) useStore.getState().updateSelected({ w: n });
                    }}
                  />
                  <Field
                    label="Depth m"
                    value={String(el.h)}
                    onChange={(v) => {
                      const n = Number(v);
                      if (Number.isFinite(n) && n > 0) useStore.getState().updateSelected({ h: n });
                    }}
                  />
                </div>
                <p className="text-xs text-muted">{(el.w * el.h).toFixed(1)} m²</p>
              </>
            ) : null}
            {el.kind === "device" || el.kind === "cable" || el.kind === "note" || el.kind === "trunk" ? (
              <Field
                label={el.kind === "note" ? "Text" : "Label"}
                value={el.kind === "note" ? el.text : el.label}
                onChange={(v) =>
                  useStore.getState().updateSelected(el.kind === "note" ? { text: v } : { label: v })
                }
              />
            ) : null}
            {el.kind === "device" ? (
              <>
                <Field
                  label="Circuit"
                  value={el.circuit ?? ""}
                  onChange={(v) => useStore.getState().updateSelected({ circuit: v })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Brand"
                    value={el.brand ?? ""}
                    onChange={(v) => useStore.getState().updateSelected({ brand: v })}
                  />
                  <Field
                    label="Model"
                    value={el.model ?? ""}
                    onChange={(v) => useStore.getState().updateSelected({ model: v })}
                  />
                </div>
                <p className="text-xs text-muted">
                  {DEVICE_META[el.device].label}
                  {el.mount ? ` · ${el.mount}` : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StepField
                    label="Size %"
                    value={Math.round((el.scale ?? 1) * 100)}
                    step={10}
                    min={40}
                    max={500}
                    onChange={(n) => useStore.getState().updateSelected({ scale: n / 100 })}
                  />
                  <StepField
                    label="Rotation °"
                    value={Math.round(el.rotation)}
                    step={15}
                    wrap={360}
                    onChange={(n) => useStore.getState().updateSelected({ rotation: n })}
                    decIcon={<RotateCcw className="size-3.5" />}
                    incIcon={<RotateCw className="size-3.5" />}
                  />
                </div>
                <p className="text-xs text-subtle">Corners resize · circle rotates · R / Shift+R</p>
              </>
            ) : null}
            {el.kind === "cable" ? (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {(Object.keys(CABLE_META) as CableKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => useStore.getState().updateSelected({ cable: k })}
                      className={cn(
                        "h-8 rounded-sm text-xs uppercase tracking-wide",
                        el.cable === k ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {CABLE_META[k].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  Route {formatLength(polylineLength(el.points), drawing.meta.unit)} · pull{" "}
                  {formatLength(pullLength(polylineLength(el.points)), drawing.meta.unit)}
                </p>
                <p className="text-xs text-subtle">{CABLE_META[el.cable].spec}</p>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => useStore.getState().deleteSelected()}
              className="mt-1 h-9 rounded-sm text-sm text-danger hover:bg-surface-2"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="mt-auto border-t border-border px-4 py-3 font-mono text-xs text-subtle">
        {selectedId ?? "—"} · {drawing.meta.date}
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <Label className="text-xs uppercase tracking-wider text-subtle">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </label>
  );
}

function StepField({
  label,
  value,
  step,
  min,
  max,
  wrap,
  onChange,
  decIcon,
  incIcon,
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  wrap?: number;
  onChange: (n: number) => void;
  decIcon?: ReactNode;
  incIcon?: ReactNode;
}) {
  const apply = (n: number) => {
    let next = n;
    if (wrap && wrap > 0) next = ((next % wrap) + wrap) % wrap;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(next);
  };
  return (
    <label className="grid gap-1">
      <Label className="text-xs uppercase tracking-wider text-subtle">{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Decrease ${label}`}
          onClick={() => apply(value - step)}
        >
          {decIcon ?? <Minus className="size-3.5" />}
        </Button>
        <Input
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) apply(n);
          }}
          className="h-9 min-w-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Increase ${label}`}
          onClick={() => apply(value + step)}
        >
          {incIcon ?? <Plus className="size-3.5" />}
        </Button>
      </div>
    </label>
  );
}

const CABLE_ORDER: CableKind[] = ["power", "cat6", "hdmi", "sdi", "xlr", "usb"];

export function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-12 right-3 z-10 hidden rounded-md bg-bg/85 px-3 py-2 shadow-border backdrop-blur-sm md:block">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">Cables</p>
      <ul className="mt-1.5 grid gap-1.5">
        {CABLE_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs text-muted">
            <svg width="28" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="27"
                y2="4"
                stroke={CABLE_COLOR[k]}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray={CABLE_DASH[k].join(" ")}
              />
            </svg>
            {CABLE_META[k].label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-xs text-muted">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="27" y2="4" stroke={TRUNK_STROKE} strokeWidth="4.5" strokeLinecap="butt" />
            <line x1="1" y1="4" x2="27" y2="4" stroke="#cfc6b8" strokeWidth="1.6" strokeLinecap="butt" />
          </svg>
          Trunk
        </li>
      </ul>
    </div>
  );
}
