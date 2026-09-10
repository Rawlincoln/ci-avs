import type { Device, DeviceKind, Drawing, MountKind } from "./types";
import { DEVICE_META } from "./types";

export type KeyRow = {
  id: string;
  tag: string;
  name: string;
  device: DeviceKind;
  mount?: string;
  mountKind?: MountKind;
};

const KIND_ORDER: DeviceKind[] = [
  "mixer",
  "stagebox",
  "zoompc",
  "monitor",
  "netswitch",
  "ptzctrl",
  "splitter",
  "dibox",
  "zoomctrl",
  "zoomsched",
  "neatpad",
  "neatbar",
  "shure",
  "pdu",
  "amp",
  "dsp",
  "mic",
  "drums",
  "keys",
  "outlet",
  "datajack",
  "switch",
  "jbox",
];

/** Tagged kit north-to-south, then unlabelled pieces grouped by type. */
export function sheetKey(drawing: Drawing): KeyRow[] {
  const devices = drawing.elements.filter((e): e is Device => e.kind === "device" && e.device !== "door");
  const labeled = devices
    .filter((d) => d.label)
    .slice()
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
  const unlabeled = devices.filter((d) => !d.label);
  const rows: KeyRow[] = labeled.map((d) => ({
    id: d.id,
    tag: d.label,
    name: d.brand && d.model ? `${d.brand} ${d.model}` : DEVICE_META[d.device].label,
    device: d.device,
    mount: d.mount === "ceiling" ? "clg" : d.mount === "wall" ? "wall" : undefined,
    mountKind: d.mount,
  }));
  const groups = new Map<DeviceKind, Device[]>();
  for (const d of unlabeled) {
    const list = groups.get(d.device) ?? [];
    list.push(d);
    groups.set(d.device, list);
  }
  for (const kind of KIND_ORDER) {
    const list = groups.get(kind);
    if (!list?.length) continue;
    const meta = DEVICE_META[kind];
    const ceiling = list.every((d) => d.mount === "ceiling");
    const sample = list[0]!;
    const named = sample.brand && sample.model ? `${sample.brand} ${sample.model}` : meta.label;
    rows.push({
      id: sample.id,
      tag: list.length > 1 ? `×${list.length}` : meta.short || "—",
      name: named,
      device: kind,
      mount: ceiling ? "clg" : undefined,
      mountKind: ceiling ? "ceiling" : list[0]!.mount,
    });
  }
  return rows;
}
