import fs from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY is required. Add it as a GitHub Actions repository secret.');

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'date', 'summary', 'sections', 'takeaway', 'sources'],
  properties: {
    title: { type: 'string' },
    date: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array', minItems: 4, maxItems: 6,
      items: {
        type: 'object', additionalProperties: false,
        required: ['heading', 'content'],
        properties: { heading: { type: 'string' }, content: { type: 'string' } }
      }
    },
    takeaway: { type: 'string' },
    sources: {
      type: 'array', minItems: 3, maxItems: 10,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'url'],
        properties: { title: { type: 'string' }, url: { type: 'string' } }
      }
    }
  }
};

const prompt = `Prepare a concise, public-facing Northeast Ohio Industry Insights briefing dated ${today} for Spray GenX LLC.

Research current developments from the past 30 days whenever possible. Cover consequential commercial painting, repaint demand, industrial coatings and refinishing, facility maintenance, GC and construction-manager activity, public procurement, material and labor pricing signals, and regulatory developments across Northeast Ohio. Give priority to Cleveland, Akron, Canton, Youngstown, Medina, Lorain, Lake, Summit, Stark, Cuyahoga, Portage, Geauga, Wayne, Mahoning and Trumbull areas.

Requirements:
- Use web search and rely on credible primary or established regional sources.
- Do not present an expired bid as currently open. State exact deadlines when discussing a live solicitation.
- Do not expose Spray GenX's private pricing, weaknesses, customer details or internal strategy.
- Write for property owners, facility managers, GCs and commercial decision-makers.
- Keep each section around 70-130 words.
- Include 4-6 sections, including commercial demand, industrial/coatings opportunity, GC/bid watch, and pricing/regulation.
- End with one practical takeaway suitable for a public website.
- Include only source URLs actually used.
- Return the date exactly as ${today}.`;

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-5',
    tools: [{ type: 'web_search', search_context_size: 'high', user_location: {
      type: 'approximate', city: 'Medina', region: 'Ohio', country: 'US', timezone: 'America/New_York'
    }}],
    input: prompt,
    text: { format: { type: 'json_schema', name: 'regional_industry_update', strict: true, schema } }
  })
});

if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
const payload = await response.json();
const outputText = payload.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text;
if (!outputText) throw new Error('The API returned no structured briefing text.');

const article = JSON.parse(outputText);
if (article.date !== today) throw new Error(`Unexpected article date: ${article.date}`);
article.sources = article.sources.filter(source => {
  try { return ['http:', 'https:'].includes(new URL(source.url).protocol); } catch { return false; }
});
if (article.sources.length < 3) throw new Error('Fewer than three valid source URLs were returned.');

const dataDir = path.join(process.cwd(), 'data', 'regional-updates');
await fs.mkdir(dataDir, { recursive: true });
const fileName = `${today}.json`;
await fs.writeFile(path.join(dataDir, fileName), `${JSON.stringify(article, null, 2)}\n`);

const indexPath = path.join(dataDir, 'index.json');
let index = { updated_at: null, updates: [] };
try { index = JSON.parse(await fs.readFile(indexPath, 'utf8')); } catch {}
index.updated_at = new Date().toISOString();
index.updates = [fileName, ...(index.updates || []).filter(file => file !== fileName)].slice(0, 52);
await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Generated ${fileName} with ${article.sources.length} sources.`);
