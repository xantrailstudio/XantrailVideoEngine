import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Proxy for Pollinations Text/JSON
  app.post("/api/pollinations", async (req, res) => {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "POLLINATIONS_API_KEY is not configured on the server." });
    }

    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(errorText);
      }

      const data = await response.text();
      res.send(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to proxy request to Pollinations." });
    }
  });

  // API Proxy for Pollinations Audio (to avoid 429 and use API Key)
  app.get("/api/audio/:text", async (req, res) => {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    const text = req.params.text;

    try {
      const url = `https://text.pollinations.ai/audio/${text}`;
      const response = await fetch(url, {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}
      });

      if (!response.ok) {
        return res.status(response.status).send("Audio proxy failed");
      }

      // Pipe the audio stream to the response
      const contentType = response.headers.get("content-type") || "audio/mpeg";
      res.setHeader("Content-Type", contentType);
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Audio proxy error:", error);
      res.status(500).send("Internal server error proxying audio");
    }
  });

  // API Proxy for Pollinations Images (to use API Key and avoid limits)
  app.get("/api/image", async (req, res) => {
    const apiKey = process.env.POLLINATIONS_API_KEY;
    const { prompt, width, height, model, seed, nologo } = req.query;

    try {
      const url = new URL(`https://image.pollinations.ai/prompt/${prompt}`);
      if (width) url.searchParams.set("width", width as string);
      if (height) url.searchParams.set("height", height as string);
      if (model) url.searchParams.set("model", model as string);
      if (seed) url.searchParams.set("seed", seed as string);
      if (nologo) url.searchParams.set("nologo", nologo as string);

      const response = await fetch(url.toString(), {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}
      });

      if (!response.ok) {
        return res.status(response.status).send("Image proxy failed");
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).send("Internal server error proxying image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
