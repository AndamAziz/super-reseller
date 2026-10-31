import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { channelLinksSchema } from "@/lib/channel-links";
import { errMsg } from "@/hooks/use-me";
import { inputCls } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Channel = { id: string; name: string; url: string; logo: string | null; group_title?: string | null; referrer?: string | null };

export function ChannelLinksDialog({ channel, playlistId, onClose }: {
  channel: Channel; playlistId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(channel.name);
  const [group, setGroup] = useState(channel.group_title ?? "");
  const [referrer, setReferrer] = useState(channel.referrer ?? "");
  const [url, setUrl] = useState(channel.url);
  const [logo, setLogo] = useState(channel.logo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = channelLinksSchema.safeParse({ name, group_title: group, referrer: referrer.trim(), url, logo: logo.trim() });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the URLs"); return; }
    setSaving(true); setError(null);
    try {
      const { data, error: updateError } = await supabase.from("channels")
        .update(parsed.data).eq("id", channel.id).eq("playlist_id", playlistId)
        .select("id").single();
      if (updateError) throw updateError;
      if (!data) throw new Error("Channel could not be saved");
      await qc.invalidateQueries({ queryKey: ["channels", playlistId] });
      toast.success("Channel saved");
      onClose();
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${channel.name}" from this playlist?`)) return;
    setSaving(true); setError(null);
    try {
      const { data, error: delError } = await supabase.from("channels")
        .delete().eq("id", channel.id).eq("playlist_id", playlistId).select("id");
      if (delError) throw delError;
      if (!data?.length) throw new Error("Channel could not be deleted");
      const { count } = await supabase.from("channels").select("id", { count: "exact", head: true }).eq("playlist_id", playlistId);
      if (count != null) await supabase.from("playlists").update({ channel_count: count }).eq("id", playlistId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["channels", playlistId] }),
        qc.invalidateQueries({ queryKey: ["playlists"] }),
      ]);
      toast.success("Channel deleted");
      onClose();
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(32rem,calc(100%-1.5rem))] overflow-y-auto p-4 sm:p-6">
      <DialogHeader className="text-left"><DialogTitle>Edit channel</DialogTitle>
        <DialogDescription className="break-words">{channel.name}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="grid gap-4">
        <label className="grid gap-2 text-sm">Channel name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} h-11 w-full min-w-0 text-base sm:text-[13px]`} />
        </label>
        <label className="grid gap-2 text-sm">Category
          <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Kurdish Channels" className={`${inputCls} h-11 w-full min-w-0 text-base sm:text-[13px]`} />
        </label>
        <label className="grid gap-2 text-sm">Stream URL
          <textarea required rows={3} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value.replace(/\s+/g, ""))} className={`${inputCls} w-full min-w-0 resize-none break-all font-mono text-base sm:text-[13px]`} />
        </label>
        <label className="grid gap-2 text-sm">Logo URL
          <div className="flex min-w-0 items-center gap-3">
            {logo.trim() ? <img src={logo.trim()} alt="" className="size-12 shrink-0 rounded-lg bg-muted object-contain" /> : <div className="size-12 shrink-0 rounded-lg bg-muted" />}
            <input type="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={logo} onChange={(e) => setLogo(e.target.value)} className={`${inputCls} h-11 w-full min-w-0 text-base sm:text-[13px]`} />
          </div>
        </label>
        <label className="grid gap-2 text-sm">Referer (optional)
          <input type="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="https://…" className={`${inputCls} h-11 w-full min-w-0 text-base sm:text-[13px]`} />
        </label>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button type="button" variant="destructive" className="col-span-2 h-11 sm:mr-auto sm:h-9" disabled={saving} onClick={remove}><Trash2 />Delete channel</Button>
          <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" className="h-11 sm:h-9" disabled={saving}><Save />{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}