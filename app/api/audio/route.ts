import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text");

  if (!text) {
    return NextResponse.json({ error: "Missing text parameter" }, { status: 400 });
  }

  const audioUrl = `https://text.pollinations.ai/audio/${encodeURIComponent(text)}`;
  
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error("Failed to fetch audio from Pollinations");

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return NextResponse.json({ error: "Failed to proxy audio" }, { status: 500 });
  }
}
