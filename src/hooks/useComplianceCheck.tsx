import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ComplianceResult {
  rule_id: string;
  status: 'pass' | 'warning' | 'fail';
  /** Legacy field — use `status` instead */
  passed?: boolean;
  reason: string;
  excerpt?: string;
  timestamps?: { start: number; end: number }[];
}

interface ComplianceCheckParams {
  content_type: 'email' | 'image' | 'video';
  content?: {
    subject?: string;
    body?: string;
    terms?: string;
    header_image_url?: string;
  };
  file_url?: string;
  frame_urls?: string[];
  video_duration?: number;
  rules: { id: string; label: string; description: string }[];
}

export function useComplianceCheck() {
  return useMutation({
    mutationFn: async (params: ComplianceCheckParams): Promise<{ id?: string; results: ComplianceResult[]; overall_status: string }> => {
      const { data, error } = await supabase.functions.invoke('compliance-check', {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}

export async function uploadComplianceFile(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('compliance-uploads')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data: signedData, error: signedError } = await supabase.storage
    .from('compliance-uploads')
    .createSignedUrl(filePath, 3600);

  if (signedError) throw signedError;
  return signedData.signedUrl;
}

/**
 * Extract frames from a video at 1 frame per second (capped at 30 frames).
 * Returns an array of { timestamp, dataUrl } objects.
 * Accepts an optional onProgress callback reporting (currentFrame, totalFrames).
 */
export function extractVideoFrames(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ timestamp: number; dataUrl: string }[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!duration || duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read video duration'));
        return;
      }

      // 1 frame per second, capped at 60
      const numFrames = Math.min(Math.ceil(duration), 60);
      const interval = duration / numFrames;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const frames: { timestamp: number; dataUrl: string }[] = [];
      let currentIndex = 0;

      const captureFrame = () => {
        canvas.width = Math.min(video.videoWidth, 1280);
        canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const timestamp = Math.round(video.currentTime * 10) / 10;
        frames.push({
          timestamp,
          dataUrl: canvas.toDataURL('image/jpeg', 0.8),
        });

        currentIndex++;
        onProgress?.(currentIndex, numFrames);

        if (currentIndex < numFrames) {
          video.currentTime = interval * currentIndex;
        } else {
          URL.revokeObjectURL(url);
          resolve(frames);
        }
      };

      video.onseeked = captureFrame;
      video.currentTime = 0;
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };
  });
}
