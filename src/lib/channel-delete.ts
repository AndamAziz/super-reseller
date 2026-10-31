// Shared client logic for deleting a channel from an uploaded playlist.
// Used by the channel card (mobile) and the edit dialog (ChannelLinksDialog).
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errMsg } from "@/hooks/use-me";

export async function deleteChannelById(id: string, playlistId: string): Promise<void> {
  const { data, error } = await supabase
    .from("channels")
    .delete().eq("id", id).eq("playlist_id", playlistId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Channel could not be deleted");
  const { count } = await supabase.from("channels")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlistId);
  if (count != null) {
    const { error: countError } = await supabase.from("playlists")
      .update({ channel_count: count }).eq("id", playlistId);
    if (countError) throw countError;
  }
}

/** Wraps deleteChannelById with confirm, toasts and query refresh. Returns true when deleted. */
export function useDeleteChannel(playlistId: string, onDeleted?: () => void) {
  const qc = useQueryClient();
  return async function removeChannel(id: string, name: string) {
    if (!confirm(`Delete "${name}" from this playlist?`)) return false;
    try {
      await deleteChannelById(id, playlistId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["channels", playlistId] }),
        qc.invalidateQueries({ queryKey: ["playlists"] }),
      ]);
      toast.success("Channel deleted");
      onDeleted?.();
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    }
  };
}
