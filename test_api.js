import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function testGeminiIntegration() {
  console.log("=== Testing Gemini Integration for Climate Mitra ===");
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("FAIL: GEMINI_API_KEY is not defined in process.env");
    process.exit(1);
  }

  console.log("PASS: GEMINI_API_KEY is detected in process.env (Key length: " + apiKey.trim().length + ")");

  const cleanKey = apiKey.trim();
  const ai = new GoogleGenAI({ apiKey: cleanKey });

  const testModels = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  const testPrompt = "You are Climate Mitra, an AI co-pilot for Telangana farmers. Answer in 2 friendly sentences: What is the best season to plant paddy in Telangana?";

  let succeeded = false;
  let responseText = "";

  for (const model of testModels) {
    console.log(`\nAttempting model: ${model}...`);
    
    // Attempt 1: Interactions API
    try {
      if (ai.interactions && typeof ai.interactions.create === "function") {
        console.log(`Trying ai.interactions.create with ${model}...`);
        const interaction = await ai.interactions.create({
          model,
          input: testPrompt,
        });
        if (interaction && interaction.output_text) {
          responseText = interaction.output_text.trim();
          console.log(`SUCCESS via Interactions API (${model})!`);
          succeeded = true;
          break;
        }
      }
    } catch (err) {
      console.log(`Interactions API attempt for ${model} encountered error: ${err?.status || err?.message || err}`);
    }

    // Attempt 2: GenerateContent API
    try {
      console.log(`Trying ai.models.generateContent with ${model}...`);
      const res = await ai.models.generateContent({
        model,
        contents: testPrompt,
      });
      if (res && res.text) {
        responseText = res.text.trim();
        console.log(`SUCCESS via generateContent (${model})!`);
        succeeded = true;
        break;
      }
    } catch (err) {
      console.log(`generateContent attempt for ${model} encountered error: ${err?.status || err?.message || err}`);
    }
  }

  if (succeeded) {
    console.log("\n--- Conversational Response Received ---");
    console.log(responseText);
    console.log("----------------------------------------\n");
    console.log("PASS: Gemini returned a valid conversational response.");
  } else {
    console.error("FAIL: Unable to get a response from any configured model.");
    process.exit(1);
  }
}

testGeminiIntegration();

