import express from "express";
import path from "path";
import app, { isGeminiKeyConfigured } from "./server/app.js";

// Local / self-hosted entry point (npm run dev, npm start).
// On Vercel, api/index.ts serves the same Express app as a serverless function.
async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
    if (!isGeminiKeyConfigured()) {
      console.log(`[Notice] GEMINI_API_KEY is not configured in .env. Live Open-Meteo weather and built-in Telangana crop intelligence will be served directly in fallback mode.`);
    } else {
      console.log(`[Notice] GEMINI_API_KEY is detected and active.`);
    }
  });
}

startServer();
