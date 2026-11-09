import type { M3UChannel } from '@/lib/m3u';
import { playlistEmbed } from '@/lib/playlist-embed';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export function PlaylistEmbedPlayer({ channel, onClose }: { channel: M3UChannel; onClose: () => void }) {
  const embed = playlistEmbed(channel);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
      <DialogTitle className="pr-6 break-words">{channel.name}</DialogTitle>
      <DialogDescription>{channel.group_title ?? 'Movies & series'}</DialogDescription>
      {embed.url ? <>
        <iframe title={channel.name} src={embed.url} className="aspect-video w-full border-0 bg-ink" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Blocked or still loading? Open the player in a new tab.</p>
          <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
            <a href={embed.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open player in new tab</a>
          </Button>
        </div>
      </>
        : <p role="alert" className="text-sm text-destructive">{embed.reason}</p>}
    </DialogContent>
  </Dialog>;
}