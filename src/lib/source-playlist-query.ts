import { queryOptions } from "@tanstack/react-query";
import { fetchSourcePlaylistDirect } from "./source-playlist-direct";

export const SOURCE_PLAYLIST_POLL_MS = 5_000;

export function sourcePlaylistQueryOptions(fetchPlaylist = fetchSourcePlaylistDirect) {
  return queryOptions({
    queryKey: ["source-playlist"],
    queryFn: fetchPlaylist,
    staleTime: SOURCE_PLAYLIST_POLL_MS,
    refetchInterval: SOURCE_PLAYLIST_POLL_MS,
    refetchOnWindowFocus: "always",
    retry: 1,
  });
}