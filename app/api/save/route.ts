import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { scenes, projectName } = await request.json();

    if (!scenes || !projectName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updatedScenes = await Promise.all(
      scenes.map(async (scene: any) => {
        // Fetch image from Pollinations
        const response = await fetch(scene.image_url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${scene.image_url}`);
        
        const blob = await response.blob();
        const filename = `zyntros/${projectName}/scene-${scene.scene_id}-${Date.now()}.png`;
        
        // Upload to Vercel Blob
        const { url } = await put(filename, blob, {
          access: "public",
          addRandomSuffix: true,
        });

        return {
          ...scene,
          image_url: url, // Replace with permanent Blob URL
        };
      })
    );

    return NextResponse.json({ scenes: updatedScenes });
  } catch (error) {
    console.error("Error saving images to blob:", error);
    return NextResponse.json({ error: "Failed to process images" }, { status: 500 });
  }
}
