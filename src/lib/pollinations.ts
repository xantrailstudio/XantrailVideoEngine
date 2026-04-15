import { VideoProject } from "../types";

const SYSTEM_PROMPT = `You are the "Xantrail Video Engine" Director. Your job is to take a story input from the user and convert it into a strictly structured JSON format that drives a video production pipeline.

### YOUR RULES:
1. OUTPUT ONLY JSON. No conversational text, no markdown code blocks.
2. BREAK THE STORY into logical scenes.
3. VISUAL ANCHOR SYSTEM: 
   - First, define a "visual_anchor" string that describes the main character's consistent appearance (e.g., "A young woman with neon blue bob hair, wearing a silver reflective jacket and a glowing visor").
   - Every "image_description" in the "scenes" array MUST start with this visual anchor to maintain character consistency.
4. Each scene must have a vivid visual description and a narration script.

### THE JSON STRUCTURE:
{
  "project_title": "String",
  "visual_anchor": "String describing consistent character traits",
  "total_scenes": Number,
  "scenes": [
    {
      "scene_id": 1,
      "image_description": "Visual Anchor + specific scene action/setting",
      "voiceover_text": "The narration script",
      "duration_seconds": 3
    }
  ]
}

### CRITICAL INSTRUCTIONS:
- Keep the voiceover_text short enough to be spoken clearly (about 10-15 words).
- DO NOT include any markdown formatting like \`\`\`json. Just raw JSON.`;

export async function generateVideoProject(story: string): Promise<VideoProject> {
  const projectSeed = Math.floor(Math.random() * 1000000);
  
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Story: ${story}` }
      ],
      model: "openai",
      jsonMode: true
    }),
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.statusText}`);
  }

  const text = await response.text();
  
  try {
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const project = JSON.parse(cleanJson) as VideoProject;
    
    project.seed = projectSeed;

    // Post-process to ensure URLs are correctly encoded and include the seed
    project.scenes = project.scenes.map(scene => {
      const fullPrompt = `${scene.image_description}, cinematic lighting, 8k, hyper-realistic`;
      const encodedDesc = encodeURIComponent(fullPrompt);
      const encodedVO = encodeURIComponent(scene.voiceover_text);
      
      return {
        ...scene,
        image_url: `https://image.pollinations.ai/prompt/${encodedDesc}?width=1280&height=720&model=flux&seed=${projectSeed}&nologo=true`,
        voiceover_audio_url: `https://text.pollinations.ai/audio/${encodedVO}`,
        duration_seconds: scene.duration_seconds || 3
      };
    });

    return project;
  } catch (e) {
    console.error("Failed to parse JSON from Pollinations:", text);
    throw new Error("The AI engine returned an invalid response format. Please try again.");
  }
}
