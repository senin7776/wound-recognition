import { GoogleGenerativeAI } from '@google/generative-ai';

export type AnalysisResult = {
  timestamp: number;
  imageUrl: string;
  age?: number;
  ageGroup?: string;
  type: string;
  stage: string;
  severity: number;
  precautions: string[];
  meds: string[];
};

type AnalyzeArgs = { file: File; age?: number };

const MODEL_NAME = 'gemini-1.5-flash';

export async function analyzeWithGemini({ file, age }: AnalyzeArgs): Promise<Omit<AnalysisResult, 'timestamp' | 'imageUrl' | 'ageGroup'>> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || 'image/jpeg';

  const prompt = buildPrompt(age);

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: base64FromBytes(bytes), mimeType } }
      ]
    }]
  });

  const text = result.response.text();
  const parsed = parseModelResponse(text);
  return parsed;
}

function buildPrompt(age?: number) {
  return `You are HealScan AI, a wound recognition assistant. Analyze the wound in the image and respond ONLY in valid JSON matching this schema:
{
  "type": "string (one of: Burn, Cut, Diabetic Foot Ulcer, Infected Wound, Other)",
  "stage": "string (Inflammatory | Proliferative | Maturation | Unknown)",
  "severity": "integer 0-100 (overall severity considering risk)",
  "precautions": ["3-4 concise bullet points"],
  "meds": ["3-4 concise, non-repetitive care and medicine suggestions"]
}
Age of patient: ${age ?? 'unknown'}. Tailor advice to age group: Child (<=12), Adult (13-59), Elderly (>=60). Avoid duplicates. No prose outside JSON.`;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function parseModelResponse(text: string): Omit<AnalysisResult, 'timestamp' | 'imageUrl' | 'ageGroup'> {
  // Try to extract JSON even if model wraps in code fences
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model returned no JSON');
  const json = JSON.parse(match[0]);
  return {
    type: String(json.type || 'Other'),
    stage: String(json.stage || 'Unknown'),
    severity: clamp(Number(json.severity) || 0, 0, 100),
    precautions: toStrArray(json.precautions).slice(0, 4),
    meds: toStrArray(json.meds).slice(0, 4)
  };
}

function toStrArray(v: any): string[] { return Array.isArray(v) ? v.map(String).filter(Boolean) : []; }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }


