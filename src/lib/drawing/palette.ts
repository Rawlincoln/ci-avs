import type { CableKind, DeviceKind } from "./types";

export const PAPER = "#f3eee4";
export const INK = "#1a1916";
export const INK_MUTED = "#6b655c";
export const GRID_MINOR = "rgba(26, 25, 22, 0.04)";
export const GRID_MAJOR = "rgba(26, 25, 22, 0.08)";
export const GRID_AXIS = "rgba(26, 25, 22, 0.14)";
export const WALL_FILL = "#2c2924";
export const ROOM_FILL = "rgba(196, 184, 165, 0.18)";
export const ROOM_CONTRACT = "rgba(196, 184, 165, 0.2)";
export const ROOM_NIC = "rgba(196, 184, 165, 0.04)";
export const NIC_HATCH = "rgba(26, 25, 22, 0.06)";
export const CONTRACT_EDGE = "#8a6a3b";
export const SELECT = "#8a6a3b";
export const HOVER = "rgba(138, 106, 59, 0.35)";
export const PREVIEW = "rgba(138, 106, 59, 0.85)";
export const BRASS = "#c4b8a5";

/** Six hues that stay apart on cream: amber / blue / crimson / violet / green / teal. */
export const CABLE_COLOR: Record<CableKind, string> = {
  power: "#D97706",
  cat6: "#1D4ED8",
  hdmi: "#BE123C",
  sdi: "#6D28D9",
  xlr: "#15803D",
  usb: "#0F766E",
};

export const CABLE_DASH: Record<CableKind, number[]> = {
  power: [],
  cat6: [11, 4],
  hdmi: [4, 2.6],
  sdi: [6, 2.2],
  xlr: [1.8, 2.6],
  usb: [9, 3, 2, 3],
};

export const CABLE_WIDTH: Record<CableKind, number> = {
  power: 2.7,
  cat6: 2.15,
  hdmi: 2.15,
  sdi: 2.2,
  xlr: 1.9,
  usb: 1.9,
};

export const DEVICE_SIZE: Record<DeviceKind, number> = {
  outlet: 0.32,
  switch: 0.45,
  panel: 1.25,
  rack: 1.35,
  camera: 0.65,
  jbox: 0.45,
  pdu: 1.05,
  door: 1.8,
  display: 1.7,
  speaker: 0.85,
  mixer: 1.35,
  stagebox: 0.95,
  neatbar: 1.25,
  neatpad: 0.5,
  mic: 0.4,
  drums: 1.25,
  keys: 1.15,
  zoompc: 0.95,
  monitor: 1.0,
  splitter: 0.75,
  dibox: 0.55,
  netswitch: 1.0,
  ptzctrl: 0.9,
  zoomctrl: 0.6,
  zoomsched: 0.6,
  shure: 0.85,
  datajack: 0.28,
  amp: 1.05,
  dsp: 0.85,
};

export const TRUNK_FILL = "rgba(138, 131, 118, 0.38)";
export const TRUNK_STROKE = "#6b655c";
