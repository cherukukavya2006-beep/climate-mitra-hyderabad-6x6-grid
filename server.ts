import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/weather/current", async (req, res) => {
    try {
      const city = req.query.city || "Hyderabad";
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return res.status(404).json({ error: "Location not found" });
      }

      const { latitude, longitude, name } = geoData.results[0];
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m&timezone=auto`;
      const wRes = await fetch(weatherUrl);
      const wData = await wRes.json();

      res.json({
        city: name,
        latitude,
        longitude,
        temperature: wData.current.temperature_2m,
        humidity: wData.current.relative_humidity_2m,
        wind_speed: wData.current.wind_speed_10m,
        weather_code: wData.current.weather_code,
        hourly_temps: wData.hourly.temperature_2m.slice(0, 24),
        hourly_time: wData.hourly.time.slice(0, 24)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  app.get("/api/weather/grid", async (req, res) => {
    try {
      const lats = [];
      const lons = [];
      const latStart = 17.55;
      const latEnd = 17.25;
      const lonStart = 78.25;
      const lonEnd = 78.55;

      for (let i = 0; i < 6; i++) {
        const lat = latStart - (i * (latStart - latEnd) / 5);
        for (let j = 0; j < 6; j++) {
          const lon = lonStart + (j * (lonEnd - lonStart) / 5);
          lats.push(lat.toFixed(4));
          lons.push(lon.toFixed(4));
        }
      }

      const latsStr = lats.join(",");
      const lonsStr = lons.join(",");

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latsStr}&longitude=${lonsStr}&current=temperature_2m,weather_code&timezone=auto`;
      const wRes = await fetch(weatherUrl);
      const wData = await wRes.json();

      if (Array.isArray(wData)) {
        const results = wData.map((locationData, idx) => {
          const current = locationData.current || {};
          let desc = "Clear";
          if (current.weather_code > 50) desc = "Rainy";
          else if (current.weather_code > 2) desc = "Cloudy";

          return {
            id: idx,
            lat: parseFloat(lats[idx]),
            lon: parseFloat(lons[idx]),
            temperature: current.temperature_2m ?? '--',
            code: current.weather_code ?? 0,
            description: desc
          };
        });
        res.json({ grid: results });
      } else {
        res.status(500).json({ error: "Unexpected response from weather API" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch grid" });
    }
  });

  app.post("/api/farming/analyze", async (req, res) => {
    try {
      const { crop, activity, location } = req.body;
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${location}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return res.json({ recommendation: `Location ${location} not found for advisory.` });
      }

      const { latitude, longitude } = geoData.results[0];
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=precipitation,wind_speed_10m,temperature_2m`;
      const wRes = await fetch(weatherUrl);
      const wData = await wRes.json();

      const precip = wData.current.precipitation;
      const wind = wData.current.wind_speed_10m;
      const temp = wData.current.temperature_2m;

      let rec = "";
      if (activity === 'Pesticide spraying') {
        if (precip > 0 || wind > 20) {
          rec = `NOT RECOMMENDED. High chance of rain (${precip}mm) or wind (${wind}km/h). Wait for clear weather.`;
        } else {
          rec = "SUITABLE. Weather is clear. Follow pesticide label instructions.";
        }
      } else if (activity === 'Sowing') {
        if (precip > 5) {
          rec = "CAUTION. Heavy soil moisture expected. Good for some crops, but monitor.";
        } else {
          rec = "SUITABLE for most crops requiring moderate conditions.";
        }
      } else if (activity === 'Irrigation') {
        if (precip > 2) {
           rec = "WAIT. Rain is expected. Save water and wait for natural irrigation.";
        } else if (temp > 35) {
           rec = "RECOMMENDED. High temperatures observed. Irrigate in the early morning or late evening.";
        } else {
           rec = "MODERATE. Maintain regular irrigation schedule.";
        }
      } else {
        rec = `Conditions look average for ${activity} of ${crop}. Check local advisory.`;
      }

      res.json({
        recommendation: `🌱 ${crop} — ${activity}\n\nCurrent Temp: ${temp}°C\nPrecip: ${precip}mm\nWind: ${wind}km/h\n\nRecommendation:\n${rec}`
      });
    } catch (error) {
      res.json({ recommendation: "Could not verify weather data right now." });
    }
  });

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { question } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({ answer: "I'm operating in fallback mode. I am Climate Mitra, an AI for farmers and weather insights! Please configure your Gemini API Key." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [{ text: `You are Climate Mitra, a helpful assistant for weather, climate change, and agriculture. Answer clearly, warmly, and concisely in English or Telugu as asked. Base agriculture advice on general best practices. Use a polite, approachable tone. The user asked: ${question}` }]
            }
        ]
      });

      res.json({ answer: response.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ answer: "I'm having trouble connecting to my AI brain right now." });
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
