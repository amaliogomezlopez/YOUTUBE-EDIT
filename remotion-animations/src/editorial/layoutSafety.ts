export type LayoutPoint = {
  x: number;
  y: number;
};

export type LayoutRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const rectWidth = (rect: LayoutRect) => rect.right - rect.left;
const rectHeight = (rect: LayoutRect) => rect.bottom - rect.top;

const overlaps = (left: LayoutRect, right: LayoutRect) =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

const inside = (rect: LayoutRect, bounds: LayoutRect) =>
  rect.left >= bounds.left &&
  rect.right <= bounds.right &&
  rect.top >= bounds.top &&
  rect.bottom <= bounds.bottom;

const moveRect = (rect: LayoutRect, left: number, top: number): LayoutRect => ({
  left,
  right: left + rectWidth(rect),
  top,
  bottom: top + rectHeight(rect),
});

const distance = (left: LayoutRect, right: LayoutRect) =>
  Math.hypot(left.left - right.left, left.top - right.top);

/**
 * Finds the nearest deterministic overlay slot that does not cover reserved
 * information such as chart axes, dates, sources or another annotation.
 */
export const resolveSafeOverlayRect = ({
  preferred,
  avoid,
  bounds = {left: 40, right: 1880, top: 36, bottom: 1010},
  gap = 18,
}: {
  preferred: LayoutRect;
  avoid: readonly LayoutRect[];
  bounds?: LayoutRect;
  gap?: number;
}): LayoutRect => {
  const width = rectWidth(preferred);
  const height = rectHeight(preferred);
  const candidates = [
    preferred,
    ...avoid.flatMap((reserved) => [
      moveRect(preferred, preferred.left, reserved.top - height - gap),
      moveRect(preferred, preferred.left, reserved.bottom + gap),
      moveRect(preferred, reserved.left - width - gap, preferred.top),
      moveRect(preferred, reserved.right + gap, preferred.top),
    ]),
  ];
  const safe = candidates
    .filter((candidate) => inside(candidate, bounds))
    .filter(
      (candidate) =>
        !avoid.some((reserved) => overlaps(candidate, reserved)),
    )
    .sort((left, right) => distance(left, preferred) - distance(right, preferred));
  if (safe[0]) return safe[0];
  const clampedLeft = Math.min(
    bounds.right - width,
    Math.max(bounds.left, preferred.left),
  );
  const clampedTop = Math.min(
    bounds.bottom - height,
    Math.max(bounds.top, preferred.top),
  );
  return moveRect(preferred, clampedLeft, clampedTop);
};

/**
 * Returns the point where a connector aimed at the centre of a card first
 * touches its outer rectangle. A positive gap stops the line just before the
 * border, preventing strokes and arrowheads from entering the card.
 */
export const connectorEndpointAtRect = ({
  source,
  target,
  gap = 0,
}: {
  source: LayoutPoint;
  target: LayoutRect;
  gap?: number;
}): LayoutPoint => {
  const center = {
    x: (target.left + target.right) / 2,
    y: (target.top + target.bottom) / 2,
  };
  const dx = source.x - center.x;
  const dy = source.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfWidth = rectWidth(target) / 2 + gap;
  const halfHeight = rectHeight(target) / 2 + gap;
  const xScale = Math.abs(dx) > 0 ? halfWidth / Math.abs(dx) : Infinity;
  const yScale = Math.abs(dy) > 0 ? halfHeight / Math.abs(dy) : Infinity;
  const scale = Math.min(xScale, yScale);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
};
