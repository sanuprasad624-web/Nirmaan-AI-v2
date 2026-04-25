# Nirmaan AI

Professional AI-powered website builder and editor that generates premium, multi-page websites using Google Gemini.

## Tech Stack

- **Build/Bundler:** Vite 6
- **Frontend:** React 19 + TypeScript
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/vite`)
- **AI text:** `@google/genai` (Gemini family) with smart model fallback
- **AI images:** Pollinations.ai (free, key-less, generates images via URL from text prompts)
- **Other libs:** motion, lucide-react, dompurify, jszip, file-saver

## Project Layout

- `index.html` — Vite entry HTML
- `src/main.tsx` — React root
- `src/App.tsx` — Main application
- `src/components/` — Shared UI components
- `src/services/geminiService.ts` — Gemini API client + image pipeline
- `src/lib/storage.ts` — LocalStorage project persistence
- `src/lib/templates.ts` — CSS / HTML baseline injected into the AI prompt
- `vite.config.ts` — Vite config (port, host, proxy-friendly settings, env injection)

## How the AI Pipeline Works

1. **Plan** (`planWebsite`) — Asks Gemini for a short structured plan (type, sections, structure, style, image mood).
2. **Generate** (`generateWebsite`) — Asks Gemini for the full multi-file site. Critically, every image is emitted as a placeholder of the form `<<IMG:detailed visual prompt:WIDTHxHEIGHT>>` to avoid hallucinated Unsplash IDs.
3. **Image swap** — Each placeholder is post-processed into a real Pollinations.ai URL: `https://image.pollinations.ai/prompt/<encoded prompt>?width=W&height=H&model=flux`. Pollinations renders a fresh AI image that actually matches the surrounding content.
4. **Improve** (`improveWebsite`) — Sends the entire current file tree back to Gemini with the user's instruction; same image rules apply for any new images.
5. **Regenerate Images** (`regenerateImages`) — Walks every existing `<img>` in the project, asks Gemini for fresh visual prompts using nearby headings as context, and re-renders all images via Pollinations.

## Smart Model Fallback

`geminiService.ts` defines a `MODEL_CHAIN`:
1. `gemini-3.1-pro-preview` (paid plan only — has the highest quality)
2. `gemini-2.5-pro` (paid plan only)
3. `gemini-2.5-flash` (works on Google's free daily-resetting quota)
4. `gemini-flash-latest` (also free-tier friendly)

Every API call walks the chain, automatically falling back when a 429 / quota error is returned. This means the app works on a free Gemini key (using Flash) while still benefitting from Pro models if/when the user upgrades.

## Environment Variables

- `GEMINI_API_KEY` (secret) — Required. Injected into the bundle at build time via `process.env.GEMINI_API_KEY` in `vite.config.ts`. The Vite config falls back to runtime `process.env` so Replit Secrets work without a `.env` file.

## Replit Setup

- **Workflow:** `Start application` runs `npm run dev` and serves on port **5000**.
- **Vite dev server:** binds `0.0.0.0:5000` with `allowedHosts: true` so the Replit iframe proxy can reach it.
- **Deployment:** Configured as `static` — runs `npm run build` and serves the `dist/` directory.

## Local Development

```bash
npm install
npm run dev   # http://localhost:5000
```
