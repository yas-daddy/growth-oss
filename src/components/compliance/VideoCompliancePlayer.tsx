import { useRef, useState, useEffect, useCallback } from 'react';
import { ComplianceResult } from '@/hooks/useComplianceCheck';

interface VideoCompliancePlayerProps {
  videoUrl: string;
  duration: number;
  results: ComplianceResult[];
  activeResultId?: string | null;
  onSeek?: (time: number) => void;
}

function getResultStatus(r: any): 'pass' | 'warning' | 'fail' {
  if (r.status) return r.status;
  return r.passed ? 'pass' : 'fail';
}

export function VideoCompliancePlayer({
  videoUrl,
  duration,
  results,
  activeResultId,
  onSeek,
}: VideoCompliancePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      video.play().catch(() => {});
    }
  }, []);

  // Expose seekTo via activeResultId changes
  useEffect(() => {
    if (!activeResultId) return;
    const result = results.find((r) => r.rule_id === activeResultId);
    if (result?.timestamps?.length) {
      seekTo(result.timestamps[0].start);
    }
  }, [activeResultId, results, seekTo]);

  const effectiveDuration = videoDuration || duration || 1;

  // Collect all timeline segments
  const segments: { start: number; end: number; status: 'warning' | 'fail' }[] = [];
  for (const r of results) {
    const status = getResultStatus(r);
    if ((status === 'warning' || status === 'fail') && r.timestamps?.length) {
      for (const ts of r.timestamps) {
        segments.push({ start: ts.start, end: ts.end, status });
      }
    }
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const time = ratio * effectiveDuration;
    seekTo(time);
    onSeek?.(time);
  };

  const playheadPercent = (currentTime / effectiveDuration) * 100;

  return (
    <div className="space-y-2">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full max-h-[480px] rounded-lg border bg-black object-contain"
        preload="auto"
      />

      {/* Compliance timeline bar */}
      <div
        className="relative h-6 bg-muted rounded cursor-pointer border"
        onClick={handleTimelineClick}
        title="Click to seek"
      >
        {/* Warning segments (rendered first, below fail) */}
        {segments
          .filter((s) => s.status === 'warning')
          .map((seg, i) => (
            <div
              key={`w-${i}`}
              className="absolute top-0 bottom-0 bg-amber-500/40 rounded-sm"
              style={{
                left: `${(seg.start / effectiveDuration) * 100}%`,
                width: `${((seg.end - seg.start) / effectiveDuration) * 100}%`,
              }}
            />
          ))}

        {/* Fail segments (rendered on top) */}
        {segments
          .filter((s) => s.status === 'fail')
          .map((seg, i) => (
            <div
              key={`f-${i}`}
              className="absolute top-0 bottom-0 bg-destructive/50 rounded-sm"
              style={{
                left: `${(seg.start / effectiveDuration) * 100}%`,
                width: `${((seg.end - seg.start) / effectiveDuration) * 100}%`,
              }}
            />
          ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
          style={{ left: `${playheadPercent}%` }}
        />

        {/* Time labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
          {formatTime(currentTime)}
        </span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">
          {formatTime(effectiveDuration)}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {segments.some((s) => s.status === 'warning') && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-amber-500/40" /> Warning
          </span>
        )}
        {segments.some((s) => s.status === 'fail') && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded-sm bg-destructive/50" /> Fail
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
