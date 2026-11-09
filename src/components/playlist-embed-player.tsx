import type { M3UChannel } from '@/lib/m3u';
import { playlistEmbed } from '@/lib/playlist-embed';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function PlaylistEmbedPlayer({ channel, onClose }: { channel: M3UChannel; onClose: () => void }) {
  const embed = playlistEmbed(channel);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto">
      <DialogTitle className="pr-6 break-words">{channel.name}</DialogTitle>
      <DialogDescription>{channel.group_title ?? 'Movies & series'}</DialogDescription>
      {embed.url ? <iframe title={channel.name} src={embed.url} className="aspect-video w-full border-0 bg-ink" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="no-referrer" />
        : <p role="alert" className="text-sm text-destructive">{embed.reason}</p>}
    </DialogContent>
  </Dialog>;
}