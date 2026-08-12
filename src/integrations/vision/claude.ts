/**
 * Meal photo analysis via the Claude API, called directly from the browser.
 *
 * This is the one feature in the app that touches a network: the photo and
 * your API key go straight from this device to Anthropic — never through any
 * server of this app's own, because it has none. That direct-from-browser call
 * only works with the `anthropic-dangerous-direct-browser-access` header,
 * which exists precisely for personal, single-user tools like this one; it is
 * not something a multi-user product would ship, since every visitor would
 * share one exposed key. Here there is exactly one user and it is you.
 */

export interface FoodAnalysis {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Claude's own hedge about portion size, mixed dishes, etc. */
  note?: string;
}

const MODEL = 'claude-opus-5';

const PROMPT = `You are looking at a photo of a meal for a personal nutrition tracker.
Identify the food and estimate its nutrition. Reply with ONLY a JSON object,
no other text, in exactly this shape:
{"name": "short food description", "calories": number, "protein": number, "carbs": number, "fat": number, "note": "one short sentence on portion-size uncertainty, or null"}
Macros are grams. If you cannot tell at all, use your best reasonable guess for
an average adult portion rather than omitting fields.`;

function mimeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match?.[1] ?? 'image/jpeg';
}

function base64FromDataUrl(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export class VisionError extends Error {}

export async function analyzeFoodPhoto(photoDataUrl: string, apiKey: string): Promise<FoodAnalysis> {
  if (!apiKey.trim()) throw new VisionError('No API key set — add one in Settings first.');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeFromDataUrl(photoDataUrl),
                  data: base64FromDataUrl(photoDataUrl),
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new VisionError('Could not reach Anthropic — check your connection.');
  }

  if (!res.ok) {
    if (res.status === 401) throw new VisionError('That API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new VisionError('Rate limited — wait a moment and try again.');
    const body = await res.text().catch(() => '');
    throw new VisionError(`Anthropic returned an error (${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new VisionError('Could not parse a response — try again.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new VisionError('Could not parse a response — try again.');
  }

  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined;

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Meal',
    calories: num(parsed.calories),
    protein: num(parsed.protein),
    carbs: num(parsed.carbs),
    fat: num(parsed.fat),
    note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined,
  };
}

export interface SyllabusCategory {
  name: string;
  weightPct: number;
}

export interface SyllabusAnalysis {
  courseName: string;
  courseCode?: string;
  instructor?: string;
  categories: SyllabusCategory[];
  /** Claude's own hedge — illegible sections, weights that don't sum to 100, ambiguous category names. */
  note?: string;
}

const SYLLABUS_PROMPT = `You are looking at a photo of a page from a college course syllabus.
Find the course name/code, the instructor if listed, and the grading breakdown
(how the final grade is weighted across categories like homework, exams,
participation, etc). Reply with ONLY a JSON object, no other text, in exactly
this shape:
{"courseName": "string", "courseCode": "string or null", "instructor": "string or null", "categories": [{"name": "string", "weightPct": number}], "note": "one short sentence flagging anything you're unsure about, or null"}
Weights are the percentage each category counts toward the final grade — read
them exactly as printed rather than estimating, and if this page has no
grading table at all, return an empty categories array rather than guessing one.`;

export async function analyzeSyllabusPhoto(photoDataUrl: string, apiKey: string): Promise<SyllabusAnalysis> {
  if (!apiKey.trim()) throw new VisionError('No API key set — add one in Settings first.');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeFromDataUrl(photoDataUrl),
                  data: base64FromDataUrl(photoDataUrl),
                },
              },
              { type: 'text', text: SYLLABUS_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new VisionError('Could not reach Anthropic — check your connection.');
  }

  if (!res.ok) {
    if (res.status === 401) throw new VisionError('That API key was rejected. Check it in Settings.');
    if (res.status === 429) throw new VisionError('Rate limited — wait a moment and try again.');
    const body = await res.text().catch(() => '');
    throw new VisionError(`Anthropic returned an error (${res.status}). ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new VisionError('Could not parse a response — try again.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new VisionError('Could not parse a response — try again.');
  }

  const categories: SyllabusCategory[] = Array.isArray(parsed.categories)
    ? (parsed.categories as unknown[])
        .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
        .map((c) => ({
          name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Category',
          weightPct: typeof c.weightPct === 'number' && Number.isFinite(c.weightPct) ? c.weightPct : 0,
        }))
        .filter((c) => c.weightPct > 0)
    : [];

  return {
    courseName: typeof parsed.courseName === 'string' && parsed.courseName.trim() ? parsed.courseName.trim() : 'New course',
    courseCode: typeof parsed.courseCode === 'string' && parsed.courseCode.trim() ? parsed.courseCode.trim() : undefined,
    instructor: typeof parsed.instructor === 'string' && parsed.instructor.trim() ? parsed.instructor.trim() : undefined,
    categories,
    note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : undefined,
  };
}

/**
 * Downscales and compresses an image file to a small JPEG data URL before it
 * ever touches localStorage or the network — a phone photo can be 5-10MB, and
 * neither localStorage's quota nor a per-request API payload wants that.
 */
export async function compressPhoto(file: File, maxDim = 1024, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', quality);
}
