import type { ZoneKey } from "./types";

/**
 * Where everything goes on the zone map: a square plot of two skills (0–100 each), its four
 * quadrants split at the threshold, the participant's dot and "You", and the zone names. Shared by the
 * result page (an SVG) and the PDF report, so both place things the same way. All numbers are in the
 * units of a MAP_SIZE × MAP_SIZE drawing, y growing downwards.
 */

export const MAP_SIZE = 400;
export const PLOT = { left: 60, top: 24, size: 312 };
// The zone names inside the plot are bold capitals of about 6.8 units per letter (see Stage.css).
const NAME = { charWidth: 6.8, height: 14, inset: 6 };
// Names keep this far from the dot, and from the word "You" that stands beside it.
const DOT_ROOM = 20;
const YOU = { width: 30, height: 19, gap: 24 };

export interface MapZone {
  key: string;
  label: string;
  x: number;
  y: number;
  threshold: number;
}

export interface Box { left: number; right: number; top: number; bottom: number }
export interface Placed { x: number; y: number; anchor: "start" | "end" }

export interface ZoneMapLayout {
  /** Where the dashed lines cross. */
  split: { x: number; y: number };
  right: number;
  bottom: number;
  quadrants: Record<ZoneKey, { x: number; y: number; width: number; height: number }>;
  dot: { x: number; y: number };
  you: Placed;
  names: Array<Placed & { key: ZoneKey; text: string }>;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Number(value) || 0));
export const plotX = (value: number) => PLOT.left + (clamp(value) / 100) * PLOT.size;
export const plotY = (value: number) => PLOT.top + PLOT.size - (clamp(value) / 100) * PLOT.size;

/** The zone name cut to the room it has; "" when not even a few letters fit. */
function fitName(text: string, room: number) {
  const letters = Math.floor(room / NAME.charWidth);
  if (!text || letters < 4) return "";
  return text.length <= letters ? text : `${text.slice(0, letters - 1).trimEnd()}…`;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const textBox = (x: number, baseline: number, width: number, height: number, anchor: "start" | "end"): Box => ({
  left: anchor === "end" ? x - width : x,
  right: anchor === "end" ? x : x + width,
  top: baseline - height + 3,
  bottom: baseline + 3,
});

export function zoneMapLayout(zone: MapZone, config: { zones?: Record<string, { label?: string } | undefined> } | null = null): ZoneMapLayout {
  const split = { x: plotX(zone.threshold), y: plotY(zone.threshold) };
  const right = PLOT.left + PLOT.size;
  const bottom = PLOT.top + PLOT.size;
  const quadrants: ZoneMapLayout["quadrants"] = {
    topLeft: { x: PLOT.left, y: PLOT.top, width: split.x - PLOT.left, height: split.y - PLOT.top },
    topRight: { x: split.x, y: PLOT.top, width: right - split.x, height: split.y - PLOT.top },
    bottomLeft: { x: PLOT.left, y: split.y, width: split.x - PLOT.left, height: bottom - split.y },
    bottomRight: { x: split.x, y: split.y, width: right - split.x, height: bottom - split.y },
  };
  const dot = { x: plotX(zone.x), y: plotY(zone.y) };
  // "You" stands beside the ring on its own line, on the side that faces the middle of the plot.
  const youOnLeft = dot.x > PLOT.left + PLOT.size / 2;
  const you: Placed = { x: dot.x + (youOnLeft ? -YOU.gap : YOU.gap), y: dot.y + 5, anchor: youOnLeft ? "end" : "start" };
  const avoid: Box[] = [
    { left: dot.x - DOT_ROOM, right: dot.x + DOT_ROOM, top: dot.y - DOT_ROOM, bottom: dot.y + DOT_ROOM },
    textBox(you.x, you.y, YOU.width, YOU.height, you.anchor),
  ];
  // A zone's name sits in the outer corner of its quadrant, or at the inner end when the dot is in the way.
  const names = (Object.keys(quadrants) as ZoneKey[]).flatMap((key) => {
    const box = quadrants[key];
    const text = fitName(config?.zones?.[key]?.label || (key === zone.key ? zone.label : ""), box.width - 2 * NAME.inset);
    if (!text || box.height < 34) return [];
    const top = key.startsWith("top");
    const anchor: "start" | "end" = key.endsWith("Right") ? "end" : "start";
    const x = anchor === "end" ? box.x + box.width - NAME.inset : box.x + NAME.inset;
    const outer = top ? box.y + 18 : box.y + box.height - 10;
    const inner = top ? box.y + box.height - 10 : box.y + 18;
    const width = text.length * NAME.charWidth;
    const y = [outer, inner].find((baseline) => !avoid.some((area) => overlaps(textBox(x, baseline, width, NAME.height, anchor), area)));
    return y === undefined ? [] : [{ key, text, x, y, anchor }];
  });
  return { split, right, bottom, quadrants, dot, you, names };
}
