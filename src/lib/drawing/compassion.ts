import { uid } from "./geometry";
import { STOCK_CATALOG } from "./catalog";
import {
  DEFAULT_LAYERS,
  type Cable,
  type CableKind,
  type Device,
  type DeviceKind,
  type Drawing,
  type Element,
  type MountKind,
  type Point,
  type Room,
  type RoomScope,
  type Trunk,
  type Wall,
} from "./types";

function wall(a: Point, b: Point): Wall {
  return { id: uid("w"), kind: "wall", a, b };
}

function room(
  x: number,
  y: number,
  w: number,
  h: number,
  name: string,
  scope: RoomScope = "nic",
): Room {
  return { id: uid("rm"), kind: "room", x, y, w, h, name, scope };
}

function cable(kind: CableKind, points: Point[], label: string, fromId?: string, toId?: string): Cable {
  return { id: uid("cb"), kind: "cable", cable: kind, points, label, fromId, toId };
}

function trunk(points: Point[], label: string, mount: "wall" | "ceiling" = "wall"): Trunk {
  return { id: uid("tr"), kind: "trunk", points, label, mount };
}

function device(
  kind: DeviceKind,
  pos: Point,
  label = "",
  rotation = 0,
  circuit?: string,
  mount?: MountKind,
  catalogId?: string,
): Device {
  const cat = catalogId ? STOCK_CATALOG.find((it) => it.id === catalogId) : undefined;
  return {
    id: uid("dv"),
    kind: "device",
    device: kind,
    pos,
    rotation,
    label,
    circuit,
    ...(mount ? { mount } : {}),
    ...(cat ? { catalogId: cat.id, brand: cat.brand, model: cat.model } : {}),
  };
}

/**
 * Compassion International Ghana — Accra National Office
 * Main building, THIRD FLOOR (drawing page 4).
 * Units: metres. Origin = NW corner of female washroom block.
 * +x east, +y south (matches the architectural sheet).
 *
 * Contract: Multi-Purpose Meeting Space only.
 * Adjacent rooms are drawn for reference (NIC) — no cable routing outside the hall.
 *
 * Kit + wiring from the AV diagram (Wing Compact / SD16 / Zoom / PTZ / Neat / PA)
 * with placement from the site notes:
 *  - 85" on the north wall, 85" on the south wall; Neat Bar under each
 *  - 2× 55" ceiling-mounted on the hall centreline: one at the current mid-hall
 *    row, one at three-quarters of the hall depth
 *  - 4× QSC K.8 ceiling: 2 near front, 2 at center
 *  - Control desk in the SW corner, spaced for cable landing
 *  - 2× Formako PTZ ceiling-mounted
 *  - SD16 on the west wall at the drums; Cat6 in wall/ceiling trunk to FOH wall plates
 */
export function compassionThirdFloor(): Drawing {
  const elements: Element[] = [];

  const HALL = { x: 0, y: 4.6, w: 9.0, h: 16.5 };
  const FEMALE = { x: 0, y: 0, w: 9.0, h: 4.6 };
  const CORR = { x: 9.0, y: 4.6, w: 2.2, h: 8.8 };
  const STAIR = { x: 8.6, y: -5.5, w: 7.0, h: 5.5 };
  const MALE = { x: 11.2, y: 0.3, w: 4.4, h: 3.9 };
  const KITCH = { x: 11.2, y: 4.2, w: 4.4, h: 1.9 };
  const STOR = { x: 11.2, y: 6.1, w: 4.4, h: 4.1 };
  const BOARD = { x: 11.2, y: 13.2, w: 4.4, h: 7.9 };
  const EAST = { x: 15.6, y: 10.2, w: 2.6, h: 4.6 };

  const hs = HALL.y + HALL.h;

  elements.push(
    room(FEMALE.x, FEMALE.y, FEMALE.w, FEMALE.h, "W.C. F"),
    room(HALL.x, HALL.y, HALL.w, HALL.h, "Hall", "contract"),
    room(CORR.x, CORR.y, CORR.w, CORR.h, "Corr."),
    room(STAIR.x, STAIR.y, STAIR.w, STAIR.h, "Stair"),
    room(MALE.x, MALE.y, MALE.w, MALE.h, "W.C. M"),
    room(KITCH.x, KITCH.y, KITCH.w, KITCH.h, "Kitchen"),
    room(STOR.x, STOR.y, STOR.w, STOR.h, "Store"),
    room(BOARD.x, BOARD.y, BOARD.w, BOARD.h, "Board"),
    room(4.0, hs, 5.2, 3.6, "Collab"),
  );

  const W = HALL.w + CORR.w + KITCH.w;
  elements.push(
    wall({ x: 0, y: 0 }, { x: HALL.w, y: 0 }),
    wall({ x: 0, y: 0 }, { x: 0, y: hs }),
    wall({ x: 0, y: hs }, { x: HALL.w, y: hs }),
    wall({ x: HALL.w, y: 0 }, { x: HALL.w, y: FEMALE.h }),
    wall({ x: HALL.w, y: FEMALE.h }, { x: HALL.w, y: hs }),
    wall({ x: HALL.w, y: FEMALE.h }, { x: W, y: FEMALE.h }),
    wall({ x: W, y: 0.3 }, { x: W, y: hs }),
    wall({ x: HALL.w + CORR.w, y: 0.3 }, { x: W, y: 0.3 }),
    wall({ x: HALL.w + CORR.w, y: 0.3 }, { x: HALL.w + CORR.w, y: FEMALE.h }),
    wall({ x: HALL.w, y: KITCH.y }, { x: W, y: KITCH.y }),
    wall({ x: HALL.w, y: STOR.y }, { x: W, y: STOR.y }),
    wall({ x: HALL.w, y: STOR.y + STOR.h }, { x: W, y: STOR.y + STOR.h }),
    wall({ x: HALL.w, y: BOARD.y }, { x: W, y: BOARD.y }),
    wall({ x: HALL.w, y: hs }, { x: W, y: hs }),
    wall({ x: HALL.w + CORR.w, y: FEMALE.h }, { x: HALL.w + CORR.w, y: BOARD.y }),
    wall({ x: STAIR.x, y: STAIR.y }, { x: STAIR.x + STAIR.w, y: STAIR.y }),
    wall({ x: STAIR.x, y: STAIR.y }, { x: STAIR.x, y: 0 }),
    wall({ x: STAIR.x + STAIR.w, y: STAIR.y }, { x: STAIR.x + STAIR.w, y: 0.3 }),
    wall({ x: STAIR.x, y: 0 }, { x: HALL.w, y: 0 }),
    wall({ x: EAST.x, y: EAST.y }, { x: EAST.x + EAST.w, y: EAST.y }),
    wall({ x: EAST.x + EAST.w, y: EAST.y }, { x: EAST.x + EAST.w, y: EAST.y + EAST.h }),
    wall({ x: EAST.x, y: EAST.y + EAST.h }, { x: EAST.x + EAST.w, y: EAST.y + EAST.h }),
    wall({ x: 0, y: 2.1 }, { x: 6.4, y: 2.1 }),
    wall({ x: 6.4, y: 0 }, { x: 6.4, y: 4.6 }),
    wall({ x: 4.0, y: hs }, { x: 4.0, y: hs + 1.4 }),
    wall({ x: 9.2, y: hs }, { x: 9.2, y: hs + 1.4 }),
  );

  elements.push(
    device("door", { x: 6.6, y: hs }, "", 0),
    device("door", { x: HALL.w, y: 10.4 }, "", 90),
    device("door", { x: HALL.w, y: 16.8 }, "", 90),
    device("door", { x: HALL.w + CORR.w, y: 5.2 }, "", 90),
    device("door", { x: HALL.w + CORR.w, y: 8.0 }, "", 90),
    device("door", { x: HALL.w + CORR.w, y: 13.2 }, "", 0),
    device("door", { x: 11.2, y: 2.2 }, "", 90),
    device("door", { x: 3.4, y: 4.6 }, "", 0),
  );

  const tv85 = device("display", { x: 4.5, y: 5.12 }, "85\"", 0, "HDMI-1", "wall", "samsung-qm85");
  const nb1 = device("neatbar", { x: 4.5, y: 5.62 }, "NB-1", 0, undefined, "wall", "neat-bar");
  const tv85s = device("display", { x: 5.45, y: hs - 0.52 }, "85-S", 180, "HDMI-4", "wall", "samsung-qm85");
  const nb2 = device("neatbar", { x: 5.45, y: hs - 1.05 }, "NB-2", 180, undefined, "wall", "neat-bar");
  const drums = device("drums", { x: 2.15, y: 6.3 }, "", 0, undefined, undefined, "pearl-export");
  const keys = device("keys", { x: 6.85, y: 6.3 }, "", 0, undefined, undefined, "nord-stage");
  const mic1 = device("mic", { x: 3.2, y: 7.05 }, "", 0, undefined, undefined, "shure-sm58");
  const mic2 = device("mic", { x: 4.5, y: 7.2 }, "", 0, undefined, undefined, "shure-sm58");
  const mic3 = device("mic", { x: 5.8, y: 7.05 }, "", 0, undefined, undefined, "shure-sm58");

  const spkFL = device("speaker", { x: 2.1, y: 8.15 }, "K8-FL", 0, "PWR-A", "ceiling", "qsc-k8");
  const spkFR = device("speaker", { x: 6.9, y: 8.15 }, "K8-FR", 0, "PWR-A", "ceiling", "qsc-k8");
  const spkCL = device("speaker", { x: 2.1, y: 12.85 }, "K8-CL", 0, "PWR-B", "ceiling", "qsc-k8");
  const spkCR = device("speaker", { x: 6.9, y: 12.85 }, "K8-CR", 0, "PWR-B", "ceiling", "qsc-k8");

  const tv55a = device("display", { x: 4.5, y: 10.7 }, "55-1", 0, "HDMI-2", "ceiling", "samsung-qm55");
  const tv55b = device("display", { x: 4.5, y: 14.4 }, "55-2", 0, "HDMI-3", "ceiling", "samsung-qm55");

  const ptz1 = device("camera", { x: 1.55, y: 15.35 }, "PTZ-1", 270, undefined, "ceiling", "ptz-formako");
  const ptz2 = device("camera", { x: 7.45, y: 15.35 }, "PTZ-2", 270, undefined, "ceiling", "ptz-formako");

  const rack = device("rack", { x: 0.95, y: 16.45 }, "RACK", 0, undefined, undefined, "ma-wrk");
  const pdu = device("pdu", { x: 0.95, y: 18.0 }, "PDU", 0, "C20", undefined, "furman-pl");
  const shure = device("shure", { x: 0.95, y: 19.25 }, "SHU", 0, undefined, undefined, "shure-slxd24");
  const netsw = device("netswitch", { x: 2.3, y: 16.45 }, "SW", 0, undefined, undefined, "cisco-cbs250");
  const ptzc = device("ptzctrl", { x: 3.7, y: 16.45 }, "PTZC", 0, undefined, undefined, "ptzoptics-superjoy");
  const wing = device("mixer", { x: 2.3, y: 17.85 }, "FOH", 0, undefined, undefined, "behr-wingc");
  const sb = device("stagebox", { x: 0.72, y: 6.55 }, "SD16", 90, "AES50", "wall", "behr-sd16");
  const djFoh = device("datajack", { x: 0.28, y: 17.4 }, "DJ-1", 90, undefined, "wall");
  const djStg = device("datajack", { x: 0.28, y: 6.55 }, "DJ-2", 90, undefined, "wall");
  const xpFoh = device("jbox", { x: 0.28, y: 18.2 }, "XP-1", 90, "XLR", "wall");
  const pc = device("zoompc", { x: 2.3, y: 19.25 }, "PC", 0, undefined, undefined, "intel-nuc");
  const mon = device("monitor", { x: 3.7, y: 19.25 }, "MON", 0, undefined, undefined, "dell-p2422");
  const pad1 = device("neatpad", { x: 0.95, y: 20.35 }, "PAD-1", 0, undefined, undefined, "neat-pad");
  const pad2 = device("neatpad", { x: 1.7, y: 20.35 }, "PAD-2", 0, undefined, undefined, "neat-pad");
  const split = device("splitter", { x: 2.5, y: 20.35 }, "SPL", 0, undefined, undefined, "aten-vs");
  const zctrl = device("zoomctrl", { x: 3.25, y: 20.35 }, "ZCTL", 0, undefined, undefined, "logi-tap");
  const zsched = device("zoomsched", { x: 4.0, y: 20.35 }, "ZSCH", 0, undefined, undefined, "logi-scribe");
  const panel = device("panel", { x: 13.4, y: 7.5 }, "LP");

  elements.push(
    tv85, nb1, tv85s, nb2, drums, keys, mic1, mic2, mic3,
    spkFL, spkFR, spkCL, spkCR, tv55a, tv55b, ptz1, ptz2,
    rack, pdu, shure, wing, sb, pc, pad1, netsw, ptzc, mon, pad2, split, zctrl, zsched,
    panel, djFoh, djStg, xpFoh,
    device("outlet", { x: 5.65, y: 4.88 }, "", 0, "A1"),
    device("outlet", { x: 0.28, y: 8.15 }, "", 90, "A2"),
    device("outlet", { x: 8.72, y: 8.15 }, "", 270, "A2"),
    device("outlet", { x: 0.28, y: 12.85 }, "", 90, "A3"),
    device("outlet", { x: 8.72, y: 12.85 }, "", 270, "A3"),
    device("outlet", { x: 0.28, y: 10.7 }, "", 90, "A4"),
    device("outlet", { x: 8.72, y: 10.7 }, "", 270, "A4"),
    device("outlet", { x: 0.28, y: 15.15 }, "", 90, "A5"),
    device("outlet", { x: 0.28, y: 20.55 }, "", 90, "A5"),
    device("outlet", { x: 6.55, y: hs - 0.28 }, "", 180, "A6"),
  );

  const wx = 0.28;
  const c6a = 0.2;
  const c6b = 0.36;
  const ptzY = 15.35;
  const fohY = 17.4;
  const stgY = 6.55;
  const spkCY = 12.85;
  const spkFY = 8.15;
  const tvY = 10.7;
  const tv2Y = 14.4;
  const xpY = 18.2;
  const xa = 0.14;
  const xb = 0.24;
  const xc = 0.4;
  const xd = 0.48;
  const ha = 4.42;
  const hb = 4.58;
  elements.push(
    trunk([{ x: wx, y: stgY - 0.15 }, { x: wx, y: xpY + 0.15 }], "T-W", "wall"),
    trunk([{ x: wx, y: ptzY }, { x: 7.55, y: ptzY }], "T-C", "ceiling"),
    trunk([{ x: wx, y: spkCY }, { x: 7.05, y: spkCY }], "T-CL", "ceiling"),
    trunk([{ x: wx, y: spkFY }, { x: 7.05, y: spkFY }], "T-FL", "ceiling"),
    trunk([{ x: 4.5, y: 5.7 }, { x: 4.5, y: tv2Y }], "T-NB", "ceiling"),
    cable("cat6", [{ x: 1.55, y: ptzY }, { x: c6a, y: ptzY }, { x: c6a, y: fohY }], "C6-1", ptz1.id, djFoh.id),
    cable("cat6", [{ x: 7.45, y: ptzY }, { x: c6b, y: ptzY }, { x: c6b, y: fohY }], "C6-2", ptz2.id, djFoh.id),
    cable("cat6", [{ x: c6a, y: fohY }, { x: c6a, y: stgY }], "C6-3", djFoh.id, djStg.id),
    cable("cat6", [{ x: c6b, y: fohY }, { x: c6b, y: stgY }], "C6-4", djFoh.id, djStg.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xa, y: xpY }, { x: xa, y: spkCY }, { x: 2.1, y: spkCY }], "X-1", xpFoh.id, spkCL.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xb, y: xpY }, { x: xb, y: spkCY }, { x: 6.9, y: spkCY }], "X-2", xpFoh.id, spkCR.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xc, y: xpY }, { x: xc, y: spkFY }, { x: 2.1, y: spkFY }], "X-3", xpFoh.id, spkFL.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xd, y: xpY }, { x: xd, y: spkFY }, { x: 6.9, y: spkFY }], "X-4", xpFoh.id, spkFR.id),
    cable("hdmi", [{ x: 4.5, y: 5.62 }, { x: ha, y: 5.62 }, { x: ha, y: tvY }, { x: 4.5, y: tvY }], "H-1", nb1.id, tv55a.id),
    cable("hdmi", [{ x: 4.5, y: 5.62 }, { x: hb, y: 5.62 }, { x: hb, y: tv2Y }, { x: 4.5, y: tv2Y }], "H-2", nb1.id, tv55b.id),
  );

  return {
    id: uid("dw"),
    name: "L3 Hall AV",
    meta: {
      project: "Compassion Accra · National Office",
      drawingNo: "AV-L3-102",
      title: "L3 Hall — AV layout",
      author: "CI AVS",
      date: "10 Sep 2026",
      scaleLabel: "1:150",
      unit: "m",
    },
    elements,
    layers: { ...DEFAULT_LAYERS },
  };
}

/** Patch a saved hall sheet: move SD16 to the drums, add west/ceiling trunks and the four Cat6s. */
export function applyStageCat6Trunks(d: Drawing): Drawing {
  if (d.meta?.drawingNo !== "AV-L3-102") return d;
  if (d.elements.some((el) => el.kind === "trunk" && el.label === "T-W")) return d;
  const find = (label: string) =>
    d.elements.find((el): el is Device => el.kind === "device" && el.label === label);
  const elements = d.elements.map((el) => {
    if (el.kind === "device" && el.device === "stagebox") {
      return { ...el, pos: { x: 0.72, y: 6.55 }, rotation: 90, mount: "wall" as const, circuit: el.circuit ?? "AES50" };
    }
    return el;
  });
  const ptz1 = find("PTZ-1");
  const ptz2 = find("PTZ-2");
  const wx = 0.28;
  const c6a = 0.2;
  const c6b = 0.36;
  const ptzY = 15.35;
  const fohY = 17.4;
  const stgY = 6.55;
  const djFoh = device("datajack", { x: wx, y: fohY }, "DJ-1", 90, undefined, "wall");
  const djStg = device("datajack", { x: wx, y: stgY }, "DJ-2", 90, undefined, "wall");
  elements.push(
    djFoh,
    djStg,
    trunk([{ x: wx, y: stgY - 0.15 }, { x: wx, y: fohY + 0.2 }], "T-W", "wall"),
    trunk([{ x: wx, y: ptzY }, { x: 7.55, y: ptzY }], "T-C", "ceiling"),
    cable("cat6", [{ x: ptz1?.pos.x ?? 1.55, y: ptz1?.pos.y ?? ptzY }, { x: c6a, y: ptzY }, { x: c6a, y: fohY }], "C6-1", ptz1?.id, djFoh.id),
    cable("cat6", [{ x: ptz2?.pos.x ?? 7.45, y: ptz2?.pos.y ?? ptzY }, { x: c6b, y: ptzY }, { x: c6b, y: fohY }], "C6-2", ptz2?.id, djFoh.id),
    cable("cat6", [{ x: c6a, y: fohY }, { x: c6a, y: stgY }], "C6-3", djFoh.id, djStg.id),
    cable("cat6", [{ x: c6b, y: fohY }, { x: c6b, y: stgY }], "C6-4", djFoh.id, djStg.id),
  );
  return { ...d, elements };
}

/** Patch: XLR from FOH wall to the four K.8s, HDMI from front Neat Bar to the 55" pair. */
export function applySpeakerHdmiTrunks(d: Drawing): Drawing {
  if (d.meta?.drawingNo !== "AV-L3-102") return d;
  if (d.elements.some((el) => el.kind === "cable" && el.label === "X-1")) return d;
  const find = (label: string) =>
    d.elements.find((el): el is Device => el.kind === "device" && el.label === label);
  const elements = d.elements.slice();
  const wx = 0.28;
  const spkCY = 12.85;
  const spkFY = 8.15;
  const tvY = 10.7;
  const xpY = 18.2;
  const xa = 0.14;
  const xb = 0.24;
  const xc = 0.4;
  const xd = 0.48;
  const ha = 4.42;
  const hb = 4.58;
  let xpFoh = find("XP-1");
  if (!xpFoh) {
    xpFoh = device("jbox", { x: wx, y: xpY }, "XP-1", 90, "XLR", "wall");
    elements.push(xpFoh);
  }
  const tw = elements.find((el) => el.kind === "trunk" && el.label === "T-W");
  if (tw && tw.kind === "trunk") {
    tw.points = [{ x: wx, y: 6.4 }, { x: wx, y: xpY + 0.15 }];
  }
  if (!elements.some((el) => el.kind === "trunk" && el.label === "T-CL")) {
    elements.push(
      trunk([{ x: wx, y: spkCY }, { x: 7.05, y: spkCY }], "T-CL", "ceiling"),
      trunk([{ x: wx, y: spkFY }, { x: 7.05, y: spkFY }], "T-FL", "ceiling"),
      trunk([{ x: 4.5, y: 5.7 }, { x: 4.5, y: tvY }], "T-NB", "ceiling"),
      trunk([{ x: 2.4, y: tvY }, { x: 6.6, y: tvY }], "T-55", "ceiling"),
    );
  }
  const spkCL = find("K8-CL");
  const spkCR = find("K8-CR");
  const spkFL = find("K8-FL");
  const spkFR = find("K8-FR");
  const nb1 = find("NB-1");
  const tv55w = find("55-W");
  const tv55e = find("55-E");
  elements.push(
    cable("xlr", [{ x: wx, y: xpY }, { x: xa, y: xpY }, { x: xa, y: spkCY }, { x: 2.1, y: spkCY }], "X-1", xpFoh.id, spkCL?.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xb, y: xpY }, { x: xb, y: spkCY }, { x: 6.9, y: spkCY }], "X-2", xpFoh.id, spkCR?.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xc, y: xpY }, { x: xc, y: spkFY }, { x: 2.1, y: spkFY }], "X-3", xpFoh.id, spkFL?.id),
    cable("xlr", [{ x: wx, y: xpY }, { x: xd, y: xpY }, { x: xd, y: spkFY }, { x: 6.9, y: spkFY }], "X-4", xpFoh.id, spkFR?.id),
    cable("hdmi", [{ x: 4.5, y: 5.62 }, { x: ha, y: 5.62 }, { x: ha, y: tvY }, { x: 2.5, y: tvY }], "H-1", nb1?.id, tv55w?.id),
    cable("hdmi", [{ x: 4.5, y: 5.62 }, { x: hb, y: 5.62 }, { x: hb, y: tvY }, { x: 6.5, y: tvY }], "H-2", nb1?.id, tv55e?.id),
  );
  return { ...d, elements };
}

const HALL_CX = 4.5;
const TV1_Y = 10.7;
const TV2_Y = 14.4; // ~3/4 of the floor, between the centre K.8s and the PTZs

/** Patch: both 55" on the hall centreline — mid-hall and three-quarters back. */
export function applyCenter55s(d: Drawing): Drawing {
  if (d.meta?.drawingNo !== "AV-L3-102") return d;
  if (d.elements.some((el) => el.kind === "device" && el.label === "55-1")) return d;
  const ha = 4.42;
  const hb = 4.58;
  const elements: Element[] = [];
  for (const el of d.elements) {
    if (el.kind === "device" && el.label === "55-W") {
      elements.push({ ...el, pos: { x: HALL_CX, y: TV1_Y }, label: "55-1" });
      continue;
    }
    if (el.kind === "device" && el.label === "55-E") {
      elements.push({ ...el, pos: { x: HALL_CX, y: TV2_Y }, label: "55-2" });
      continue;
    }
    if (el.kind === "trunk" && el.label === "T-NB") {
      elements.push({ ...el, points: [{ x: HALL_CX, y: 5.7 }, { x: HALL_CX, y: TV2_Y }] });
      continue;
    }
    if (el.kind === "trunk" && el.label === "T-55") continue;
    if (el.kind === "cable" && el.label === "H-1") {
      elements.push({
        ...el,
        points: [
          { x: HALL_CX, y: 5.62 },
          { x: ha, y: 5.62 },
          { x: ha, y: TV1_Y },
          { x: HALL_CX, y: TV1_Y },
        ],
      });
      continue;
    }
    if (el.kind === "cable" && el.label === "H-2") {
      elements.push({
        ...el,
        points: [
          { x: HALL_CX, y: 5.62 },
          { x: hb, y: 5.62 },
          { x: hb, y: TV2_Y },
          { x: HALL_CX, y: TV2_Y },
        ],
      });
      continue;
    }
    elements.push(el);
  }
  return { ...d, elements };
}

/** Patch: Neat Bars sit on the walls under the 85" displays. */
export function applyWallNeatBars(d: Drawing): Drawing {
  if (d.meta?.drawingNo !== "AV-L3-102") return d;
  const bars = d.elements.filter((el): el is Device => el.kind === "device" && el.device === "neatbar");
  if (!bars.length || bars.every((b) => b.mount === "wall")) return d;
  const elements = d.elements.map((el) => {
    if (el.kind === "device" && el.device === "neatbar") {
      return { ...el, mount: "wall" as const };
    }
    return el;
  });
  return { ...d, elements };
}

const L3_LABEL_CATALOG: Record<string, string> = {
  FOH: "behr-wingc",
  SD16: "behr-sd16",
  "K8-FL": "qsc-k8",
  "K8-FR": "qsc-k8",
  "K8-CL": "qsc-k8",
  "K8-CR": "qsc-k8",
  '85"': "samsung-qm85",
  "85-S": "samsung-qm85",
  "55-1": "samsung-qm55",
  "55-2": "samsung-qm55",
  "NB-1": "neat-bar",
  "NB-2": "neat-bar",
  "PTZ-1": "ptz-formako",
  "PTZ-2": "ptz-formako",
  RACK: "ma-wrk",
  PDU: "furman-pl",
  SHU: "shure-slxd24",
  SW: "cisco-cbs250",
  PTZC: "ptzoptics-superjoy",
  PC: "intel-nuc",
  MON: "dell-p2422",
  "PAD-1": "neat-pad",
  "PAD-2": "neat-pad",
  SPL: "aten-vs",
  ZCTL: "logi-tap",
  ZSCH: "logi-scribe",
};

/** Stamp catalog brand/model onto the L3 plot if a sheet predates the library. */
export function applyCatalogStamps(d: Drawing): Drawing {
  if (d.meta?.drawingNo !== "AV-L3-102") return d;
  let changed = false;
  const elements = d.elements.map((el) => {
    if (el.kind !== "device" || el.brand) return el;
    const catId = el.label ? L3_LABEL_CATALOG[el.label] : el.device === "mic" ? "shure-sm58" : el.device === "drums" ? "pearl-export" : el.device === "keys" ? "nord-stage" : el.device === "outlet" ? "legrand-quad" : undefined;
    if (!catId) return el;
    const cat = STOCK_CATALOG.find((it) => it.id === catId);
    if (!cat) return el;
    changed = true;
    return { ...el, catalogId: cat.id, brand: cat.brand, model: cat.model };
  });
  return changed ? { ...d, elements } : d;
}

export function blankMetric(name = "Untitled drawing"): Drawing {
  return {
    id: uid("dw"),
    name,
    meta: {
      project: "New project",
      drawingNo: "AV-001",
      title: "Cable Layout",
      author: "",
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      scaleLabel: "1:100",
      unit: "m",
    },
    elements: [],
    layers: { ...DEFAULT_LAYERS },
  };
}
