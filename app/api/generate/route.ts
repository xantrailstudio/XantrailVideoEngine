import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  try {
    const { story } = await request.json();

    if (!story) {
      return NextResponse.json({ error: "Missing story" }, { status: 400 });
    }

    const response = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      }
    } catch (e) {
      jsonString = rawText;
    }

    // Basic cleaning
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    return NextResponse.json(JSON.parse(jsonString));
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json({ error: "Failed to generate project" }, { status: 500 });
  }
}
