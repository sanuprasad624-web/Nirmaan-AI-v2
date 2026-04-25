import { GoogleGenAI, Type } from "@google/genai";
import { StorageSystem } from "../lib/storage";
import { SystemTemplates } from "../lib/templates";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Smart model fallback chain.
// We try the most powerful model first and gracefully fall back to lighter models
// when the upstream returns 429 / quota errors. The Pro models require a paid
// Google AI plan; the Flash models work on the free daily-resetting quota.
const MODEL_CHAIN = [
  "gemini-3.1-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

function isQuotaError(error: any): boolean {
  const text = String(error?.message || error);
  return error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || /429|quota|exhausted|RESOURCE_EXHAUSTED/i.test(text);
}

async function generateWithFallback(params: { contents: string; config?: any }): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;
  for (const model of MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      const text = response.text || "";
      if (text) {
        if (model !== MODEL_CHAIN[0]) {
          console.info(`[Nirmaan AI] Fell back to model: ${model}`);
        }
        return { text, modelUsed: model };
      }
      lastError = new Error("Empty response from model");
    } catch (error: any) {
      lastError = error;
      if (!isQuotaError(error)) {
        // Hard error (auth, safety, etc.) — don't bother trying other models
        throw error;
      }
      // Quota error — try the next model in the chain
      console.warn(`[Nirmaan AI] Quota hit on ${model}, trying next model...`);
    }
  }
  throw lastError || new Error("All models exhausted");
}

export interface WebsitePlan {
  type: string;
  sections: string[];
  structure: string;
  style: string;
  imageMood?: string;
}

export interface WebsiteData {
  name: string;
  files: {
    "index.html": string;
    "style.css"?: string;
    "script.js"?: string;
    [key: string]: string | undefined;
  };
}

// =============================================================
//  IMAGE PIPELINE
// =============================================================
//  We instruct the AI to emit placeholders of the form
//      <<IMG:descriptive prompt here:1200x800>>
//  After generation we swap every placeholder for a real,
//  AI-generated image from pollinations.ai (free, no key).
//  This eliminates the "hallucinated Unsplash ID" problem and
//  guarantees every image is contextually relevant.
// =============================================================

const PLACEHOLDER_REGEX = /<<IMG:([^:>]+):(\d+)x(\d+)>>/g;

function buildPollinationsUrl(prompt: string, width: number, height: number, seed?: number): string {
  const cleaned = prompt
    .replace(/[<>"']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  const fullPrompt = `${cleaned}, professional photography, high quality, sharp focus, 8k`;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
    enhance: "true",
    model: "flux",
  });
  if (seed !== undefined) params.set("seed", String(seed));
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?${params.toString()}`;
}

function fallbackImageUrl(prompt: string, width: number, height: number): string {
  const keywords = prompt
    .toLowerCase()
    .replace(/[^a-z0-9 ,]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .join(",");
  return `https://loremflickr.com/${width}/${height}/${encodeURIComponent(keywords || "modern,design")}`;
}

function processImagePlaceholders(html: string, brandSeed: string): string {
  let counter = 0;
  return html.replace(PLACEHOLDER_REGEX, (_match, prompt: string, w: string, h: string) => {
    counter += 1;
    const seed = hashString(`${brandSeed}_${prompt}_${counter}`);
    return buildPollinationsUrl(prompt.trim(), parseInt(w, 10), parseInt(h, 10), seed);
  });
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

function processAllFiles(files: Record<string, string | undefined>, brandSeed: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [name, content] of Object.entries(files)) {
    if (typeof content === "string") {
      out[name] = processImagePlaceholders(content, brandSeed);
    } else {
      out[name] = content;
    }
  }
  return out;
}

// =============================================================
//  ROBUST PARSER
// =============================================================

function parseAiResponse(text: string, defaultName: string): WebsiteData {
  const cleanText = text.replace(/```(?:json|html)?/gi, "").replace(/```/g, "").trim();

  // 1. Try a direct parse first (most common with responseMimeType=application/json)
  try {
    const direct = JSON.parse(cleanText);
    if (direct && typeof direct === "object" && direct.files) return direct as WebsiteData;
  } catch {
    // fall through
  }

  // 2. Try to slice between the first { and the LAST matching } with brace counting
  try {
    const start = cleanText.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      let end = -1;
      let inStr = false;
      let escape = false;
      for (let i = start; i < cleanText.length; i++) {
        const c = cleanText[i];
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end !== -1) {
        const sliced = cleanText.substring(start, end + 1);
        const parsed = JSON.parse(sliced);
        if (parsed && parsed.files) return parsed as WebsiteData;
      }
    }
  } catch (e) {
    console.warn("Brace-counted parse failed, trying HTML fallback...", e);
  }

  // 3. Last resort: extract a raw HTML doc
  const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
  if (htmlMatch) {
    return {
      name: defaultName,
      files: { "index.html": htmlMatch[0] },
    };
  }

  throw new Error("Failed to parse AI response. The model returned malformed output.");
}

function describeApiError(error: any, action: string): Error {
  const text = String(error?.message || error);
  if (error?.status === "RESOURCE_EXHAUSTED" || error?.code === 429 || /429|quota|exhausted/i.test(text)) {
    return new Error(
      `Daily quota reached for ${action}. Free Gemini quota resets every 24 hours — try again tomorrow, or upgrade your Google AI key for higher limits.`
    );
  }
  if (/api key/i.test(text)) {
    return new Error("Invalid or missing Gemini API key. Check your secret in the Replit Secrets panel.");
  }
  if (/safety|blocked/i.test(text)) {
    return new Error("Gemini blocked the request for safety reasons. Try rephrasing your description.");
  }
  return new Error(`${action} failed: ${text}`);
}

// =============================================================
//  PLAN
// =============================================================

export async function planWebsite(businessName: string, description: string): Promise<WebsitePlan> {
  const prompt = `You are a senior product designer creating a concise plan for a modern 2026 website.

Business: "${businessName}"
Brief: ${description}

Return a SHORT, opinionated plan covering:
1. Website type (e.g. SaaS landing, portfolio, e-commerce, restaurant)
2. 4-7 key sections in display order
3. Layout structure in one sentence (mention bento grid, hero style, asymmetry, etc.)
4. Visual style in one sentence (colors, typography, mood, modern trends)
5. imageMood: one short phrase describing the photographic style of imagery (e.g. "warm cinematic editorial photography", "minimal neutral product shots")

No code. Be concrete and modern.`;

  try {
    const { text } = await generateWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            sections: { type: Type.ARRAY, items: { type: Type.STRING } },
            structure: { type: Type.STRING },
            style: { type: Type.STRING },
            imageMood: { type: Type.STRING },
          },
          required: ["type", "sections", "structure", "style"],
        },
      },
    });

    const cleanText = (text || "{}").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (error: any) {
    console.error("Gemini API Error (planWebsite):", error);
    throw describeApiError(error, "Planning");
  }
}

// =============================================================
//  GENERATE
// =============================================================

function buildGenerationPrompt(businessName: string, description: string, planContext: string, imageMood: string): string {
  const memories = StorageSystem.getMemory();
  const memoryString = memories.length > 0
    ? `\n========================================\nLEARNED CONSTRAINTS (from previous user feedback — DO NOT REPEAT):\n${memories.map((m) => `- ${m}`).join("\n")}\n========================================\n`
    : "";

  return `You are a world-class senior frontend engineer + product designer. You build polished, modern, premium websites that look like they came out of a top-tier design agency in 2026.

BUSINESS: "${businessName}"
BRIEF: ${description}

PLAN:
${planContext}
${memoryString}
========================================
DESIGN BAR — NON-NEGOTIABLE
========================================
The output MUST look like a 2026 SaaS / product / agency site. That means:
- Bold, modern typography (large hero headlines, tight letter-spacing, mixed font weights).
- Generous whitespace and clear visual hierarchy.
- Modern layout patterns: bento grids, asymmetric splits, sticky scroll sections, card-based feature blocks.
- Subtle, tasteful gradients and soft glows. Glass-morphism panels where appropriate.
- Smooth hover states, transitions on every interactive element, and at least one fade/translate-in animation triggered on scroll using IntersectionObserver in script.js.
- Mobile-first responsive layout using CSS grid + flexbox + media queries (breakpoints: 768px, 1024px).
- Dark-mode compatible color palette OR a strong, on-brand light palette. Pick one and execute it well.
- NO lorem ipsum. NO empty placeholder sections. Every section must have purposeful copy tailored to "${businessName}".
- NO outdated design clichés (centered single-column hero with stock blue button, generic 3-card row).

========================================
FILE STRUCTURE
========================================
Output MUST contain at minimum:
- "index.html" (the home page)
- "assets/css/style.css" (all global styles)
- "assets/js/script.js" (interactive behaviour: mobile menu, scroll animations, smooth scroll)

Add additional pages (e.g. "about.html", "services.html", "contact.html", "pricing.html") whenever the brief or plan calls for them — and link to them from the navbar.

ALL HTML files MUST:
- Include in <head>: <link rel="stylesheet" href="assets/css/style.css">
- Include before </body>: <script src="assets/js/script.js"></script>
- Use the navbar template below verbatim (you may rewrite link labels and target pages).
- Include a footer with brand, quick links, and copyright.

LINKING RULES:
- Use <a href="..."> for ALL navigation. Style links as buttons via CSS where needed. Do NOT use <button> elements for navigation.
- Use relative paths only: "about.html", "#features", "index.html#contact".

========================================
CSS BASELINE (BUILD ON TOP OF THIS, DO NOT REPLACE)
========================================
Start "assets/css/style.css" with the following baseline, then ADD your own modern styles below it:
\`\`\`css
${SystemTemplates.globalCSS}
\`\`\`

Use these CSS variables for theming. You may add more variables on top.

NAVBAR HTML (use as-is in every page, edit only link labels/targets):
\`\`\`html
${SystemTemplates.navbar}
\`\`\`

========================================
IMAGES — STRICT RULES (READ CAREFULLY)
========================================
DO NOT invent Unsplash IDs. DO NOT use https://unsplash.com or https://images.unsplash.com URLs. DO NOT use placeholder.com.

Instead, EVERY image MUST use this EXACT placeholder syntax:

    <<IMG:detailed visual description here:WIDTHxHEIGHT>>

Examples:
- <img src="<<IMG:modern open-plan tech office with diverse team collaborating around a glass desk, warm natural light:1600x900>>" alt="Our team at work">
- <img src="<<IMG:minimalist ceramic coffee cup on light wooden table, soft morning light:800x800>>" alt="Featured product">
- For background images in CSS, embed the placeholder exactly:
    background-image: url('<<IMG:abstract gradient mesh background, deep purple and indigo, modern tech aesthetic:1920x1080>>');

REQUIREMENTS for placeholder descriptions:
- Be SPECIFIC and visual: lighting, composition, subject, mood, colors. 12-30 words ideal.
- Match the brand "${businessName}" and the imageMood: "${imageMood || "professional modern editorial"}".
- Use UNIQUE descriptions per image (no duplicates).
- Pick widths/heights that match the layout (hero ~1600x900, cards ~800x600, avatars ~400x400, full-bg ~1920x1080).
- Every visual section that would benefit from imagery MUST include at least one image.

Our build system will replace each placeholder with a real, AI-generated image that matches the description exactly.

========================================
JAVASCRIPT REQUIREMENTS (assets/js/script.js)
========================================
At minimum implement:
- Mobile menu toggle (the navbar template uses .menu-btn and .nav-links).
- Smooth-scroll for in-page anchor links (#section).
- IntersectionObserver to add a "is-visible" class to elements with data-animate as they scroll into view; pair with CSS transitions for a polished feel.
- A simple form handler that prevents default submit and shows a thank-you message inline.

========================================
OUTPUT FORMAT
========================================
Return ONLY a JSON object — no markdown fences, no commentary:

{
  "name": "${businessName}",
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "about.html": "<!DOCTYPE html>...",
    "assets/css/style.css": "/* ... */",
    "assets/js/script.js": "// ..."
  }
}`;
}

export async function generateWebsite(
  businessName: string,
  description: string,
  planContext: string = "",
  imageMood: string = ""
): Promise<WebsiteData> {
  const prompt = buildGenerationPrompt(businessName, description, planContext, imageMood);

  try {
    const { text } = await generateWithFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseAiResponse(text || "{}", businessName);
    parsed.files = processAllFiles(parsed.files, businessName) as WebsiteData["files"];
    return parsed;
  } catch (error: any) {
    console.error("Gemini API Error (generateWebsite):", error);
    throw describeApiError(error, "Website generation");
  }
}

// =============================================================
//  IMPROVE
// =============================================================

export async function improveWebsite(
  currentData: WebsiteData,
  instruction: string,
  targetSelector?: string
): Promise<WebsiteData> {
  const prompt = `You are a senior frontend engineer editing an existing modern website.

YOUR JOB
- Apply ONLY the user's requested change. Preserve everything else exactly as-is.
- You MUST return ALL files from the current project (modified + unmodified) in the output. Never silently delete a file.

USER REQUEST:
"${instruction}"
${targetSelector ? `\nFOCUS: change ONLY the element matching the CSS selector: "${targetSelector}"\n` : ""}

RULES
- Use relative paths and <a href="..."> for navigation.
- Keep <link rel="stylesheet" href="assets/css/style.css"> in every HTML <head>.
- Keep <script src="assets/js/script.js"></script> at the end of every <body>.
- If the change is global (navbar, footer, theme), update every HTML file consistently.
- Maintain the modern 2026 design quality (bento layouts, gradients, smooth transitions, generous whitespace).

IMAGE RULES (CRITICAL)
- If you ADD or REPLACE an image, you MUST use this placeholder format:
    <<IMG:specific visual description, lighting, mood:WIDTHxHEIGHT>>
- Do NOT invent or use Unsplash URLs. Do NOT use any other image host.
- Existing image URLs in the file already work — leave them alone unless the user explicitly asked to change them.

CURRENT FILES (JSON):
${JSON.stringify(currentData.files, null, 2)}

OUTPUT FORMAT
Return ONLY a JSON object — no markdown, no commentary:

{
  "name": "${currentData.name}",
  "files": {
    "index.html": "<!DOCTYPE html>...",
    "assets/css/style.css": "/* ... */",
    "assets/js/script.js": "// ..."
  }
}`;

  try {
    const { text } = await generateWithFallback({
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = parseAiResponse(text || "{}", currentData.name);

    // Defensive merge: keep any files the AI dropped
    parsed.files = {
      ...currentData.files,
      ...parsed.files,
    };

    // Resolve any new image placeholders (existing real URLs are untouched)
    parsed.files = processAllFiles(parsed.files, currentData.name) as WebsiteData["files"];

    return parsed;
  } catch (error: any) {
    console.error("Gemini API Error (improveWebsite):", error);
    throw describeApiError(error, "Improvement");
  }
}

// =============================================================
//  REGENERATE IMAGES
// =============================================================
//  Walks every <img> + CSS background-image in the project,
//  asks Gemini for a fresh visual prompt for each based on the
//  surrounding context, and then replaces the URL with a new
//  pollinations.ai render. No full site regeneration required.
// =============================================================

export async function regenerateImages(
  currentData: WebsiteData,
  imageMood: string = ""
): Promise<WebsiteData> {
  const htmlFiles = Object.entries(currentData.files).filter(
    ([name, content]) => name.endsWith(".html") && typeof content === "string"
  ) as [string, string][];

  if (htmlFiles.length === 0) return currentData;

  // Collect every <img> with its alt + nearby heading context
  type ImgRef = { fileName: string; original: string; alt: string; context: string; w: number; h: number };
  const refs: ImgRef[] = [];

  for (const [fileName, html] of htmlFiles) {
    const imgRegex = /<img\b[^>]*>/gi;
    const matches = html.match(imgRegex) || [];
    for (const tag of matches) {
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i);
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      const widthMatch = tag.match(/\bwidth=["']?(\d+)/i);
      const heightMatch = tag.match(/\bheight=["']?(\d+)/i);
      if (!srcMatch) continue;

      // Pull the closest heading or paragraph for context
      const idx = html.indexOf(tag);
      const window = html.slice(Math.max(0, idx - 600), idx + 600);
      const headingMatch = window.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);

      refs.push({
        fileName,
        original: srcMatch[1],
        alt: altMatch?.[1] || "",
        context: headingMatch?.[1]?.trim() || "",
        w: widthMatch ? parseInt(widthMatch[1], 10) : 1200,
        h: heightMatch ? parseInt(heightMatch[1], 10) : 800,
      });
    }
  }

  if (refs.length === 0) return currentData;

  // Ask Gemini once for fresh, specific prompts for ALL images
  const promptList = refs
    .map((r, i) => `${i + 1}. alt="${r.alt}" context="${r.context}" (current: ${r.original.slice(0, 80)}...)`)
    .join("\n");

  const askPrompt = `You are an art director for "${currentData.name}".
Image mood for the brand: ${imageMood || "modern, premium, editorial"}.

For each image below, write ONE detailed visual prompt (15-30 words) describing exactly what photo or rendered illustration should appear there. Be specific about subject, lighting, composition, mood, and color palette. The prompts will be sent to an AI image generator.

Images:
${promptList}

Return JSON: { "prompts": ["prompt for image 1", "prompt for image 2", ...] } — one entry per image, in order.`;

  let prompts: string[] = [];
  try {
    const { text } = await generateWithFallback({
      contents: askPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["prompts"],
        },
      },
    });
    const parsed = JSON.parse(text || "{}");
    prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
  } catch (error: any) {
    console.error("Gemini API Error (regenerateImages prompts):", error);
    throw describeApiError(error, "Image regeneration");
  }

  // Replace each image URL with a fresh pollinations URL
  const newFiles: Record<string, string | undefined> = { ...currentData.files };
  refs.forEach((ref, i) => {
    const promptForImg = prompts[i] || ref.alt || ref.context || "modern professional photograph";
    const seed = hashString(`${currentData.name}_regen_${i}_${Date.now()}`);
    const newUrl = buildPollinationsUrl(promptForImg, ref.w, ref.h, seed);
    const fileContent = newFiles[ref.fileName];
    if (typeof fileContent !== "string") return;
    newFiles[ref.fileName] = fileContent.replace(ref.original, newUrl);
  });

  return { ...currentData, files: newFiles as WebsiteData["files"] };
}

// =============================================================
//  EXPORTS for diagnostics / fallback usage
// =============================================================
export const _internals = {
  buildPollinationsUrl,
  fallbackImageUrl,
  processImagePlaceholders,
};
