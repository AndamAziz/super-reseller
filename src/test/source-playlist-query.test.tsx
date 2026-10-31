import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { sourcePlaylistQueryOptions } from "@/lib/source-playlist-query";

vi.mock("@/lib/source-playlist.functions", () => ({ getSourcePlaylist: vi.fn() }));

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("automatically reads changed category order after five seconds without remounting", async () => {
  vi.useFakeTimers();
  const channel = (group: string) => ({ id: group, name: group, group_title: group, url: "https://x.test/live.m3u8", logo: null, referrer: null });
  const initial = [channel("Sport"), channel("News")];
  const updated = [channel("News"), channel("Sport")];
  const fetchPlaylist = vi.fn().mockResolvedValue(updated);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["source-playlist"], initial);
  const { result } = renderHook(() => useQuery(sourcePlaylistQueryOptions(fetchPlaylist)), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  expect(result.current.data?.map((c) => c.group_title)).toEqual(["Sport", "News"]);
  await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
  expect(fetchPlaylist).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); await vi.advanceTimersByTimeAsync(10); });
  expect(fetchPlaylist).toHaveBeenCalledTimes(1);
  expect(result.current.data?.map((c) => c.group_title)).toEqual(["News", "Sport"]);
  client.clear();
});