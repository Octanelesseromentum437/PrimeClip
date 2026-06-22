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
