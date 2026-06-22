export type ProviderKind =
  | "ollama"
  | "claude"
  | "openai"
  | "openrouter"
  | "gemini"
  | "custom";

export interface ProviderConfig {
  kind: ProviderKind;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
  extra_headers?: Record<string, string>;
}

export interface ProviderDescriptor {
  kind: ProviderKind;
  display_name: string;
  requires_api_key: boolean;
  default_model: string;
  models: string[];
  configured: boolean;
}

export interface UploadResponse {
  video_id: string;
  filename: string;
  duration_sec: number;
}

export interface VideoSummary {
  id: string;
  filename: string;
  duration_sec: number;
  created_at: string;
  latest_job_status: string | null;
  latest_job_id: string | null;
  clip_count: number;
  source_resolution: string | null;
}

export interface VideoDetail extends VideoSummary {
  source_path: string;
  language: string | null;
  job_count: number;
}

export interface JobStatus {
  id: string;
  video_id: string;
  status: string;
  progress_pct: number;
  current_stage: string | null;
  error_message: string | null;
}

export interface ClipRecord {
  id: string;
  index: number;
  title: string;
  start_sec: number;
  end_sec: number;
  score: number;
  reason: string;
  status: string;
  output_path: string | null;
  thumbnail_path: string | null;
}

export type CaptionStyleName = "classic" | "podcast" | "reels" | "minimal";

export interface CaptionStyle {
  font_family: string;
  font_size: number;
  primary_color: string;
  outline_color: string;
  outline_width: number;
  alignment: number;
  margin_v: number;
  words_per_screen: number;
  bold: boolean;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface CaptionEditResponse {
  clip_id: string;
  cues: CaptionCue[];
  style: CaptionStyle;
  preset: CaptionStyleName | null;
  timeline: TimelineState;
}

export interface VideoTrim {
  start: number;
  end: number | null;
}

/** Timeline position and source offset for the main clip audio (J-cuts, L-cuts, audio-only). */
export interface VideoAudioTrim {
  start: number;
  end: number | null;
  source_start: number;
  volume: number;
}

export interface OverlayItem {
  id: string;
  kind: "image" | "broll";
  start: number;
  end: number;
  asset: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  volume: number;
}

export interface AudioItem {
  id: string;
  start: number;
  end: number;
  asset: string;
  label: string;
  volume: number;
  source_offset: number;
  fade_in: number;
  fade_out: number;
}

export interface TimelineState {
  trim: VideoTrim;
  audio_trim: VideoAudioTrim;
  overlays: OverlayItem[];
  audio: AudioItem[];
}

export type EditorSelection =
  | { type: "video" }
  | { type: "video-audio" }
  | { type: "caption"; index: number }
  | { type: "overlay"; id: string }
  | { type: "audio"; id: string };

export interface MediaUploadResponse {
  asset: string;
  label: string;
  url: string;
}

export interface DependencyStatus {
  name: string;
  ok: boolean;
  path?: string | null;
  message?: string | null;
  install_url?: string | null;
}

export interface HealthResponse {
  status: string;
  bundle_profile: string;
  dependencies: {
    ffmpeg: DependencyStatus;
    whisper_model: DependencyStatus;
    ollama: DependencyStatus;
  };
}

export interface AppPreferences {
  default_provider_kind: ProviderKind;
  default_model: string;
  ollama_base_url: string;
}
