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
  
  const response = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate the Zyntros JSON for this story: ${story}. Remember: ONLY JSON.` }
      ],
      model: "openai",
      jsonMode: true
    }),
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.statusText}`);
  }

  const rawText = await response.text();
  let jsonString = rawText;
  
  try {
    const parsedResponse = JSON.parse(rawText);
    if (parsedResponse.content) {
      jsonString = parsedResponse.content;
    } else if (parsedResponse.choices?.[0]?.message?.content) {
      jsonString = parsedResponse.choices[0].message.content;
    } else if (parsedResponse.reasoning_content && !parsedResponse.content) {
      jsonString = parsedResponse.reasoning_content;
    }
  } catch (e) {
    jsonString = rawText;
  }

  try {
    let cleanJson = jsonString;
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      const potentialBlocks = [];
      let searchPos = 0;
      while (true) {
        const start = jsonString.indexOf('{', searchPos);
        if (start === -1) break;
        
        let depth = 0;
        let end = -1;
        for (let i = start; i < jsonString.length; i++) {
          if (jsonString[i] === '{') depth++;
          else if (jsonString[i] === '}') depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
        
        if (end !== -1) {
          potentialBlocks.push(jsonString.substring(start, end + 1));
          searchPos = end + 1;
        } else {
          break;
        }
      }
      
      const validBlock = potentialBlocks.find(b => b.includes('"project_title"') && b.includes('"scenes"'));
      if (validBlock) {
        cleanJson = validBlock;
      } else {
        cleanJson = jsonString.substring(firstBrace, lastBrace + 1);
      }
    }

    const project = JSON.parse(cleanJson.replace(/```json|```/g, "").trim()) as VideoProject;
    
    project.seed = projectSeed;

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
    console.error("Failed to parse JSON from Pollinations. Raw:", rawText);
    throw new Error("The AI engine failed to generate a valid project structure. Please try a different story or try again.");
  }
}
