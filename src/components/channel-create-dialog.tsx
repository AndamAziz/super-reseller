import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createManualChannel, parseManualEntry } from "@/lib/channel-create";
import { buildM3U } from "@/lib/m3u";
import { errMsg } from "@/hooks/use-me";
import { inputCls } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ChannelCreateDialog({ playlistId, playlistName, initialType, onClose, onAdded }: {
  playlistId: string; playlistName: string; initialType: "live" | "movie" | "series";
  onClose: () => void; onAdded: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("fields");
  const [fields, setFields] = useState({ name: "", group_title: "", url: "", logo: "", referrer: "", user_agent: "", type: initialType });
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let preview = "";
  try { preview = buildM3U([mode === "raw" ? parseManualEntry(raw) : createManualChannel(fields)]); } catch { /* incomplete input */ }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const channel = mode === "raw" ? parseManualEntry(raw) : createManualChannel(fields);
      setSaving(true);
      const { data: last, error: positionError } = await supabase.from("channels").select("position").eq("playlist_id", playlistId).order("position", { ascending: false }).limit(1);
      if (positionError) throw positionError;
      const { error: insertError } = await supabase.from("channels").insert({ ...channel,
        playlist_id: playlistId, position: (last?.[0]?.position ?? -1) + 1,
        m3u_metadata: JSON.parse(JSON.stringify(channel.m3u_metadata)),
      });
      if (insertError) throw insertError;
      // The channel is already saved: a count refresh must never cause duplicate retries.
      const { count, error: countError } = await supabase.from("channels").select("id", { count: "exact", head: true }).eq("playlist_id", playlistId);
      if (!countError && count !== null) await supabase.from("playlists").update({ channel_count: count }).eq("id", playlistId);
      await Promise.all([qc.invalidateQueries({ queryKey: ["channels", playlistId] }), qc.invalidateQueries({ queryKey: ["playlists"] })]);
      toast.success("Channel added");
      onAdded(); onClose();
    } catch (e) { setError(errMsg(e)); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(36rem,calc(100%-1.5rem))] overflow-y-auto p-4 sm:p-6">
      <DialogHeader className="text-left"><DialogTitle>Add channel</DialogTitle><DialogDescription className="break-words">{playlistName}</DialogDescription></DialogHeader>
      <Tabs value={mode} onValueChange={setMode}><TabsList className="w-full"><TabsTrigger value="fields" className="flex-1">Details</TabsTrigger><TabsTrigger value="raw" className="flex-1">M3U entry</TabsTrigger></TabsList></Tabs>
      <form onSubmit={save} className="grid gap-4">
        {mode === "raw" ? <label className="grid gap-2 text-sm">M3U entry<textarea aria-label="M3U entry" required rows={9} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'#EXTINF:-1 tvg-type="movie" group-title="Movies",Movie name\nhttps://…/movie.mp4'} className={`${inputCls} w-full min-w-0 font-mono text-sm`} /></label> : <>
          <Tabs value={fields.type} onValueChange={(value) => { if (value === "live" || value === "movie" || value === "series") setFields((f) => ({ ...f, type: value })); }}>
            <TabsList className="w-full">{([['live', 'Live TV'], ['movie', 'Movie'], ['series', 'Series']] as const).map(([value, label]) => <TabsTrigger key={value} value={value} className="flex-1">{label}</TabsTrigger>)}</TabsList>
          </Tabs>
          {([['name', 'Channel name'], ['group_title', 'Category'], ['url', 'Stream URL'], ['logo', 'Logo URL'], ['referrer', 'Referer (optional)'], ['user_agent', 'User-Agent (optional)']] as const).map(([key, label]) => <label key={key} className="grid gap-2 text-sm">{label}<input required={key === 'name' || key === 'url'} value={fields[key]} onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))} className={`${inputCls} h-11 w-full min-w-0 text-base sm:text-sm`} /></label>)}
        </>}
        {preview && <pre aria-label="New M3U preview" className="max-h-32 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">{preview}</pre>}
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}><Plus />{saving ? "Saving…" : "Add channel"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}