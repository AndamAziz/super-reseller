import { useState } from 'react';
import { Image } from 'lucide-react';

export function EpisodePoster({ url, title }: { url?: string | null; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return url && failedUrl !== url ? <img src={url} alt={title} loading="lazy" className="aspect-video w-full object-contain bg-muted" onError={() => setFailedUrl(url)} /> : <div role="img" aria-label={`Poster unavailable: ${title}`} className="grid aspect-video place-items-center bg-muted"><Image className="size-8 text-muted-foreground" /></div>;
}