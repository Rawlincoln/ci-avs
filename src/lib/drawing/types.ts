export type Point = { x: number; y: number };

export type Tool =
  | "select"
  | "pan"
  | "wall"
  | "room"
  | "cable"
  | "device"
  | "note"
  | "measure";

export type CableKind = "power" | "cat6" | "hdmi" | "sdi" | "xlr" | "usb";

export type DeviceKind =
  | "outlet"
  | "switch"
  | "panel"
  | "rack"
  | "camera"
  | "jbox"
  | "pdu"
  | "door"
  | "display"
  | "speaker"
  | "mixer"
  | "stagebox"
  | "neatbar"
  | "neatpad"
  | "mic"
  | "drums"
  | "keys"
  | "zoompc"
  | "monitor"
  | "splitter"
  | "netswitch"
  | "ptzctrl"
  | "zoomctrl"
  | "zoomsched"
  | "shure"
  | "datajack"
  | "amp"
  | "dsp"
  | "dibox";

export type MountKind = "floor" | "wall" | "ceiling";

export type LayerId = "architecture" | "power" | "data" | "av" | "notes";

export type ViewMode = "plan" | "iso";

export type RoomScope = "contract" | "nic";

export type Wall = {
  id: string;
  kind: "wall";
  a: Point;
  b: Point;
};

export type Room = {
  id: string;
  kind: "room";
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  scope?: RoomScope;
};

export type Device = {
  id: string;
  kind: "device";
  device: DeviceKind;
  pos: Point;
  rotation: number;
  label: string;
  circuit?: string;
  scale?: number;
  mount?: MountKind;
  catalogId?: string;
  brand?: string;
  model?: string;
};

export type Cable = {
  id: string;
  kind: "cable";
  cable: CableKind;
  points: Point[];
  label: string;
  fromId?: string;
  toId?: string;
};

export type Trunk = {
  id: string;
  kind: "trunk";
  points: Point[];
  label: string;
  mount?: "wall" | "ceiling";
};

export type Note = {
  id: string;
  kind: "note";
  pos: Point;
  text: string;
};

export type Element = Wall | Room | Device | Cable | Trunk | Note;

export type DrawingMeta = {
  project: string;
  drawingNo: string;
  title: string;
  author: string;
  date: string;
  scaleLabel: string;
  unit: "ft" | "m";
};

export type Underlay = {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
};

export type CatalogCategory =
  | "mixer"
  | "stagebox"
  | "amplifier"
  | "speaker"
  | "microphone"
  | "wireless"
  | "camera"
  | "display"
  | "conference"
  | "network"
  | "dsp"
  | "control"
  | "rack"
  | "power"
  | "cable"
  | "stage"
  | "accessory"
  | "other";

export type CatalogItem = {
  id: string;
  brand: string;
  model: string;
  category: CatalogCategory;
  kind?: DeviceKind;
  cable?: CableKind;
  short: string;
  spec?: string;
  custom?: boolean;
};

export type Drawing = {
  id: string;
  name: string;
  meta: DrawingMeta;
  elements: Element[];
  layers: Record<LayerId, boolean>;
  underlay?: Underlay;
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
  /** Plan 2D rotation in radians (clockwise). */
  rotation: number;
  /** 3D orbit around vertical, radians. 0 ≈ southeast view. */
  yaw: number;
  /** Offset from ~35° elevation. Positive looks more top-down. */
  pitch: number;
};

export const DEFAULT_VIEWPORT: Viewport = {
  x: -2,
  y: -8,
  zoom: 0.85,
  rotation: 0,
  yaw: 0,
  pitch: 0,
};

export function normalizeViewport(
  v: Partial<Viewport> & Pick<Viewport, "x" | "y" | "zoom">,
): Viewport {
  return {
    x: v.x,
    y: v.y,
    zoom: v.zoom,
    rotation: v.rotation ?? 0,
    yaw: v.yaw ?? 0,
    pitch: v.pitch ?? 0,
  };
}

export const CABLE_META: Record<
  CableKind,
  { label: string; spec: string; layer: LayerId }
> = {
  power: { label: "Power", spec: "2.5 mm²", layer: "power" },
  cat6: { label: "Cat6", spec: "UTP / PoE+", layer: "data" },
  hdmi: { label: "HDMI", spec: "HDMI 2.0", layer: "av" },
  sdi: { label: "SDI", spec: "3G-SDI / BNC", layer: "av" },
  xlr: { label: "XLR", spec: "XLR-3", layer: "av" },
  usb: { label: "USB", spec: "USB-C", layer: "av" },
};

export const DEVICE_META: Record<
  DeviceKind,
  { label: string; layer: LayerId; short: string }
> = {
  outlet: { label: "Power outlet", layer: "power", short: "R" },
  switch: { label: "Light switch", layer: "power", short: "S" },
  panel: { label: "Electrical panel", layer: "power", short: "PNL" },
  rack: { label: "AV rack", layer: "data", short: "RACK" },
  camera: { label: "PTZ camera", layer: "data", short: "PTZ" },
  jbox: { label: "Junction box", layer: "power", short: "JB" },
  pdu: { label: "Rack PDU", layer: "power", short: "PDU" },
  door: { label: "Door", layer: "architecture", short: "" },
  display: { label: "Display", layer: "av", short: "TV" },
  speaker: { label: "Speaker", layer: "av", short: "SPK" },
  mixer: { label: "Mixer", layer: "av", short: "MIX" },
  stagebox: { label: "Stage box", layer: "av", short: "SB" },
  neatbar: { label: "Video bar", layer: "av", short: "NB" },
  neatpad: { label: "Neat Pad", layer: "av", short: "PAD" },
  mic: { label: "Microphone", layer: "av", short: "MIC" },
  drums: { label: "Drum kit", layer: "av", short: "DR" },
  keys: { label: "Keys / DI", layer: "av", short: "KEY" },
  zoompc: { label: "Zoom Room PC", layer: "data", short: "PC" },
  monitor: { label: "Computer monitor", layer: "av", short: "MON" },
  splitter: { label: "Splitter", layer: "av", short: "SPL" },
  dibox: { label: "DI box", layer: "av", short: "DI" },
  netswitch: { label: "Networking switch", layer: "data", short: "SW" },
  ptzctrl: { label: "PTZ controller", layer: "data", short: "PTZC" },
  zoomctrl: { label: "Zoom controller", layer: "data", short: "ZCTL" },
  zoomsched: { label: "Zoom scheduler", layer: "data", short: "ZSCH" },
  shure: { label: "Wireless receiver", layer: "av", short: "SHU" },
  datajack: { label: "Wall data", layer: "data", short: "RJ" },
  amp: { label: "Amplifier", layer: "av", short: "AMP" },
  dsp: { label: "DSP / processor", layer: "av", short: "DSP" },
};

export const LAYER_META: Record<LayerId, { label: string }> = {
  architecture: { label: "Architecture" },
  power: { label: "Power" },
  data: { label: "Cat6 / data" },
  av: { label: "AV signal" },
  notes: { label: "Notes" },
};

export const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  architecture: true,
  power: true,
  data: true,
  av: true,
  notes: true,
};

export const PX_PER_UNIT = 22;
export const GRID = 1;
export const SNAP = 0.5;
