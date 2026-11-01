import { detectMedia, type MediaProtocol } from "./media-detection";

/** Browser-only entry point; no DOM access or engine import during SSR. */
export async function loadBrowserPlayback(video: HTMLVideoElement, url: string) {
  const response = await fetch(url, { headers: { Range: "bytes=0-4095" }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Playback HTTP ${response.status}`); }
  const reader = response.body?.getReader();
  const first = await reader?.read();
  await reader?.cancel();
  const protocol: MediaProtocol = detectMedia(first?.value ?? new Uint8Array(), response.headers.get("content-type") ?? "", url);
  if (protocol === "flv" || protocol === "avi" || /^rtmps?:/i.test(url)) throw new Error("Unsupported container or protocol in this browser; use a compatible external player or an approved conversion service.");
  if (protocol === "hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
    const { default: Hls } = await import("hls.js");
    if (!Hls.isSupported()) throw new Error("HLS decoding is unsupported in this browser.");
    const hls = new Hls();
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("HLS startup timeout")), 30000);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { clearTimeout(timer); resolve(); });
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { clearTimeout(timer); reject(new Error(`HLS ${data.details}`)); } });
        hls.attachMedia(video); hls.loadSource(url);
      });
    } catch (error) { hls.destroy(); throw error; }
    return { protocol, httpStatus: response.status, player: null, destroy: async () => { hls.destroy(); video.pause(); video.removeAttribute("src"); video.load(); } };
  }
  if (protocol === "dash") {
    const { default: shaka } = await import("shaka-player");
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) throw new Error("This browser does not support adaptive media playback.");
    const player = new shaka.Player();
    await player.attach(video);
    try { await player.load(url, undefined, "application/dash+xml"); }
    catch { await player.destroy(); throw new Error("Manifest, codec, DRM or source is unsupported/unavailable in this browser."); }
    return { protocol, httpStatus: response.status, player, destroy: () => player.destroy() };
  }
  video.src = url;
  video.load();
  return { protocol, httpStatus: response.status, player: null, destroy: async () => { video.pause(); video.removeAttribute("src"); video.load(); } };
}