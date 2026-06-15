import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
// This uses GEMINI_API_KEY from environment variables inject automatically by the platform
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint to generate LinkedIn draft
app.post("/api/generate-post", async (req, res) => {
  try {
    const {
      projectName,
      projectDescription,
      techStack,
      problemSolved,
      keyLearning,
      linkUrl,
      tone = "conversational",
    } = req.body;

    if (!projectName || !projectDescription) {
      return res.status(400).json({ error: "Project name and description are required" });
    }

    let toneInstruction = "";
    switch (tone) {
      case "nerdy":
        toneInstruction = "Lean slightly into the technical details, code structural architecture, and elegant logic. Still keep it accessible, but sound like a builder talking to other builders about engineering decisions.";
        break;
      case "hot-take":
        toneInstruction = "Start with a mildly controversial or unconventional stance about standard industry practices related to what was built, then back it up with how this project addresses it.";
        break;
      case "humble":
        toneInstruction = "Emphasize extreme humbleness, what went wrong first, how we hacked it together, and gratitude for the learning process. Friendly, down-to-earth.";
        break;
      case "minimal":
        toneInstruction = "Highly spaced, low sentence count, punchy, crisp, clear. No filler words, no corporate buzzwords. Raw impact, pure aesthetic execution.";
        break;
      case "conversational":
      default:
        toneInstruction = "Conversational, confident, direct. Like a smart friend sharing a weekend project on a chat thread. Avoid enthusiasm clutter, sound like a real person.";
        break;
    }

    const systemPrompt = `You are a world-class LinkedIn content strategist specializing in helping engineers and builders share their work authentically.
Your mission is to write a post that sounds like a HUMAN — absolutely no corporate talk, no marketing hype, no cheesy excitement indicators like "Delighted to share...", and NO emojis at all inside the main body unless they add extreme functional value (better yet, use none. Never use 🚀, 🎉, 📢, or double emojis).

Requirements:
1. Open with an incredibly strong, relatable hook (a painful problem developers face, a bold statement, or a surprising development fact). Avoid clichés.
2. Tell a short structured story: What was the real problem? What did you build in response? What did you learn or struggle with?
3. Anchor credibility with 1-2 specific technical details (e.g. API structures, libraries, performance details, or stack configurations).
4. Integrate details provided below naturally (Project Title, Description, Tech details, Learning take-aways, etc.).
5. Maintain the custom tone: ${toneInstruction}
6. If a link/URL is provided, include it as a soft, elegant call to action (e.g., "Deployed it at: URL" or "If you want to play around with it: URL"). Keep it clean.

Additionally, output exactly 3 different HOOK alternatives that fit this story but explore different opening angles (e.g. one problem-based, one technical-focus, and one story-starting).
Also output 3 to 5 highly relevant builder/tech hashtags for the very bottom.`;

    const prompt = `Project Title: ${projectName}
Project Description: ${projectDescription}
Tech Stack Used: ${techStack || "Not specified"}
Relatable Problem Solved: ${problemSolved || "Not specified"}
Takeaway/What I Learned: ${keyLearning || "Not specified"}
Live Link / Repository: ${linkUrl || ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            postDraft: {
              type: Type.STRING,
              description: "The full polished LinkedIn post draft following all rules. Do not use markdown headers (e.g. #, ##) in the draft.",
            },
            hookAlternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Strictly 3 distinct dynamic opening hooks targeting developers.",
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 5 realistic tech/builder hashtags. Do not prefix with '#' sign in schema, just the words.",
            },
          },
          required: ["postDraft", "hookAlternatives", "hashtags"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedResult = JSON.parse(resultText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error("Error generating post:", error);
    res.status(500).json({ error: error.message || "Failed to generate LinkedIn post" });
  }
});

// Endpoint to refine/edit existing post draft
app.post("/api/refine-post", async (req, res) => {
  try {
    const { currentDraft, revisionPrompt, projectName, techStack } = req.body;

    if (!currentDraft || !revisionPrompt) {
      return res.status(400).json({ error: "Current draft and revision instructions are required" });
    }

    const systemPrompt = `You are a world-class LinkedIn strategist for engineers. 
Your task is to take an existing LinkedIn post draft and REFINE or REWRITE it based on the user's specific feedback or instructions.
Ensure you preserve the authentic human sound, concrete technical credit, and general structured narrative unless specifically told to alter it.
Avoid emojis unless they are specifically requested or extremely functional. No double emojis or fake hype.

Return:
1. The refined postDraft.
2. 3 updated opening hook alternatives.
3. 3-5 relevant builder hashtags.`;

    const prompt = `
Original Project context (if any):
- Project: ${projectName || "Not specified"}
- Tech Stack: ${techStack || "Not specified"}

Current Draft:
"""
${currentDraft}
"""

User Revision Request:
"${revisionPrompt}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            postDraft: {
              type: Type.STRING,
              description: "The updated full LinkedIn post draft.",
            },
            hookAlternatives: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 updated opening hook options.",
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 to 5 updated hashtags.",
            },
          },
          required: ["postDraft", "hookAlternatives", "hashtags"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedResult = JSON.parse(resultText);
    res.json(parsedResult);
  } catch (error: any) {
    console.error("Error refining post:", error);
    res.status(500).json({ error: error.message || "Failed to refine LinkedIn post" });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
