import { VideoProject } from "../types";

const SYSTEM_PROMPT = `You are the "Zyntros" Director. Your job is to take a story input from the user and convert it into a strictly structured JSON format that drives a video production pipeline.

### YOUR RULES:
1. OUTPUT ONLY THE RAW JSON OBJECT. 
2. DO NOT INCLUDE ANY REASONING, EXPLANATIONS, OR CONVERSATIONAL TEXT.
3. DO NOT USE MARKDOWN CODE BLOCKS.
4. BREAK THE STORY into logical scenes.
5. VISUAL ANCHOR SYSTEM: 
   - First, define a "visual_anchor" string that describes the main character's consistent appearance.
   - Every "image_description" in the "scenes" array MUST start with this visual anchor.

### THE JSON STRUCTURE:
{
  "project_title": "String",
  "visual_anchor": "String describing consistent character traits",
  "total_scenes": Number,
  "scenes": [
    {
      "scene_id": 1,
      "image_description": "Visual Anchor + specific scene action/setting",
      "voiceover_text": "The narration script (10-15 words)",
      "duration_seconds": 3
    }
  ]
}

### CRITICAL:
If you include any text other than the JSON object, the system will fail. Start your response with "{" and end it with "}".`;

export async function generateVideoProject(story: string): Promise<VideoProject> {
  const projectSeed = Math.floor(Math.random() * 1000000);
  
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ story }),
  });

  if (!response.ok) {
    throw new Error(`Generation error: ${response.statusText}`);
  }

  const project = await response.json() as VideoProject;
  
  project.seed = projectSeed;
  project.story = story;

  project.scenes = project.scenes.map(scene => {
    const fullPrompt = `${scene.image_description}, cinematic lighting, 8k, hyper-realistic`;
    const encodedDesc = encodeURIComponent(fullPrompt);
    
    return {
      ...scene,
      image_url: `https://image.pollinations.ai/prompt/${encodedDesc}?width=1280&height=720&model=flux&seed=${projectSeed}&nologo=true`,
      voiceover_audio_url: `/api/audio?text=${encodeURIComponent(scene.voiceover_text)}`,
      duration_seconds: scene.duration_seconds || 3
    };
  });

  return project;
}
