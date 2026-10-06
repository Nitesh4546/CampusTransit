import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let ai = null;

function getAI() {
  if (!ai && env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return ai;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    textShort: { type: 'string' },
  },
  required: ['text', 'textShort'],
};

function templateFallback({ routeName, busName, stopName, delayMin, etaTime }) {
  const timeStr = etaTime ? new Date(etaTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'soon';
  return {
    text: `${routeName || 'The bus'} is running about ${delayMin} min late. Expected at ${stopName} around ${timeStr}.`,
    textShort: `${routeName} ~${delayMin}min late. Next: ${stopName} ~${timeStr}`,
    source: 'template',
  };
}

/**
 * Generate a delay announcement using Gemini, with template fallback.
 */
export async function generateDelayText({ routeName, busName, stopName, delayMin, etaTime, reason, eventTitle }) {
  const gemini = getAI();
  if (!gemini) {
    logger.warn('Gemini API key not set, using template fallback');
    return templateFallback({ routeName, busName, stopName, delayMin, etaTime });
  }

  const prompt = `You write short, calm, clear bus delay announcements for students.
Context:
- Route: ${routeName || 'Unknown'}
- Bus: ${busName || 'Unknown'}
- Next stop: ${stopName || 'Unknown'}
- Delay: ${delayMin} minutes
- Updated ETA at next stop: ${etaTime ? new Date(etaTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown'}
${reason ? `- Reason: ${reason}` : ''}
${eventTitle ? `- Event context: ${eventTitle}` : ''}

Rules:
- Max 2 sentences for "text", max 90 characters for "textShort".
- No blame, no jargon, no emojis, don't invent reasons.
- Include the new ETA time.
Return ONLY JSON: {"text": "...", "textShort": "..."}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
    const result = await gemini.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    });
    clearTimeout(timeout);

    const raw = result.text;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw, textShort: raw.slice(0, 90) };
    }
    return { ...parsed, source: 'gemini' };
  } catch (err) {
    logger.warn(`Gemini failed (${err.message}), using template fallback`);
    return templateFallback({ routeName, busName, stopName, delayMin, etaTime });
  }
}
