import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ComplianceResult, extractVideoFrames } from '@/hooks/useComplianceCheck';
import { ComplianceRule } from '@/hooks/useComplianceRules';

export interface MediaComplianceState {
  status: 'pending' | 'checking' | 'done' | 'error';
  score?: number;
  results?: ComplianceResult[];
  error?: string;
}

function getResultStatus(r: ComplianceResult): 'pass' | 'warning' | 'fail' {
  if (r.status) return r.status;
  return r.passed ? 'pass' : 'fail';
}

function calcScore(results: ComplianceResult[]): number {
  if (results.length === 0) return 100;
  const points = results.reduce((sum, r) => {
    const s = getResultStatus(r);
    return sum + (s === 'pass' ? 1 : s === 'warning' ? 0.5 : 0);
  }, 0);
  return Math.round((points / results.length) * 100);
}

interface MediaFile {
  file?: File;
  type: 'image' | 'video';
  uploadStatus?: string;
  storageUrl?: string;
  sourceInstagramMediaId?: string;
}

export function useMediaComplianceCheck(
  mediaFiles: MediaFile[],
  rules: ComplianceRule[] | undefined,
) {
  const [states, setStates] = useState<Map<number, MediaComplianceState>>(new Map());
  const checkedRef = useRef<Set<string>>(new Set());

  // Track which indices we've already triggered checks for
  useEffect(() => {
    if (!rules || rules.length === 0) return;

    const enabledRules = rules.filter(r => r.enabled);
    if (enabledRules.length === 0) return;

    mediaFiles.forEach((media, index) => {
      // Skip existing Instagram posts
      if (media.sourceInstagramMediaId) return;
      // Only check uploaded media
      if (media.uploadStatus !== 'uploaded') return;
      // Skip if already checked this URL
      const key = `${index}:${media.storageUrl}`;
      if (checkedRef.current.has(key)) return;
      checkedRef.current.add(key);

      // Start check
      setStates(prev => {
        const next = new Map(prev);
        next.set(index, { status: 'checking' });
        return next;
      });

      runCheck(media, index, enabledRules);
    });
  }, [mediaFiles, rules]);

  // Clean up states for removed media
  useEffect(() => {
    setStates(prev => {
      const next = new Map(prev);
      let changed = false;
      for (const idx of next.keys()) {
        if (idx >= mediaFiles.length) {
          next.delete(idx);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [mediaFiles.length]);

  const runCheck = useCallback(async (
    media: MediaFile,
    index: number,
    enabledRules: ComplianceRule[],
  ) => {
    try {
      const rulePayload = enabledRules.map(r => ({
        id: r.id,
        label: r.label,
        description: r.description,
      }));

      let body: Record<string, unknown>;

      if (media.type === 'image') {
        const imageRules = enabledRules.filter(r =>
          r.content_types.includes('image')
        );
        if (imageRules.length === 0) {
          setStates(prev => {
            const next = new Map(prev);
            next.set(index, { status: 'done', score: 100, results: [] });
            return next;
          });
          return;
        }
        body = {
          content_type: 'image',
          file_url: media.storageUrl,
          rules: imageRules.map(r => ({ id: r.id, label: r.label, description: r.description })),
        };
      } else {
        // Video – extract frames
        const videoRules = enabledRules.filter(r =>
          r.content_types.includes('video')
        );
        if (videoRules.length === 0) {
          setStates(prev => {
            const next = new Map(prev);
            next.set(index, { status: 'done', score: 100, results: [] });
            return next;
          });
          return;
        }

        // Resolve a usable File for frame extraction
        let videoFile = media.file;
        if ((!videoFile || videoFile.size === 0) && media.storageUrl) {
          // Library item with no real file – fetch the video blob
          const resp = await fetch(media.storageUrl);
          const blob = await resp.blob();
          const name = media.storageUrl.split('/').pop() || 'video.mp4';
          videoFile = new File([blob], name, { type: blob.type || 'video/mp4' });
        }

        if (!videoFile || videoFile.size === 0) {
          setStates(prev => {
            const next = new Map(prev);
            next.set(index, { status: 'done', score: 100, results: [] });
            return next;
          });
          return;
        }

        const frames = await extractVideoFrames(videoFile);
        body = {
          content_type: 'video',
          frame_urls: frames.map(f => f.dataUrl),
          video_duration: frames.length > 0 ? frames[frames.length - 1].timestamp : 0,
          rules: videoRules.map(r => ({ id: r.id, label: r.label, description: r.description })),
        };
      }

      const { data, error } = await supabase.functions.invoke('compliance-check', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results: ComplianceResult[] = data.results || [];
      const score = calcScore(results);

      setStates(prev => {
        const next = new Map(prev);
        next.set(index, { status: 'done', score, results });
        return next;
      });
    } catch (err) {
      setStates(prev => {
        const next = new Map(prev);
        next.set(index, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Check failed',
        });
        return next;
      });
    }
  }, []);

  const getComplianceForIndex = useCallback((index: number): MediaComplianceState | undefined => {
    return states.get(index);
  }, [states]);

  const retryCheck = useCallback((index: number) => {
    if (!rules) return;
    const media = mediaFiles[index];
    if (!media) return;

    // Remove from checked set so it re-runs
    for (const key of checkedRef.current) {
      if (key.startsWith(`${index}:`)) {
        checkedRef.current.delete(key);
      }
    }

    const enabledRules = rules.filter(r => r.enabled);
    setStates(prev => {
      const next = new Map(prev);
      next.set(index, { status: 'checking' });
      return next;
    });
    runCheck(media, index, enabledRules);
  }, [mediaFiles, rules, runCheck]);

  return { complianceStates: states, getComplianceForIndex, retryCheck };
}
