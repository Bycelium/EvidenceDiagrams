export function diagonalArrowPoints(segment, side, selected = false) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const length = Math.hypot(dx, dy);
  if (length < .01) return null;
  const width = selected ? 5 : 3;
  const halfWidth = width / 2;
  const tangent = { x: dx / length, y: dy / length };
  const normal = { x: -dy / length, y: dx / length };
  const direction = side === 'minimum' ? 1 : -1;
  const outward = { x: normal.x * direction, y: normal.y * direction };
  const startInside = {
    x: segment.x1 - outward.x * halfWidth,
    y: segment.y1 - outward.y * halfWidth,
  };
  const startOutside = {
    x: segment.x1 + outward.x * halfWidth,
    y: segment.y1 + outward.y * halfWidth,
  };
  if (!segment.trueEnd) {
    return [
      startInside,
      { x: segment.x2 - outward.x * halfWidth, y: segment.y2 - outward.y * halfWidth },
      { x: segment.x2 + outward.x * halfWidth, y: segment.y2 + outward.y * halfWidth },
      startOutside,
    ];
  }

  const longitudinalSize = Math.min(selected ? 24 : 21, length * .72);
  const rear = {
    x: segment.x2 - tangent.x * longitudinalSize,
    y: segment.y2 - tangent.y * longitudinalSize,
  };
  const segmentTop = Math.max(0, Math.min(segment.y1, segment.y2));
  const segmentBottom = Math.max(segment.y1, segment.y2);
  const verticalRoom = outward.y < 0 ? rear.y - segmentTop : segmentBottom - rear.y;
  const exteriorRoom = Math.max(
    0,
    verticalRoom / Math.max(Math.abs(outward.y), Number.EPSILON),
  );
  const rearHalfWidth = Math.min(halfWidth, exteriorRoom);
  const outwardSize = Math.min(selected ? 10 : 9, longitudinalSize * .6, exteriorRoom);
  return [
    startInside,
    { x: rear.x - outward.x * rearHalfWidth, y: rear.y - outward.y * rearHalfWidth },
    { x: segment.x2, y: segment.y2 },
    {
      x: rear.x + outward.x * Math.max(rearHalfWidth, outwardSize),
      y: rear.y + outward.y * Math.max(rearHalfWidth, outwardSize),
    },
    { x: rear.x + outward.x * rearHalfWidth, y: rear.y + outward.y * rearHalfWidth },
    startOutside,
  ];
}
