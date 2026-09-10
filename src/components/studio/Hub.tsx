import { Copy, FilePlus, LayoutTemplate, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/drawing/store";
import { fileToUnderlay } from "@/lib/drawing/underlay";
import { NavButtons } from "./NavButtons";

export function Hub() {
  const drawings = useStore((s) => s.drawings);
  const currentId = useStore((s) => s.currentId);
  const custom = useStore((s) => s.customCatalog);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const startBlank = () => {
    useStore.getState().newProject({ name: name.trim() || "Untitled drawing", template: "blank" });
  };
  const startTemplate = () => {
    useStore.getState().newProject({ name: name.trim() || "L3 Hall AV", template: "l3" });
  };
  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const underlay = await fileToUnderlay(file);
      useStore.getState().newProject({
        name: name.trim() || file.name.replace(/\.[^.]+$/, ""),
        template: "blank",
        underlay,
      });
    } catch {
      setError("Could not read that drawing. Try a PNG, JPG, WebP, or PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-3">
        <NavButtons />
        <button type="button" className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => useStore.getState().goHome()}>
          <Mark />
          <div>
            <p className="text-sm font-medium tracking-tight">CI AVS</p>
            <p className="text-xs text-muted">AV install design</p>
          </div>
        </button>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Projects</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Start from a blank sheet or trace a floor plan. Add mixers, amps, mics, splitters, DI boxes, and cables on the drawing.
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={startBlank}
            className="flex min-h-28 flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2"
          >
            <FilePlus className="size-4 text-primary" />
            <span className="text-sm font-medium">Blank drawing</span>
            <span className="text-xs text-muted">Walls, rooms, then add equipment.</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-28 flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            <Upload className="size-4 text-primary" />
            <span className="text-sm font-medium">{busy ? "Reading plan…" : "Upload floor plan"}</span>
            <span className="text-xs text-muted">PDF or image as a trace underlay.</span>
          </button>
          <button
            type="button"
            onClick={startTemplate}
            className="flex min-h-28 flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-2"
          >
            <LayoutTemplate className="size-4 text-primary" />
            <span className="text-sm font-medium">Accra L3 template</span>
            <span className="text-xs text-muted">Compassion hall with the current plot.</span>
          </button>
        </section>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          style={{ caretColor: "transparent" }}
          suppressHydrationWarning
          onChange={(e) => void onUpload(e.target.files?.[0])}
        />
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-subtle">Project name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional — e.g. Chapel FOH" />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">Open</p>
          {drawings.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No drawings yet.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {drawings.map((d) => (
                <li key={d.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => useStore.getState().openProject(d.id)}
                    className="flex min-h-14 min-w-0 flex-1 items-center justify-between rounded-md border border-border bg-surface px-4 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-fg">{d.meta.title || d.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {d.meta.drawingNo} · {d.meta.date} · {d.elements.length} objects
                        {d.underlay ? " · plan" : ""}
                      </span>
                    </span>
                    {d.id === currentId ? <span className="ml-3 shrink-0 text-xs text-subtle">last</span> : null}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Duplicate ${d.meta.title || d.name}`}
                    onClick={() => useStore.getState().duplicateProject(d.id)}
                  >
                    <Copy className="size-4 text-muted" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${d.meta.title || d.name}`}
                    onClick={() => useStore.getState().deleteProject(d.id)}
                  >
                    <Trash2 className="size-4 text-muted" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-subtle">
          Catalog lives on this device
          {custom.length ? ` · ${custom.length} custom model${custom.length === 1 ? "" : "s"} saved` : ""}.
        </p>
      </main>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid size-8 place-items-center rounded-sm bg-primary text-primary-fg" aria-hidden>
      <span className="font-mono text-xs font-medium tracking-tight">AV</span>
    </span>
  );
}
