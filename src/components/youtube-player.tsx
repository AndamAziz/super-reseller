import { useEffect, useRef, useState } from 'react';
import { youtubePlayerError } from '@/lib/youtube';
import { Button } from '@/components/ui/button';

type EmbeddedPlayer = { destroy: () => void };
type YoutubeWindow = Window & { YT?: { Player: new (frame: HTMLIFrameElement, options: { events: { onError: (event: { data: number }) => void } }) => EmbeddedPlayer } };

export function YoutubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    setError(null);
  }, [videoId]);
  useEffect(() => {
    if (!origin) return;
    let player: EmbeddedPlayer | undefined;
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true; document.head.appendChild(script);
    }
    const deadline = Date.now() + 15000;
    const timer = window.setInterval(() => {
      const api = (window as YoutubeWindow).YT;
      if (api?.Player && ref.current) {
        window.clearInterval(timer);
        player = new api.Player(ref.current, { events: { onError: event => setError(youtubePlayerError(event.data)) } });
      } else if (Date.now() >= deadline) {
        window.clearInterval(timer);
        setError('YouTube could not load. Check your connection or open the video on YouTube.');
      }
    }, 100);
    return () => { window.clearInterval(timer); player?.destroy(); };
  }, [origin, videoId]);
  return <div className="space-y-3">
    {origin && <iframe ref={ref} title={title} className="aspect-video min-h-[200px] w-full border-0" src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button asChild variant="outline" size="sm"><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></Button>
  </div>;
}