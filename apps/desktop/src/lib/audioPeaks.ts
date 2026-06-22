export interface AudioPeaksData {
  peaks: Float32Array;
  duration: number;
}

const peaksCache = new Map<string, AudioPeaksData>();

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function mergeChannels(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const merged = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      merged[i] += data[i];
    }
  }
  const scale = 1 / buffer.numberOfChannels;
  for (let i = 0; i < length; i++) merged[i] *= scale;
  return merged;
}

export function computePeaks(samples: Float32Array, targetSamples: number): Float32Array {
  const count = Math.max(1, targetSamples);
  const blockSize = Math.max(1, Math.floor(samples.length / count));
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, samples.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j]!);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

export function slicePeaks(
  peaks: Float32Array,
  sourceDuration: number,
  sourceStart: number,
  sourceEnd: number,
): Float32Array {
  if (sourceDuration <= 0 || peaks.length === 0) return peaks;
  const start = Math.max(0, sourceStart);
  const end = Math.min(sourceDuration, Math.max(start + 0.01, sourceEnd));
  const startIdx = Math.floor((start / sourceDuration) * peaks.length);
  const endIdx = Math.max(startIdx + 1, Math.ceil((end / sourceDuration) * peaks.length));
  return peaks.slice(startIdx, endIdx);
}

export async function loadAudioPeaks(url: string, targetSamples = 800): Promise<AudioPeaksData> {
  const cached = peaksCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }

  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const channel =
    audioBuffer.numberOfChannels > 1
      ? mergeChannels(audioBuffer)
      : audioBuffer.getChannelData(0);

  const peaks = computePeaks(channel, targetSamples);
  const data: AudioPeaksData = { peaks, duration: audioBuffer.duration };
  peaksCache.set(url, data);
  return data;
}

export function clearAudioPeaksCache(): void {
  peaksCache.clear();
}
