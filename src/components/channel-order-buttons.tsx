import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChannelOrderButtons({ name, canUp, canDown, busy, onMove }: {
  name: string; canUp: boolean; canDown: boolean; busy: boolean; onMove: (direction: -1 | 1) => void;
}) {
  return <div className="flex shrink-0 gap-4 md:gap-1">
    <Button type="button" variant="outline" size="icon" className="size-14 [&_svg]:size-6 md:size-11 md:[&_svg]:size-4" title={`Move up ${name}`} aria-label={`Move up ${name}`} disabled={busy || !canUp} onClick={() => onMove(-1)}><ArrowUp /></Button>
    <Button type="button" variant="outline" size="icon" className="size-14 [&_svg]:size-6 md:size-11 md:[&_svg]:size-4" title={`Move down ${name}`} aria-label={`Move down ${name}`} disabled={busy || !canDown} onClick={() => onMove(1)}><ArrowDown /></Button>
  </div>;
}