export function channelNeighbor<T extends { id: string }>(channels: readonly T[], id: string, direction: -1 | 1): T | undefined {
  const index = channels.findIndex((channel) => channel.id === id);
  if (index < 0) return undefined;
  return channels[index + direction];
}