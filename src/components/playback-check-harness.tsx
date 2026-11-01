import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { preparePlaybackCheck } from "@/lib/playback-check.functions";
import { useLines } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { playbackVerdict } from "@/lib/playback-verdict";
import { loadBrowserPlayback } from "@/lib/browser-playback";

export default function PlaybackCheckHarness() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const destroy = useRef<(() => Promise<void>) | null>(null);
  const { data: lines = [] } = useLines();
  const [lineId, setLineId] = useState("");
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const prepare = useServerFn(preparePlaybackCheck);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let audio: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let disposed = false;
    async function check(url: string, expectsVideo = true, expectsAudio = true, durationMs = 12000) {
      if (!video || disposed) throw new Error("Playback harness unavailable");
      await destroy.current?.();
      let mediaError: string | null = null;
      const onError = () => { mediaError = `Browser media error ${video.error?.code ?? "unknown"}: unsupported codec/container or unavailable source`; };
      video.addEventListener("error", onError);
      if (!audio) {
        audio = new AudioContext();
        analyser = audio.createAnalyser();
        audio.createMediaElementSource(video).connect(analyser);
        analyser.connect(audio.destination);
      }
      await audio.resume();
      const engine = await loadBrowserPlayback(video, url);
      destroy.current = engine.destroy;
      const player = engine.player;
      const started = performance.now();
      let playTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([video.play(), new Promise<never>((_, reject) => { playTimer = setTimeout(() => reject(new Error("Decoded playback did not start within 30 seconds")), 30000); })]);
      } catch (error) { await engine.destroy(); throw error; }
      finally { clearTimeout(playTimer); }
      const initialTime = video.currentTime;
      let peak = 0, stalls = 0, frames = 0;
      let lastTime = initialTime;
      const waveform = new Float32Array(2048);
      const startFrames = video.getVideoPlaybackQuality().totalVideoFrames;
      let presented = 0;
      const onFrame: VideoFrameRequestCallback = () => { presented++; if (!disposed && !video.paused) video.requestVideoFrameCallback(onFrame); };
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame);
      while (performance.now() - started < durationMs && !disposed) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (analyser) { analyser.getFloatTimeDomainData(waveform); peak = Math.max(peak, Math.sqrt(waveform.reduce((sum, value) => sum + value * value, 0) / waveform.length)); }
        if (video.currentTime === lastTime && !video.paused && video.readyState < 3) stalls++;
        lastTime = video.currentTime;
      }
      frames = Math.max(presented, video.getVideoPlaybackQuality().totalVideoFrames - startFrames);
      const evidence = { secondsAdvanced: video.currentTime - initialTime, frames, width: video.videoWidth, audioPeak: peak, error: mediaError, expectsVideo, expectsAudio };
      const seek = { supported: video.seekable.length > 0, verified: false };
      if (seek.supported && Number.isFinite(video.duration) && video.duration > 15) {
        const target = Math.min(video.duration - 2, video.currentTime + 5);
        video.currentTime = target;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        seek.verified = video.currentTime >= target && video.readyState >= 2;
      }
      const variants = player?.getVariantTracks() ?? [];
      const textTracks = player?.getTextTracks() ?? [];
      const stats = player?.getStats();
      video.removeEventListener("error", onError);
      video.pause();
      return { ...playbackVerdict(evidence), evidence, protocol: engine.protocol, httpStatus: engine.httpStatus, seek,
        audioTracks: [...new Set(variants.map((track) => track.language))], subtitleTracks: textTracks.length,
        variantCount: variants.length, switchHistory: stats?.switchHistory ?? [], stalls,
        durationMs, audioAudibility: "Decoded output signal only; human/device listening unverified", synchronization: "Not independently measured on uncontrolled media" };
    }
    const api = { check };
    Object.assign(window, { kurdistanPlaybackCheck: api });
    return () => {
      disposed = true;
      void destroy.current?.();
      void audio?.close();
      Reflect.deleteProperty(window, "kurdistanPlaybackCheck");
    };
  }, []);

  async function run() {
    setBusy(true);
    try {
      const prepared = await prepare({ data: { lineId, channelIndex: index } });
      const api = Reflect.get(window, "kurdistanPlaybackCheck") as { check: (url: string, video: boolean, audio: boolean) => Promise<unknown> };
      setResult(await api.check(prepared.path, !/\.mp3(?:\?|$)/i.test(prepared.path), true));
    } catch (error) { setResult({ ok: false, error: error instanceof Error ? error.message : "Playback unavailable" }); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <h1 className="font-display text-2xl">Playback check</h1>
    <div className="flex flex-wrap gap-3">
      <select aria-label="Authorized test line" className="rounded border border-border bg-background p-2" value={lineId} onChange={(event) => setLineId(event.target.value)}>
        <option value="">Select active test line</option>
        {lines.filter((line) => new Date(line.expires_at).getTime() > Date.now()).map((line) => <option key={line.id} value={line.id}>{line.username}</option>)}
      </select>
      <input aria-label="GitHub channel index" type="number" min={0} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-32 rounded border border-border bg-background p-2" />
      <Button disabled={!lineId || busy} onClick={run}>{busy ? "Checking…" : "Check playback"}</Button>
    </div>
    <video ref={videoRef} controls crossOrigin="anonymous" playsInline className="aspect-video w-full max-w-3xl bg-ink" />
    <pre aria-label="Playback result" className="overflow-auto whitespace-pre-wrap text-sm">{result ? JSON.stringify(result, null, 2) : ""}</pre>
  </section>;
}