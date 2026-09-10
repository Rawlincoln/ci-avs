import { PackagePlus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { CATEGORY_META, STOCK_CATALOG, searchCatalog } from "@/lib/drawing/catalog";
import { useStore } from "@/lib/drawing/store";
import type { CatalogItem } from "@/lib/drawing/types";
import { cn } from "@/lib/utils";

export function AddEquipment() {
  const catalogId = useStore((s) => s.catalogId);
  const custom = useStore((s) => s.customCatalog);
  const recentIds = useStore((s) => s.recentCatalogIds);
  const tick = useStore((s) => s.equipSearchTick);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(() => [...STOCK_CATALOG, ...custom], [custom]);
  const recent = useMemo(
    () => recentIds.map((id) => catalog.find((it) => it.id === id)).filter((it): it is CatalogItem => Boolean(it)),
    [recentIds, catalog],
  );
  const results = useMemo(() => {
    if (!query.trim()) return recent.slice(0, 8);
    return searchCatalog(catalog, query, "all").slice(0, 12);
  }, [catalog, query, recent]);

  useEffect(() => {
    if (tick < 1) return;
    inputRef.current?.focus();
    setOpen(true);
  }, [tick]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (item: CatalogItem) => {
    useStore.getState().pickCatalogItem(item);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const browse = () => {
    setOpen(false);
    useStore.getState().setShowLibrary(true);
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto absolute left-3 top-3 z-20 w-[min(22rem,calc(100%-6.5rem))] max-md:left-2 max-md:top-2"
    >
      <div className="overflow-hidden rounded-md bg-bg/90 shadow-border backdrop-blur-sm">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-subtle" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                inputRef.current?.blur();
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) pick(results[0]);
                else browse();
              }
            }}
            placeholder="Add equipment"
            aria-label="Add equipment"
            className="h-11 border-0 bg-transparent pl-9 pr-24 shadow-none"
          />
          <button
            type="button"
            onClick={browse}
            className="absolute right-1.5 h-8 rounded-sm px-2 text-xs text-muted hover:text-fg"
          >
            Browse
          </button>
        </label>
        {open ? (
          <ul className="max-h-72 overflow-y-auto border-t border-border">
            {results.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted">
                {query.trim() ? "No match. Browse the catalog to add the model." : "Type a model or brand, or browse the catalog."}
              </li>
            ) : (
              results.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => pick(it)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left",
                      catalogId === it.id ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">
                        {it.brand} {it.model}
                      </span>
                      <span className="block truncate text-xs text-subtle">
                        {CATEGORY_META[it.category].label}
                        {it.spec ? ` · ${it.spec}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-subtle">{it.cable && !it.kind ? "Route" : "Place"}</span>
                  </button>
                </li>
              ))
            )}
            <li>
              <button
                type="button"
                onClick={browse}
                className="flex h-11 w-full items-center gap-2 px-3 text-left text-xs text-muted hover:bg-surface-2 hover:text-fg"
              >
                <PackagePlus className="size-3.5" />
                Browse full catalog
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    </div>
  );
}
