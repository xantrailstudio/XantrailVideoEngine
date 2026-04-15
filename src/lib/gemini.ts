import { GoogleGenAI, Type } from "@google/genai";
import { VideoProject } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You are the "Xantrail Video Engine" Director. Your job is to take a story input from the user and convert it into a strictly structured JSON format that drives a video production pipeline.

### YOUR RULES:
1. OUTPUT ONLY JSON. No conversational text, no "Here is your story," and no markdown code blocks.
2. BREAK THE STORY into 3-second scenes. 
3. Each scene must have a visual description (for Flux) and a narration script.
4. Use the following Pollinations.ai URL patterns to generate direct links for the assets.

### THE JSON STRUCTURE:
{
  "project_title": "String",
  "total_scenes": Number,
  "scenes": [
    {
      "scene_id": 1,
      "image_description": "A highly detailed cinematic prompt for Flux model",
      "image_url": "https://image.pollinations.ai/prompt/[encoded_description]?width=1280&height=720&model=flux&nologo=true",
      "voiceover_text": "The 3-second narration script",
      "voiceover_audio_url": "https://text.pollinations.ai/audio/[encoded_voiceover_text]",
      "duration_seconds": 3
    }
  ]
}

### CRITICAL INSTRUCTIONS:
- For [encoded_description] and [encoded_voiceover_text], you MUST replace spaces with %20 and ensure other special characters are URL-safe.
- Ensure the image_description is vivid and artistic (e.g., 'Cinematic lighting, 8k, Unreal Engine 5 style, hyper-realistic, masterpiece').
- Keep the voiceover_text short enough to be spoken in exactly 3 seconds (about 10-12 words max).`;

export async function generateVideoProject(story: string): Promise<VideoProject> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Story: ${story}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          project_title: { type: Type.STRING },
          total_scenes: { type: Type.NUMBER },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scene_id: { type: Type.NUMBER },
                image_description: { type: Type.STRING },
                image_url: { type: Type.STRING },
                voiceover_text: { type: Type.STRING },
                voiceover_audio_url: { type: Type.STRING },
                duration_seconds: { type: Type.NUMBER },
              },
              required: ["scene_id", "image_description", "image_url", "voiceover_text", "voiceover_audio_url", "duration_seconds"],
            },
          },
        },
        required: ["project_title", "total_scenes", "scenes"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  try {
    const project = JSON.parse(text) as VideoProject;
    
    // Post-process to ensure URLs are correctly encoded if the AI missed it
    project.scenes = project.scenes.map(scene => {
      const encodedDesc = encodeURIComponent(scene.image_description);
      const encodedVO = encodeURIComponent(scene.voiceover_text);
      
      return {
        ...scene,
        image_url: `https://image.pollinations.ai/prompt/${encodedDesc}?width=1280&height=720&model=flux&nologo=true`,
        voiceover_audio_url: `https://text.pollinations.ai/audio/${encodedVO}`
      };
    });

    return project;
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw new Error("Invalid JSON response from AI engine. Please try again.");
  }
}
