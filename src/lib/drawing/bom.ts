import { polylineLength, pullLength } from "./geometry";
import { CABLE_META, DEVICE_META, type CableKind, type DeviceKind, type Drawing } from "./types";

export type CableRun = {
  label: string;
  length: number;
  pull: number;
};

export type CableRow = {
  kind: CableKind;
  label: string;
  spec: string;
  count: number;
  length: number;
  pull: number;
  runs: CableRun[];
};

export type DeviceRow = {
  kind: DeviceKind;
  label: string;
  count: number;
  key: string;
};

export type Schedule = {
  cables: CableRow[];
  devices: DeviceRow[];
  totalCable: number;
  totalPull: number;
};

export function buildSchedule(drawing: Drawing): Schedule {
  const cableMap = new Map<CableKind, CableRow>();
  const deviceMap = new Map<string, DeviceRow>();
  let totalCable = 0;
  let totalPull = 0;

  for (const el of drawing.elements) {
    if (el.kind === "cable") {
      const len = polylineLength(el.points);
      const pull = pullLength(len);
      totalCable += len;
      totalPull += pull;
      let row = cableMap.get(el.cable);
      if (!row) {
        const meta = CABLE_META[el.cable];
        row = { kind: el.cable, label: meta.label, spec: meta.spec, count: 0, length: 0, pull: 0, runs: [] };
        cableMap.set(el.cable, row);
      }
      row.count += 1;
      row.length += len;
      row.pull += pull;
      row.runs.push({ label: el.label || el.cable.toUpperCase(), length: len, pull });
    } else if (el.kind === "device") {
      if (el.device === "door") continue;
      const label = el.brand && el.model ? `${el.brand} ${el.model}` : DEVICE_META[el.device].label;
      const key = el.catalogId || `${el.device}|${el.brand ?? ""}|${el.model ?? ""}`;
      let row = deviceMap.get(key);
      if (!row) {
        row = { kind: el.device, label, count: 0, key };
        deviceMap.set(key, row);
      }
      row.count += 1;
    }
  }

  for (const row of cableMap.values()) {
    row.runs.sort((a, b) => a.label.localeCompare(b.label));
  }

  return {
    cables: [...cableMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    devices: [...deviceMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
    totalCable,
    totalPull,
  };
}
