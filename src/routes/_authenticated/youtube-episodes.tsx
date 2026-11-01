import { createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, Upload } from 'lucide-react';
import { AdminOnly } from '@/components/admin-only';
import { PageHeader } from '@/components/panel';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/youtube-episodes')({
  head: () => ({ meta: [
    { title: 'MP4 uploads — Kurdistan IPTV' },
    { name: 'description', content: 'Admin-only MP4 video upload management for Kurdistan IPTV.' },
    { property: 'og:title', content: 'MP4 uploads — Kurdistan IPTV' },
    { property: 'og:description', content: 'Admin-only MP4 video upload management for Kurdistan IPTV.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <AdminOnly><VideoUploads /></AdminOnly>,
});

function VideoUploads() {
  return <>
    <PageHeader eyebrow="Media · Admin" title="MP4 uploads" />
    <div role="alert" className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-y border-warn/30 bg-warn/10 px-4 py-5 text-warn">
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="font-semibold">Public video hosting is blocked</h2>
        <p lang="ckb" dir="rtl" className="mt-2 text-sm leading-7">بارکردن و لینکی پۆبلیک هێشتا چالاک نین؛ پێویستە خاوەن وۆرکسپەیس ڕێگە بە میوانداری پۆبلیک بدات.</p>
      </div>
    </div>
    <section className="border-y border-border bg-glass px-4 py-8 sm:px-6">
      <h2 className="font-display text-lg font-semibold">Video files</h2>
      <div className="mt-5">
        <Button disabled className="min-h-11"><Upload className="size-4" />Upload MP4 — unavailable</Button>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">No uploaded videos.</p>
    </section>
  </>;
}
