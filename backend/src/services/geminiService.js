import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { searchSimilarRequirements } from './vectorSearch.js';
import supabase from './supabaseClient.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────
// Diubah agar jika 1 model error ada model lain
// ─────────────────────────────────────────────────────────────
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

// Retry helper
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function tryModel(modelName, prompt, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);

      const text = result.response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Empty response');
      }

      return text;
    } catch (err) {
      // ❌ Fatal error → stop semua
      if (err.message?.includes('API_KEY_INVALID')) {
        throw err;
      }

      if (i === retries) throw err;

      console.warn(
        `[Retry] ${modelName} attempt ${i + 1} failed:`,
        err.message,
      );

      await delay(1000);
    }
  }
}

async function generateWithFallback(prompt) {
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`[AI] Trying model: ${modelName}`);

      const text = await tryModel(modelName, prompt);

      console.log(`[AI] Success with model: ${modelName}`);
      return text;
    } catch (err) {
      console.warn(`[AI] Model failed: ${modelName}`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All models failed: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────
// 🚀 MAIN FUNCTION
// ─────────────────────────────────────────────────────────────
export const generateRoadmap = async (
  targetRole,
  targetRoleId,
  gapSkills,
  currentPosition = 'tidak diketahui',
) => {
  const skillList = gapSkills.map((s) => `- ${s.name}`).join('\n');

  // ── Step 1: RAG ────────────────────────────────────────────
  let ragContext = '';

  try {
    const queryText = `${targetRole} skill requirements: ${gapSkills
      .map((s) => s.name)
      .join(', ')}`;

    const similarDocs = await searchSimilarRequirements(
      queryText,
      targetRoleId,
      5,
      0.4,
    );

    if (similarDocs.length > 0) {
      const contextSnippets = similarDocs
        .map(
          (doc, i) =>
            `[Job Posting ${i + 1}] ${doc.title} (Source: ${
              doc.source
            }, Similarity: ${(doc.similarity * 100).toFixed(0)}%)\n${
              doc.content
            }`,
        )
        .join('\n\n---\n\n');

      ragContext = `
## Referensi Job Requirements dari Pasar Kerja Aktual

${contextSnippets}

---
`;
    }
  } catch (err) {
    console.warn('[RAG] Failed:', err.message);
  }

  // ── Step 1.5: Load resources ───────────────────────────────
  const skillIds = gapSkills.map((s) => s.id);
  const resourceCatalog = {};

  try {
    if (skillIds.length > 0) {
      const idToName = {};
      gapSkills.forEach((s) => (idToName[s.id] = s.name));

      const { data: resources } = await supabase
        .from('skill_resources')
        .select('skill_id, title, type, url, platform')
        .in('skill_id', skillIds);

      if (resources?.length) {
        resources.forEach((r) => {
          const sName = idToName[r.skill_id];
          if (!sName) return;

          if (!resourceCatalog[sName]) resourceCatalog[sName] = [];

          resourceCatalog[sName].push({
            title: r.title,
            type: r.type,
            url: r.url,
            platform: r.platform,
          });
        });
      }
    }
  } catch (err) {
    console.warn('[DB] Failed:', err.message);
  }

  // ── Step 2: Prompt ─────────────────────────────────────────
  const prompt = `
Kamu adalah career advisor yang ahli di bidang teknologi.

${ragContext}

User saat ini: ${currentPosition}
Target: ${targetRole}

Skill gap:
${skillList}

Buat roadmap JSON:

{
  "summary": "...",
  "estimatedDuration": "...",
  "marketInsight": "...",
  "phases": [
    {
      "phase": 1,
      "title": "...",
      "duration": "...",
      "focus_skills": ["..."],
      "sub_topics": ["..."]
    }
  ]
}

Rules:
- Hanya JSON
- Skill HARUS sama persis
- Jangan buat field resources
`;

  // ── Step 3: AI Generate ────────────────────────────────────
  const rawText = await generateWithFallback(prompt);

  const cleanJson = rawText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);

    // ── Inject resources ─────────────────────────────────────
    const findResources = (skillName) => {
      if (resourceCatalog[skillName]) return resourceCatalog[skillName];

      const norm = skillName.toLowerCase();

      for (const [key, val] of Object.entries(resourceCatalog)) {
        if (
          norm.includes(key.toLowerCase()) ||
          key.toLowerCase().includes(norm)
        ) {
          return val;
        }
      }

      return null;
    };

    if (parsed.phases) {
      parsed.phases.forEach((phase) => {
        phase.resources = [];

        phase.focus_skills?.forEach((skill) => {
          const res = findResources(skill);
          if (res) phase.resources.push(...res);
        });
      });
    }

    return parsed;
  } catch (err) {
    console.error('[Parse Error]', err.message);
    return { raw: rawText, parseError: true };
  }
};
