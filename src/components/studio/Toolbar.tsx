import {
  AudioLines,
  Box,
  BrickWall,
  Cable,
  Camera,
  Computer,
  Drum,
  Gamepad2,
  Hand,
  KeyboardMusic,
  Library,
  Mic,
  Monitor,
  MousePointer2,
  Network,
  Plug,
  Ruler,
  Server,
  Speaker,
  Split,
  Square,
  StickyNote,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip } from "@/components/ui/tooltip";
import { findCatalogItem, STOCK_CATALOG } from "@/lib/drawing/catalog";
import { useStore } from "@/lib/drawing/store";
import type { CableKind, DeviceKind, Tool } from "@/lib/drawing/types";
import { cn } from "@/lib/utils";

const TOOLS: { id: Tool; label: string; key: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2 },
  { id: "pan", label: "Pan", key: "H", icon: Hand },
  { id: "wall", label: "Wall", key: "W", icon: BrickWall },
  { id: "room", label: "Room", key: "R", icon: Square },
  { id: "cable", label: "Cable", key: "C", icon: Cable },
  { id: "device", label: "Device", key: "D", icon: Plug },
  { id: "note", label: "Note", key: "N", icon: StickyNote },
  { id: "measure", label: "Measure", key: "M", icon: Ruler },
];

const CABLES: { id: CableKind; label: string; swatch: string; fill: string; dash?: string }[] = [
  { id: "cat6", label: "Cat6", swatch: "stroke-cat6", fill: "bg-cat6", dash: "11 4" },
  { id: "hdmi", label: "HDMI", swatch: "stroke-hdmi", fill: "bg-hdmi", dash: "4 2.6" },
  { id: "sdi", label: "SDI", swatch: "stroke-sdi", fill: "bg-sdi", dash: "6 2.2" },
  { id: "power", label: "Power", swatch: "stroke-power", fill: "bg-power" },
  { id: "xlr", label: "XLR", swatch: "stroke-xlr", fill: "bg-xlr", dash: "1.8 2.6" },
  { id: "usb", label: "USB", swatch: "stroke-usb", fill: "bg-usb", dash: "9 3 2 3" },
];

const DEVICES: { id: DeviceKind; label: string; icon: typeof Plug }[] = [
  { id: "camera", label: "PTZ", icon: Camera },
  { id: "speaker", label: "Speaker", icon: Speaker },
  { id: "display", label: "TV", icon: Monitor },
  { id: "mixer", label: "Mixer", icon: AudioLines },
  { id: "stagebox", label: "Stagebox", icon: Box },
  { id: "amp", label: "Amp", icon: AudioLines },
  { id: "dsp", label: "DSP", icon: Split },
  { id: "neatbar", label: "Video bar", icon: Tablet },
  { id: "neatpad", label: "Touch pad", icon: Tablet },
  { id: "netswitch", label: "Switch", icon: Network },
  { id: "splitter", label: "Splitter", icon: Split },
  { id: "dibox", label: "DI box", icon: Box },
  { id: "zoompc", label: "Zoom PC", icon: Computer },
  { id: "ptzctrl", label: "PTZ ctrl", icon: Gamepad2 },
  { id: "mic", label: "Mic", icon: Mic },
  { id: "drums", label: "Drums", icon: Drum },
  { id: "keys", label: "Keys", icon: KeyboardMusic },
  { id: "rack", label: "Rack", icon: Server },
  { id: "outlet", label: "Outlet", icon: Plug },
];

export function Toolbar() {
  const tool = useStore((s) => s.tool);
  const cableKind = useStore((s) => s.cableKind);
  const deviceKind = useStore((s) => s.deviceKind);
  const catalogId = useStore((s) => s.catalogId);
  const custom = useStore((s) => s.customCatalog);
  const setTool = useStore((s) => s.setTool);
  const setCableKind = useStore((s) => s.setCableKind);
  const setDeviceKind = useStore((s) => s.setDeviceKind);
  const picked = findCatalogItem([...STOCK_CATALOG, ...custom], catalogId ?? undefined);

  return (
    <aside className="flex shrink-0 flex-col gap-2 border-r border-border bg-surface p-2 max-md:order-3 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-t max-md:p-1.5">
      <div className="flex flex-col gap-1 max-md:flex-row">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Tooltip key={t.id} content={`${t.label} · ${t.key}`} side="right">
              <Button
                variant={tool === t.id ? "default" : "ghost"}
                size="icon-sm"
                aria-label={t.label}
                aria-pressed={tool === t.id}
                onClick={() => setTool(t.id)}
                className="max-md:size-10"
              >
                <Icon className="size-4" />
              </Button>
            </Tooltip>
          );
        })}
      </div>
      <Separator className="max-md:hidden" />
      <div className="hidden flex-col gap-1 md:flex">
        <p className="px-1 pt-1 text-xs font-medium uppercase tracking-wider text-subtle">Cable</p>
        {CABLES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCableKind(c.id)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-sm px-2 text-left text-xs transition-colors duration-150",
              cableKind === c.id && tool === "cable" && !picked
                ? "bg-surface-2 text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <svg width="22" height="10" aria-hidden className="shrink-0">
              <line
                x1="1"
                y1="5"
                x2="21"
                y2="5"
                className={c.swatch}
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeDasharray={c.dash}
              />
            </svg>
            {c.label}
          </button>
        ))}
      </div>
      <Separator className="max-md:hidden" />
      <div className="hidden min-h-0 flex-col gap-1 overflow-y-auto md:flex">
        <p className="px-1 pt-1 text-xs font-medium uppercase tracking-wider text-subtle">Gear</p>
        <button
          type="button"
          onClick={() => useStore.getState().focusEquipSearch()}
          className={cn(
            "flex min-h-9 items-center gap-2 rounded-sm px-2 text-left text-xs",
            picked ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          <Library className="size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate">{picked ? picked.model : "Add equipment"}</span>
            {picked ? <span className="block truncate text-subtle">{picked.brand}</span> : null}
          </span>
        </button>
        {DEVICES.map((d) => {
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setDeviceKind(d.id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-sm px-2 text-left text-xs transition-colors duration-150",
                deviceKind === d.id && tool === "device" && !picked
                  ? "bg-surface-2 text-fg"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
              {d.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export { CABLES, DEVICES };
