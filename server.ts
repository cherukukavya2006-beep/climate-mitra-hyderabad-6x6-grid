import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Use native fetch (built into Node 18+)
const safeFetch: typeof globalThis.fetch = globalThis.fetch;

const getDirname = () => {
  if (typeof __dirname !== "undefined") return __dirname;
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};
const currentDirname = getDirname();

// Robustly load .env from project directory and current working directory
dotenv.config({ path: path.resolve(currentDirname, ".env") });
dotenv.config();

interface GeoLocation {
  latitude: number;
  longitude: number;
  name: string;
  admin1?: string;
  country?: string;
}

function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Cloudy";
}

async function searchLocation(rawQuery: string): Promise<GeoLocation | null> {
  const clean = (s: string) => s.replace(/^[,\s.-]+|[,\s.-]+$/g, "").trim();
  const query = clean(rawQuery);
  if (!query) return null;

  const trySearch = async (term: string): Promise<GeoLocation | null> => {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=5&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data && data.results && data.results.length > 0) {
        // Prioritize India and Telangana locations
        const indianResult = data.results.find((item: any) =>
          item.country_code === "IN" || item.country === "India" || item.admin1 === "Telangana"
        );
        const item = indianResult || data.results[0];
        return {
          latitude: item.latitude,
          longitude: item.longitude,
          name: item.name,
          admin1: item.admin1,
          country: item.country
        };
      }
    } catch (err) {
      console.error(`[Geocoding Diagnostic] Search failed for "${term}":`, err);
    }
    return null;
  };

  // 1. Try full cleaned query
  let result = await trySearch(query);
  if (result) return result;

  // 2. If query contains comma (e.g. "Kukatpally, Hyderabad"), try individual parts
  if (query.includes(",")) {
    const parts = query.split(",").map(p => clean(p)).filter(Boolean);
    for (const part of parts) {
      result = await trySearch(part);
      if (result) return result;
    }
  }

  // 3. If multi-word, try individual tokens
  const words = query.split(/\s+/).map(w => clean(w)).filter(w => w.length > 2);
  for (const word of words) {
    result = await trySearch(word);
    if (result) return result;
  }

  return null;
}

async function fetchCurrentWeatherData(latitude: number, longitude: number) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&hourly=temperature_2m&timezone=auto`;
  const wRes = await fetch(weatherUrl);
  if (!wRes.ok) throw new Error(`Open-Meteo returned status ${wRes.status}`);
  const wData: any = await wRes.json();
  const current = wData.current || {};
  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    wind_speed: current.wind_speed_10m,
    weather_code: current.weather_code,
    precipitation: current.precipitation ?? 0,
    condition: getWeatherCondition(current.weather_code ?? 0),
    hourly_temps: (wData.hourly?.temperature_2m || []).slice(0, 24),
    hourly_time: (wData.hourly?.time || []).slice(0, 24),
  };
}

function extractLocationCandidate(text: string): string | null {
  const patterns = [
    /(?:weather|temperature|forecast|temp|climate|rain|conditions|rainfall)\s+(?:in|at|for|near|around|of)\s+([^?!.,\n]+)/i,
    /(?:in|at|for|near|around|of)\s+([A-Za-z0-9\s,.-]+?)\s+(?:weather|forecast|temperature|temp|climate|rain)/i,
    /([A-Za-z0-9\s,.-]+?)\s+(?:weather|forecast|temperature|temp|climate|rain)/i,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      let loc = match[1].trim();
      loc = loc.replace(/\b(?:today|tomorrow|now|currently|please|tell\s+me|show\s+me|can\s+you|what\s+is|give\s+me|will\s+it|is\s+it|does\s+it|going\s+to|it|there|when|how)\b/gi, "").trim();
      loc = loc.replace(/^[,\s.-]+|[,\s.-]+$/g, "");
      if (loc.length >= 2 && !/^(?:will|is|can|does|did|do|it|the|a|an|if)$/i.test(loc)) return loc;
    }
  }

  const knownPlaces = [
    "Kukatpally", "Gachibowli", "Madhapur", "Hitec City", "HITEC City",
    "Banjara Hills", "Jubilee Hills", "Secunderabad", "Begumpet", "Ameerpet",
    "Miyapur", "Kondapur", "Charminar", "Mehdipatnam", "Uppal", "LB Nagar",
    "Dilsukhnagar", "Koti", "Shamshabad", "Lingampally", "Manikonda", "Hyderabad"
  ];
  for (const place of knownPlaces) {
    const regex = new RegExp(`\\b${place}\\b`, "i");
    if (regex.test(text)) {
      return place;
    }
  }

  return null;
}

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
      const city = (req.query.city as string) || "Hyderabad";
      const geo = await searchLocation(city);

      if (!geo) {
        return res.status(404).json({ error: "Location not found" });
      }

      const weather = await fetchCurrentWeatherData(geo.latitude, geo.longitude);

      res.json({
        city: geo.name,
        latitude: geo.latitude,
        longitude: geo.longitude,
        temperature: weather.temperature,
        humidity: weather.humidity,
        wind_speed: weather.wind_speed,
        weather_code: weather.weather_code,
        condition: weather.condition,
        precipitation: weather.precipitation,
        hourly_temps: weather.hourly_temps,
        hourly_time: weather.hourly_time
      });
    } catch (error: any) {
      console.error("[Weather Endpoint Error]:", error?.message || error);
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
      const wData: any = await wRes.json();

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
    } catch (error: any) {
      console.error("[Grid Endpoint Error]:", error?.message || error);
      res.status(500).json({ error: "Failed to fetch grid" });
    }
  });

  app.post("/api/farming/analyze", async (req, res) => {
    try {
      const { crop, activity, location } = req.body;
      const geo = await searchLocation(location || "Hyderabad");

      if (!geo) {
        return res.json({ recommendation: `Location ${location} not found for advisory.` });
      }

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=precipitation,wind_speed_10m,temperature_2m`;
      const wRes = await fetch(weatherUrl);
      const wData: any = await wRes.json();

      const precip = wData.current?.precipitation ?? 0;
      const wind = wData.current?.wind_speed_10m ?? 0;
      const temp = wData.current?.temperature_2m ?? 0;

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
        recommendation: `🌱 ${crop} — ${activity} in ${geo.name}\n\nCurrent Temp: ${temp}°C\nPrecipitation: ${precip}mm\nWind Speed: ${wind}km/h\n\nRecommendation:\n${rec}`
      });
    } catch (error: any) {
      console.error("[Farming Analyze Error]:", error?.message || error);
      res.json({ recommendation: "Could not verify weather data right now." });
    }
  });

  app.post("/api/ai/ask", async (req, res) => {
    const timestamp = new Date().toISOString();
    try {
      const { question } = req.body;
      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Please provide a valid question." });
      }

      const trimmedQuestion = question.trim();
      console.log(`[${timestamp}] [AI Assistant] Received question: "${trimmedQuestion}"`);
      const apiKey = (process.env.GEMINI_API_KEY || "").trim();
      const isApiKeyConfigured = Boolean(
        apiKey &&
        apiKey !== "MY_GEMINI_API_KEY" &&
        apiKey !== "your_gemini_api_key_here" &&
        !apiKey.startsWith("your_") &&
        apiKey !== "PLACEHOLDER"
      );

      // Helper function to query Gemini with multi-model fallback and modern SDK format
      const queryGemini = async (promptText: string): Promise<string> => {
        const cleanKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();
        const ai = new GoogleGenAI({ apiKey: cleanKey });
        const models = [
          'gemini-3.8-flash',
          'gemini-3.5-flash',
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite',
          'gemini-flash-latest'
        ];
        let lastErr: any = null;

        for (const model of models) {
          // Attempt 1: Modern Interactions API
          try {
            if (ai.interactions && typeof ai.interactions.create === 'function') {
              const interaction = await ai.interactions.create({
                model,
                input: promptText,
              });
              const text = interaction.output_text?.trim();
              if (text) return text;
            }
          } catch (intErr: any) {
            lastErr = intErr;
            const sanitizedErr = intErr?.message ? String(intErr.message).replace(/key=[^&\s]+/gi, "key=[REDACTED]") : "Interaction error";
            console.warn(`[${timestamp}] [AI Assistant] Interactions API for ${model} failed (${sanitizedErr}), falling back to generateContent...`);
          }

          // Attempt 2: generateContent API
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
            });
            const text = response.text?.trim() || "";
            if (text) return text;
          } catch (genErr: any) {
            lastErr = genErr;
            const sanitizedErr = genErr?.message ? String(genErr.message).replace(/key=[^&\s]+/gi, "key=[REDACTED]") : "GenerateContent error";
            console.warn(`[${timestamp}] [AI Assistant] GenerateContent for ${model} failed (${sanitizedErr}), attempting next model...`);
          }
        }
        throw lastErr || new Error("All configured Gemini models failed to return content.");
      };

      // Check if this is a weather inquiry or direct place lookup
      const isWeatherQuestion = /(?:weather|temperature|temp|climate|rain|forecast|rainfall|humid|hot|cold|warm|wind|monsoon|storm|వాతావరణం|వర్షం)/i.test(trimmedQuestion);
      const isDirectPlaceName = [
        "kukatpally", "gachibowli", "madhapur", "hitec city", "banjara hills",
        "jubilee hills", "secunderabad", "begumpet", "ameerpet", "miyapur",
        "kondapur", "charminar", "mehdipatnam", "uppal", "lb nagar",
        "dilsukhnagar", "koti", "shamshabad", "lingampally", "manikonda", "hyderabad"
      ].includes(trimmedQuestion.toLowerCase());

      const detectedLocation = extractLocationCandidate(trimmedQuestion);

      if (isWeatherQuestion || isDirectPlaceName) {
        const queryLoc = detectedLocation || (isDirectPlaceName ? trimmedQuestion : "Hyderabad");
        console.log(`[${timestamp}] [AI Assistant] Weather query identified for location: "${queryLoc}"`);

        const geo = await searchLocation(queryLoc);
        if (geo) {
          console.log(`[${timestamp}] [AI Assistant] Resolved location "${queryLoc}" to ${geo.name} (${geo.latitude}, ${geo.longitude})`);
          const weather = await fetchCurrentWeatherData(geo.latitude, geo.longitude);
          console.log(`[${timestamp}] [AI Assistant] Retrieved live weather for ${geo.name}: ${weather.temperature}°C, ${weather.condition}, Humidity: ${weather.humidity}%, Wind: ${weather.wind_speed}km/h`);

          // If Gemini API Key is configured, use Gemini to formulate rich response with real live data
          if (isApiKeyConfigured) {
            try {
              const prompt = `You are Climate Mitra, a warm and helpful AI assistant for weather, climate, and agriculture in Telangana and Hyderabad. Answer clearly, concisely, and politely in English or Telugu as requested.

Verified LIVE weather data from Open-Meteo for ${geo.name} (Latitude: ${geo.latitude}, Longitude: ${geo.longitude}):
- Temperature: ${weather.temperature}°C
- Condition: ${weather.condition} (WMO weather code: ${weather.weather_code})
- Relative Humidity: ${weather.humidity}%
- Wind Speed: ${weather.wind_speed} km/h
- Precipitation: ${weather.precipitation} mm

User Question: "${trimmedQuestion}"

Instructions:
1. Provide the actual live weather conditions using the verified telemetry data above.
2. Give practical advice for citizens or farmers based on these real conditions (e.g. comfort, rain precautions, outdoor activity).
3. Do not invent or guess any current conditions. Base your response strictly on this live data.`;

              const aiResponseText = await queryGemini(prompt);
              if (aiResponseText) {
                return res.json({ answer: aiResponseText });
              }
            } catch (aiErr: any) {
              const sanitizedErrMsg = aiErr?.message ? String(aiErr.message).replace(/key=[^&\s]+/gi, "key=[REDACTED]") : "Unknown error";
              console.error(`[${timestamp}] [AI Assistant] Gemini API generation error:`, sanitizedErrMsg);
              // Fallback to verified live weather directly so user always gets accurate live weather
              return res.json({
                answer: `📍 Live Weather for ${geo.name}:\n\n` +
                  `• Temperature: ${weather.temperature}°C\n` +
                  `• Condition: ${weather.condition}\n` +
                  `• Relative Humidity: ${weather.humidity}%\n` +
                  `• Wind Speed: ${weather.wind_speed} km/h\n` +
                  `• Precipitation: ${weather.precipitation} mm\n\n` +
                  `ℹ️ Live weather data retrieved from Open-Meteo API. (Note: Gemini conversational AI synthesis was unavailable: ${aiErr?.status === 400 ? 'Check GEMINI_API_KEY validity' : 'temporary AI service issue'}).`
              });
            }
          } else {
            // No Gemini API key provided - return verified live weather data directly
            console.warn(`[${timestamp}] [AI Assistant] GEMINI_API_KEY is not configured. Serving verified live weather data directly from Open-Meteo.`);
            return res.json({
              answer: `📍 Live Weather for ${geo.name}:\n\n` +
                `• Temperature: ${weather.temperature}°C\n` +
                `• Condition: ${weather.condition}\n` +
                `• Relative Humidity: ${weather.humidity}%\n` +
                `• Wind Speed: ${weather.wind_speed} km/h\n` +
                `• Precipitation: ${weather.precipitation} mm\n\n` +
                `✅ Live telemetry retrieved directly from Open-Meteo API.\n` +
                `💡 To enable conversational AI intelligence, set your GEMINI_API_KEY in the .env file.`
            });
          }
        } else {
          console.warn(`[${timestamp}] [AI Assistant] Could not resolve geocoding for location: "${queryLoc}"`);
        }
      }

      // General (non-weather) questions
      if (!isApiKeyConfigured) {
        console.warn(`[${timestamp}] [AI Assistant] Non-weather question received but GEMINI_API_KEY is missing.`);
        const lowerQ = trimmedQuestion.toLowerCase();
        let fallbackAdvisory = "";

        if (lowerQ.includes("rice") || lowerQ.includes("paddy") || lowerQ.includes("వరి")) {
          fallbackAdvisory = "🌾 **Rice / Paddy Advisory for Telangana**:\n• Sowing Season: Kharif (June–July) and Rabi (Nov–Dec).\n• Recommended Varieties: Telangana Sona (RNR 15048 - low GI), BPT 5204 (Samba Mahsuri), MTU 1010, KNM 118.\n• Water Management: Maintain 2–5 cm shallow water layer during tillering to panicle initiation.\n• Weed Management: Pre-emergence herbicide application within 3–5 days of transplanting.";
        } else if (lowerQ.includes("cotton") || lowerQ.includes("పత్తి")) {
          fallbackAdvisory = "🌱 **Cotton Advisory for Telangana**:\n• Soil & Spacing: Well-drained deep black soils; 90×60 cm or 120×45 cm.\n• Pest Watch: Monitor for Pink Bollworm using pheromone traps (8 traps/acre). Avoid broad-spectrum pyrethroids in early stages.\n• Nutrient Management: Split nitrogen fertilizer in 3–4 applications to match crop demand.";
        } else if (lowerQ.includes("chilli") || lowerQ.includes("మిరప")) {
          fallbackAdvisory = "🌶️ **Chilli Advisory for Telangana**:\n• Spacing & Soil: Light loamy or black soils with good drainage; 60×60 cm spacing.\n• Integrated Pest Management: Monitor for Thrips and Mites; spray neem oil (5ml/L) or sticky yellow/blue traps.\n• Moisture: Avoid water stagnation; drip irrigation recommended for optimal yield.";
        } else if (lowerQ.includes("maize") || lowerQ.includes("మొక్కజొన్న")) {
          fallbackAdvisory = "🌽 **Maize Advisory for Telangana**:\n• Season: Kharif and Rabi with high yield potential.\n• Pest Control: Monitor for Fall Armyworm (FAW). Apply *Bacillus thuringiensis* (Bt) or whorl application of neem formulation if egg masses appear.\n• Fertilizer: High nitrogen consumer; apply nitrogen in 3 splits (sowing, knee-high, and tasseling stages).";
        }

        if (fallbackAdvisory) {
          return res.json({
            answer: `${fallbackAdvisory}\n\n💡 *Note: To unlock custom AI conversation and personalized answers, please add your GEMINI_API_KEY to your .env file.*`
          });
        }

        return res.json({
          answer: "I am Climate Mitra, your AI assistant for weather, climate, and agriculture in Telangana!\n\n" +
            "• **Live Weather**: Ask me about any location (e.g. *'What is the weather in Kukatpally?'* or *'Will it rain in Hyderabad?'*).\n" +
            "• **Crops & Farming**: Ask about Rice/Paddy, Cotton, Chilli, or Maize cultivation and management.\n\n" +
            "💡 *To enable conversational AI on any topic, configure your GEMINI_API_KEY in your .env file.*"
        });
      }

      const prompt = `You are Climate Mitra, a helpful assistant for weather, climate change, and agriculture. Answer clearly, warmly, and concisely in English or Telugu as asked. Base agriculture advice on general best practices. Use a polite, approachable tone. The user asked: ${trimmedQuestion}`;
      const aiText = await queryGemini(prompt);

      res.json({ answer: aiText });
    } catch (error: any) {
      const sanitizedErrMsg = error?.message ? String(error.message).replace(/key=[^&\s]+/gi, "key=[REDACTED]") : "Internal error";
      console.error(`[${timestamp}] [AI Assistant Error]:`, sanitizedErrMsg);
      res.status(500).json({
        error: "Internal server error while processing your request.",
        answer: "I'm having trouble connecting to my AI brain right now. Please verify server connectivity or try again in a moment."
      });
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
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
    const key = (process.env.GEMINI_API_KEY || "").trim();
    const isConfigured = Boolean(key && key !== "MY_GEMINI_API_KEY" && key !== "your_gemini_api_key_here" && !key.startsWith("your_") && key !== "PLACEHOLDER");
    if (!isConfigured) {
      console.log(`[Notice] GEMINI_API_KEY is not configured in .env. Live Open-Meteo weather and built-in Telangana crop intelligence will be served directly in fallback mode.`);
    } else {
      console.log(`[Notice] GEMINI_API_KEY is detected and active.`);
    }
  });
}

startServer();

