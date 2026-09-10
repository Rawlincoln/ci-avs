import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSchedule } from "@/lib/drawing/bom";
import { formatLength } from "@/lib/drawing/geometry";
import { useDrawing, useStore } from "@/lib/drawing/store";
import type { CableKind } from "@/lib/drawing/types";
import { cn } from "@/lib/utils";

const SWATCH: Record<CableKind, string> = {
  power: "bg-power",
  cat6: "bg-cat6",
  hdmi: "bg-hdmi",
  sdi: "bg-sdi",
  xlr: "bg-xlr",
  usb: "bg-usb",
};

export function SchedulePanel() {
  const open = useStore((s) => s.showSchedule);
  const drawing = useDrawing();
  const schedule = useMemo(() => buildSchedule(drawing), [drawing]);
  if (!open) return null;

  const runs = schedule.cables.flatMap((row) =>
    row.runs.map((run) => ({ ...run, kind: row.kind, spec: row.spec })),
  );

  return (
    <div className="absolute inset-x-3 bottom-14 z-20 mx-auto max-w-3xl overflow-hidden rounded-lg bg-surface shadow-[0_0_0_1px_var(--color-border),0_24px_48px_rgba(0,0,0,0.4)] md:inset-x-auto md:right-80 md:bottom-6 md:left-24">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium text-fg">Pull schedule</p>
          <p className="text-xs text-muted">
            {runs.length} runs · route {formatLength(schedule.totalCable, drawing.meta.unit)} · pull{" "}
            {schedule.totalPull} m
            <span className="text-subtle"> · ceil(1.15× + 2 m)</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close schedule"
          onClick={() => useStore.getState().toggleSchedule()}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Spec</th>
              <th className="px-4 py-2 font-medium">Runs</th>
              <th className="px-4 py-2 font-medium">Route</th>
              <th className="px-4 py-2 font-medium">Pull</th>
            </tr>
          </thead>
          <tbody>
            {schedule.cables.map((row) => (
              <tr key={row.kind} className="border-t border-border">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", SWATCH[row.kind])} />
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{row.spec}</td>
                <td className="px-4 py-2 tabular-nums">{row.count}</td>
                <td className="px-4 py-2 font-mono tabular-nums">
                  {formatLength(row.length, drawing.meta.unit)}
                </td>
                <td className="px-4 py-2 font-mono tabular-nums">{row.pull} m</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border">
          <p className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-subtle">Tagged runs</p>
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-1.5 font-medium">Tag</th>
                <th className="px-4 py-1.5 font-medium">Type</th>
                <th className="px-4 py-1.5 font-medium">Route</th>
                <th className="px-4 py-1.5 font-medium">Cut</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={`${run.kind}-${run.label}-${i}`} className="border-t border-border">
                  <td className="px-4 py-1.5 font-mono text-xs">{run.label}</td>
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-2 text-xs text-muted">
                      <span className={cn("size-1.5 rounded-full", SWATCH[run.kind])} />
                      {run.kind.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs tabular-nums text-muted">
                    {formatLength(run.length, drawing.meta.unit)}
                  </td>
                  <td className="px-4 py-1.5 font-mono text-xs tabular-nums">{run.pull} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-subtle">Devices</p>
          <ul className="flex flex-wrap gap-2">
            {schedule.devices.map((d) => (
              <li key={d.key} className="rounded-sm bg-surface-2 px-2 py-1 text-xs text-muted">
                <span className="tabular-nums text-fg">{d.count}</span> {d.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
