import { ArrowLeft, Plus, Search } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_DEFAULTS,
  CATEGORY_META,
  CATEGORY_ORDER,
  STOCK_CATALOG,
  STOCK_STATS,
  catalogBrands,
  searchCatalog,
} from "@/lib/drawing/catalog";
import { CABLE_META } from "@/lib/drawing/types";
import { paintDeviceGlyph } from "@/lib/drawing/render";
import { useStore } from "@/lib/drawing/store";
import type { CableKind, CatalogCategory, CatalogItem, DeviceKind } from "@/lib/drawing/types";
import { DEVICE_META } from "@/lib/drawing/types";
import { cn } from "@/lib/utils";
import { PAPER } from "@/lib/drawing/palette";

const GLYPH_KINDS: DeviceKind[] = [
  "mixer",
  "stagebox",
  "amp",
  "speaker",
  "mic",
  "shure",
  "camera",
  "display",
  "neatbar",
  "neatpad",
  "netswitch",
  "dsp",
  "ptzctrl",
  "rack",
  "pdu",
  "outlet",
  "zoompc",
  "splitter",
  "dibox",
  "jbox",
  "keys",
  "drums",
];

const CABLE_KINDS = Object.keys(CABLE_META) as CableKind[];

export function Library() {
  const open = useStore((s) => s.showLibrary);
  const custom = useStore((s) => s.customCatalog);
  const catalogId = useStore((s) => s.catalogId);
  const recentIds = useStore((s) => s.recentCatalogIds);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory | "all">("all");
  const [brand, setBrand] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const catalog = useMemo(() => [...STOCK_CATALOG, ...custom], [custom]);
  const brands = useMemo(() => catalogBrands(catalog), [catalog]);
  const results = useMemo(() => searchCatalog(catalog, query, category, brand), [catalog, query, category, brand]);
  const recent = useMemo(
    () => recentIds.map((id) => catalog.find((it) => it.id === id)).filter((it): it is CatalogItem => Boolean(it)),
    [recentIds, catalog],
  );
  const groups = useMemo(() => {
    const m = new Map<string, CatalogItem[]>();
    for (const it of results) {
      const list = m.get(it.brand) ?? [];
      list.push(it);
      m.set(it.brand, list);
    }
    return [...m.entries()];
  }, [results]);

  if (!open) return null;

  const pick = (it: CatalogItem) => useStore.getState().pickCatalogItem(it);

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-30 flex justify-end bg-bg/70">
      <button
        type="button"
        className="absolute inset-0 md:static md:flex-1"
        aria-label="Close add equipment"
        onClick={() => useStore.getState().goBack()}
      />
      <aside className="relative z-10 flex h-full w-full flex-col border-l border-border bg-surface sm:w-[28rem]">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">Add equipment</p>
            <p className="text-sm text-fg">
              {STOCK_STATS.models} models · {STOCK_STATS.brands} brands
              {custom.length ? ` · ${custom.length} yours` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close add equipment" onClick={() => useStore.getState().goBack()}>
            <ArrowLeft className="size-4" />
          </Button>
        </div>
        <div className="px-4 pb-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Yamaha QL5, SM58, Cat6…"
              className="pl-8"
              autoFocus
            />
          </label>
          <div className="mt-2 flex flex-nowrap gap-1 overflow-x-auto pb-1">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </Chip>
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
          <label className="mt-2 block">
            <span className="sr-only">Brand</span>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-9 w-full rounded-sm border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="all">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-subtle">
            {results.length} match{results.length === 1 ? "" : "es"} · pick to place on the drawing
          </p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {!query && brand === "all" && category === "all" && recent.length > 0 ? (
            <li className="px-2 pb-2">
              <p className="px-1 pb-1 text-xs font-medium uppercase tracking-wider text-subtle">Recent</p>
              {recent.map((it) => (
                <ResultRow key={`r-${it.id}`} item={it} active={catalogId === it.id} onPick={pick} />
              ))}
            </li>
          ) : null}
          {results.length === 0 ? (
            <li className="px-3 py-6 text-sm text-muted">No match. Add the model below.</li>
          ) : (
            groups.map(([b, items]) => (
              <li key={b} className="pb-2">
                <p className="sticky top-0 z-10 bg-surface px-2 py-1 text-xs font-medium uppercase tracking-wider text-subtle">
                  {b}
                </p>
                {items.map((it) => (
                  <ResultRow key={it.id} item={it} active={catalogId === it.id} onPick={pick} />
                ))}
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border p-3">
          {adding ? (
            <AddForm
              onCancel={() => setAdding(false)}
              onSave={(item) => {
                const created = useStore.getState().addCustomEquipment(item);
                useStore.getState().pickCatalogItem(created);
                setAdding(false);
              }}
            />
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add missing model
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

function ResultRow({
  item,
  active,
  onPick,
}: {
  item: CatalogItem;
  active: boolean;
  onPick: (item: CatalogItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <MiniGlyph kind={item.kind ?? "jbox"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-fg">
          {item.brand} {item.model}
        </span>
        <span className="block truncate text-xs text-subtle">
          {CATEGORY_META[item.category].label}
          {item.spec ? ` · ${item.spec}` : ""}
          {item.custom ? " · yours" : ""}
        </span>
      </span>
      {item.custom ? (
        <span
          role="button"
          tabIndex={0}
          className="px-1 text-xs text-subtle hover:text-danger"
          onClick={(e) => {
            e.stopPropagation();
            useStore.getState().removeCustomEquipment(item.id);
          }}
        >
          Remove
        </span>
      ) : null}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full px-3 text-xs",
        active ? "bg-primary text-primary-fg" : "bg-bg text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function MiniGlyph({ kind }: { kind: DeviceKind }) {
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
    paintDeviceGlyph(ctx, kind, undefined, css);
  }, [kind]);
  return <canvas ref={ref} width={28} height={28} className="size-7 shrink-0 rounded-sm bg-paper" aria-hidden />;
}

function AddForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (item: Omit<CatalogItem, "id" | "custom">) => void;
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("mixer");
  const [kind, setKind] = useState<DeviceKind>("mixer");
  const [cable, setCable] = useState<CableKind>("xlr");
  const [spec, setSpec] = useState("");
  const isCable = category === "cable";
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!brand.trim() || !model.trim()) return;
        const defaults = CATEGORY_DEFAULTS[category];
        onSave({
          brand: brand.trim(),
          model: model.trim(),
          category,
          kind: isCable ? undefined : kind || defaults.kind,
          cable: isCable ? cable : undefined,
          short: model.trim().slice(0, 6).toUpperCase(),
          spec: spec.trim() || undefined,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Brand" value={brand} onChange={setBrand} />
        <Field label="Model" value={model} onChange={setModel} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <Label className="text-xs text-subtle">Category</Label>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as CatalogCategory;
              setCategory(next);
              const def = CATEGORY_DEFAULTS[next];
              if (def.kind) setKind(def.kind);
              if (def.cable) setCable(def.cable);
            }}
            className="h-9 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </label>
        {isCable ? (
          <label className="grid gap-1">
            <Label className="text-xs text-subtle">Cable type</Label>
            <select
              value={cable}
              onChange={(e) => setCable(e.target.value as CableKind)}
              className="h-9 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
            >
              {CABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CABLE_META[k].label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="grid gap-1">
            <Label className="text-xs text-subtle">Symbol</Label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as DeviceKind)}
              className="h-9 rounded-sm border border-border bg-bg px-2 text-sm text-fg"
            >
              {GLYPH_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DEVICE_META[k].label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <Field label="Spec (optional)" value={spec} onChange={setSpec} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save to library
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <Label className="text-xs text-subtle">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={label !== "Spec (optional)"} />
    </label>
  );
}
