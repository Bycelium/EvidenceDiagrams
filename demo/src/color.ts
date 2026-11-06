/** Mixes a palette color halfway toward the demo's dark text color. */
export function readableMetricColor(color: string): string {
  const match = /^#([\da-f]{6})$/i.exec(color);
  if (!match) return '#64748b';
  const channels = match[1]!.match(/[\da-f]{2}/gi)!.map((channel) => Number.parseInt(channel, 16));
  const foreground = [0x0f, 0x17, 0x2a];
  return `#${channels.map((channel, index) => Math.round((channel + foreground[index]!) / 2)
    .toString(16).padStart(2, '0')).join('')}`;
}
