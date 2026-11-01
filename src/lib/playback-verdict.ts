export type PlaybackEvidence = { secondsAdvanced: number; frames: number; width: number; audioPeak: number; error: string | null; expectsVideo: boolean; expectsAudio: boolean };
export function playbackVerdict(evidence: PlaybackEvidence) {
  const videoDecoded = evidence.frames > 0 && evidence.width > 0;
  const audioSignal = evidence.audioPeak > 0.001;
  const progressing = evidence.secondsAdvanced >= 5;
  return { videoDecoded, audioSignal, progressing, ok: !evidence.error && progressing && (!evidence.expectsVideo || videoDecoded) && (!evidence.expectsAudio || audioSignal) };
}