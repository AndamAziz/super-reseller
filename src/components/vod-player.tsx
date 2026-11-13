import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { vodEmbed, type VodEntry } from '@/lib/vod';

export function VodPlayer({ item, onClose }: { item: VodEntry; onClose: () => void }) {
  const url = vodEmbed(item);
  const [status, setStatus] = useState('Waiting for player');
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!item.source_url || !video) return;
    const element = video;
    const source = item.source_url;
    let disposed = false;
    let cleanup: (() => Promise<void>) | undefined;
    setStatus('Loading video');
    void (async () => {
      try {
        // Native MP4 playback does not require a separate CORS-enabled probe.
        if (new URL(source).pathname.endsWith('.mp4') || element.canPlayType('application/vnd.apple.mpegurl')) {
          element.src = source; element.load();
        } else {
          const { loadBrowserPlayback } = await import('@/lib/browser-playback');
          if (disposed) return;
          const engine = await loadBrowserPlayback(element, source);
          if (disposed) { await engine.destroy(); return; }
          cleanup = engine.destroy;
        }
        if (!disposed) setStatus('Ready to play');
      } catch (error) { if (!disposed) setStatus(`Video unavailable: ${error instanceof Error ? error.message : 'source failed'}. Use VidAPI fallback.`); }
    })();
    return () => { disposed = true; void cleanup?.(); element.pause(); element.removeAttribute('src'); element.load(); };
  }, [item.source_url, video]);
  useEffect(() => {
    if (item.source_url) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== new URL(url).origin || event.source !== document.querySelector<HTMLIFrameElement>('[data-vod-player]')?.contentWindow || event.data?.type !== 'PLAYER_EVENT') return;
      const state = event.data?.data?.player_status;
      if (typeof state === 'string') setStatus(state === 'playing' ? 'Playback confirmed by provider' : `Player: ${state}`);
    };
    window.addEventListener('message', receive);
    const timer = window.setTimeout(() => setStatus(s => s === 'Waiting for player' ? 'Playback not confirmed. Use the fallback if blocked.' : s), 15000);
    return () => { window.removeEventListener('message', receive); window.clearTimeout(timer); };
  }, [url, item.source_url]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
    <DialogTitle className="pr-6 break-words">{item.title}</DialogTitle><DialogDescription>VidAPI · {item.media_type === 'tv' ? `Season ${item.season} · Episode ${item.episode}` : 'Movie'}</DialogDescription>
    {item.source_url ? <video ref={setVideo} aria-label={item.title} controls playsInline className="aspect-video w-full bg-ink" onPlaying={() => setStatus('Playing')} onError={() => setStatus('Video source or codec unavailable. Use VidAPI fallback.')} /> : <iframe data-vod-player title={item.title} src={url} className="aspect-video w-full border-0 bg-ink" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{status}</p><Button asChild variant="outline" className="min-h-11 w-full sm:w-auto"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink />Open player in new tab</a></Button></div>
  </DialogContent></Dialog>;
}