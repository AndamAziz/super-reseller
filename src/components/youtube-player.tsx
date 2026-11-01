import { useEffect, useRef, useState } from 'react';
import { youtubePlayerError } from '@/lib/youtube';
import { Button } from '@/components/ui/button';

export function YoutubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(window.location.origin);
    setError(null);
    const listener = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com' || event.source !== ref.current?.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onError') setError(youtubePlayerError(Number(data.info)));
      } catch { /* Ignore unrelated player messages. */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [videoId]);
  function subscribe() {
    const target = ref.current?.contentWindow;
    target?.postMessage(JSON.stringify({ event: 'listening', id: videoId }), 'https://www.youtube.com');
    target?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onError'] }), 'https://www.youtube.com');
  }
  return <div className="space-y-3">
    {origin && <iframe ref={ref} onLoad={subscribe} title={title} className="aspect-video min-h-[200px] w-full border-0" src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(origin)}&playsinline=1`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button asChild variant="outline" size="sm"><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></Button>
  </div>;
}