export interface Scene {
  scene_id: number;
  image_description: string;
  image_url: string;
  voiceover_text: string;
  voiceover_audio_url: string;
  duration_seconds: number;
}

export interface VideoProject {
  project_title: string;
  total_scenes: number;
  scenes: Scene[];
  seed: number;
  visual_anchor: string;
  story: string;
}
