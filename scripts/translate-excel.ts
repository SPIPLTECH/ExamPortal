/**
 * Builds the MARATHI Excel books for class 11/12 syllabus (no Marathi book exists for them).
 * Reads scripts/seed-data/syllabus-9-12/{11th,12th}/*.xlsx (English, NEVER modified)
 * and writes   scripts/seed-data/syllabus-9-12/{11th,12th} Marathi/*.xlsx  in the same format,
 * so the normal seed (seed-marathi / seed-exams) picks them up. No database is touched here.
 *
 *  - Q No, Image, Answer, Difficulty are copied unchanged. Question, options, chapter are translated.
 *  - Every translation is validated (options present, numbers unchanged, Devanagari present).
 *    A file is written ONLY when all its rows pass; failures are listed and can be re-run.
 *  - Resumable: validated rows are cached in scripts/.translate-cache, re-running skips them.
 *  - Images are copied next to the Marathi file (image text itself cannot be translated).
 *
 *  ANTHROPIC_API_KEY=... npx tsx scripts/translate-excel.ts --dry-run
 *  ANTHROPIC_API_KEY=... npx tsx scripts/translate-excel.ts --only "12th/Physics" --limit 10   # trial
 *  ANTHROPIC_API_KEY=... npx tsx scripts/translate-excel.ts                                    # all 18 files
 *  Options: --only <substring of "12th/Physics">  --limit N  --batch N (10)  --parallel N (4)  --dry-run
 *  Env: TRANSLATE_MODEL (default claude-sonnet-5-5)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const args = process.argv.slice(2);
const val = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const ONLY = val("only");
const LIMIT = Number(val("limit") ?? Infinity);
const BATCH = Number(val("batch") ?? 10);
const PAR = Number(val("parallel") ?? 4);
const MODEL = process.env.TRANSLATE_MODEL || "claude-sonnet-5-5";
const KEY = process.env.ANTHROPIC_API_KEY;
const ROOT = path.join(__dirname, "seed-data", "syllabus-9-12");
const CACHE = path.join(__dirname, ".translate-cache");
const DEV = /[ऀ-ॿ]/;

const SYSTEM = `You translate Maharashtra State Board class 11-12 exam questions from English to Marathi.
Rules:
- Natural, textbook-standard Marathi as in Balbharati books; use the standard Marathi terms of the subject.
- Keep numbers (Western digits as written), math symbols, formulas, chemical formulae, units, variable names, ratios, years and proper nouns exactly as in the source.
- Well known technical abbreviations (GDP, CPU, DNA, pH, SI, etc.) stay in English letters.
- Do NOT answer, hint, shorten, add or reorder. Options keep their keys A-D in the same order.
- If an option is only a number/formula/symbol/English abbreviation, return it unchanged.
Return ONLY a JSON array with one object per input: {"id": number, "chapter": string, "text": string, "options": {"A": string, "B": string, "C": string, "D": string}}.`;

type Row = { n: number; qno: unknown; chapter: string; text: string; image: unknown; opts: string[]; answer: unknown; diff: unknown };
type Tr = { id: number; chapter: string; text: string; options: Record<string, string> };

const cellStr = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text ?? "").trim();
    if ("result" in v) return String(v.result ?? "").trim();
  }
  return String(v).trim();
};
const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).sort().join("|");

function validate(r: Row, t: Tr | undefined): string | null {
  if (!t) return "missing in response";
  if (!t.text?.trim()) return "empty text";
  if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0600-\u06ff]/.test(JSON.stringify(t))) return "stray non-Marathi script characters";
  if (/[A-Za-z]{4,}/.test(r.text.replace(/\b[A-Z][A-Za-z]*\b/g, "")) && !DEV.test(t.text)) return "text has no Devanagari";
  if (nums(r.text) !== nums(t.text)) return `numbers differ (${nums(r.text)} vs ${nums(t.text)})`;
  for (let i = 0; i < 4; i++) {
    const k = "ABCD"[i]!;
    const o = t.options?.[k];
    if (!o?.trim()) return `option ${k} missing`;
    if (nums(r.opts[i]!) !== nums(o)) return `numbers differ in option ${k}`;
  }
  if (new Set("ABCD".split("").map((k) => t.options[k]!.trim())).size < new Set(r.opts.map((x) => x.trim())).size) {
    return "options collapsed (duplicates created)";
  }
  return null;
}

async function callModel(items: object[], attempt = 1): Promise<Tr[]> {
  try {
    const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content: JSON.stringify(items) }] }),
    });
    if (!res.ok) {
      if (attempt < 6 && (res.status === 429 || res.status >= 500)) throw new Error(`retry ${res.status}`);
      throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const j = (await res.json()) as { content: { type: string; text?: string }[] };
    const raw = j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("retry no JSON");
    return JSON.parse(m[0]) as Tr[];
  } catch (e) {
    const msg = (e as Error).message;
    if (attempt < 6 && (msg.startsWith("retry") || e instanceof SyntaxError)) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return callModel(items, attempt + 1);
    }
    throw e;
  }
}

async function readRows(file: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0]!;
  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const v = (i: number) => cellStr(row.getCell(i).value);
    if (!v(3)) return;
    rows.push({
      n, qno: row.getCell(1).value, chapter: v(2), text: v(3), image: row.getCell(4).value,
      opts: [v(5), v(6), v(7), v(8)], answer: row.getCell(9).value, diff: row.getCell(10).value,
    });
  });
  return rows;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

(async () => {
  const jobs: { cls: string; name: string; src: string; outDir: string }[] = [];
  for (const cls of ["11th", "12th"]) {
    for (const f of fs.readdirSync(path.join(ROOT, cls)).filter((x) => x.endsWith(".xlsx")).sort()) {
      const name = f.replace(/\.xlsx$/, "");
      if (ONLY && !`${cls}/${name}`.toLowerCase().includes(ONLY.toLowerCase())) continue;
      jobs.push({ cls, name, src: path.join(ROOT, cls, f), outDir: path.join(ROOT, `${cls} Marathi`) });
    }
  }
  fs.mkdirSync(CACHE, { recursive: true });

  if (DRY) {
    let total = 0, todo = 0;
    for (const j of jobs) {
      const rows = await readRows(j.src);
      const cf = path.join(CACHE, `${j.cls}-${j.name}.json`);
      const cached = fs.existsSync(cf) ? Object.keys(JSON.parse(fs.readFileSync(cf, "utf8"))).length : 0;
      const done = fs.existsSync(path.join(j.outDir, `${j.name}.xlsx`));
      console.log(`${j.cls}/${j.name}: ${rows.length} questions, ${cached} cached${done ? ", Marathi file exists" : ""}`);
      total += rows.length; todo += done ? 0 : Math.max(0, rows.length - cached);
    }
    console.log(`\n${jobs.length} files, ${total} questions, ${todo} still to translate (~${Math.ceil(todo / BATCH)} API calls). No API call made.`);
    return;
  }
  const NEED_KEY = true;
  if (!KEY && NEED_KEY && !args.includes("--no-api")) throw new Error("Set ANTHROPIC_API_KEY (e.g. in PowerShell:  $env:ANTHROPIC_API_KEY=\"sk-ant-...\")");

  const failedAll: string[] = [];
  for (const j of jobs) {
    const out = path.join(j.outDir, `${j.name}.xlsx`);
    if (fs.existsSync(out) && !args.includes("--force")) { console.log(`${j.cls}/${j.name}: Marathi file exists, skipped (use --force to redo)`); continue; }
    const rows = (await readRows(j.src)).slice(0, LIMIT);
    const cf = path.join(CACHE, `${j.cls}-${j.name}.json`);
    const cache: Record<string, Tr> = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, "utf8")) : {};
    const tf = path.join(__dirname, "translations-11-12", `${j.cls}-${j.name}.json`);
    if (fs.existsSync(tf)) {
      const t = JSON.parse(fs.readFileSync(tf, "utf8")) as { chapters: Record<string, string>; rows: [number, string, string, string, string, string][] };
      for (const [n, text, a, b, c, d] of t.rows) {
        const r = rows.find((x) => x.n === n + 1); // row number = Q No + 1 (header row)
        if (!r) continue;
        const tr: Tr = { id: r.n, chapter: t.chapters[r.chapter] ?? r.chapter, text, options: { A: a, B: b, C: c, D: d } };
        const err = validate(r, tr);
        if (err) console.log(`  ! ${j.cls}/${j.name} Q${n}: ${err}`); else cache[r.n] = tr;
      }
    }
    const todo = rows.filter((r) => !cache[r.n]);
    console.log(`${j.cls}/${j.name}: ${rows.length} rows, ${todo.length} to translate`);

    const batches: Row[][] = [];
    for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
    const errs = new Map<number, string>();
    const save = () => fs.writeFileSync(cf, JSON.stringify(cache));

    const run = async (group: Row[]) => {
      const items = group.map((r) => ({ id: r.n, chapter: r.chapter, text: r.text, options: { A: r.opts[0], B: r.opts[1], C: r.opts[2], D: r.opts[3] } }));
      let res: Tr[] = [];
      try { res = await callModel(items); } catch (e) { for (const r of group) errs.set(r.n, (e as Error).message); return; }
      const byId = new Map(res.map((t) => [Number(t.id), t]));
      for (const r of group) {
        const err = validate(r, byId.get(r.n));
        if (err) errs.set(r.n, err); else { cache[r.n] = byId.get(r.n)!; errs.delete(r.n); }
      }
      save();
    };
    if (KEY) await pool(batches, PAR, run);
    // second chance: failed rows one by one
    const retry = rows.filter((r) => !cache[r.n]);
    if (retry.length && KEY) { console.log(`  retrying ${retry.length} rows individually…`); await pool(retry.map((r) => [r]), PAR, run); }

    const bad = rows.filter((r) => !cache[r.n]);
    if (bad.length) {
      bad.forEach((r) => failedAll.push(`${j.cls}/${j.name} row ${r.n}: ${errs.get(r.n) ?? "failed"}`));
      console.log(`  ✗ ${bad.length} rows failed validation, file NOT written (good rows are cached; re-run to retry)`);
      continue;
    }
    if (rows.length < 100 && LIMIT !== Infinity) { console.log(`  trial run (--limit): validated ${rows.length} rows, file not written`); rows.slice(0, 3).forEach((r) => console.log(`   EN: ${r.text}\n   MR: ${cache[r.n]!.text}`)); continue; }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(j.src);          // keep the original layout/styles, then overwrite text cells
    const ws = wb.worksheets[0]!;
    for (const r of rows) {
      const t = cache[r.n]!;
      const row = ws.getRow(r.n);
      row.getCell(2).value = t.chapter?.trim() || r.chapter;
      row.getCell(3).value = t.text.trim();
      "ABCD".split("").forEach((k, i) => (row.getCell(5 + i).value = t.options[k]!.trim()));
      row.commit();
    }
    fs.mkdirSync(j.outDir, { recursive: true });
    await wb.xlsx.writeFile(out);
    const imgSrc = path.join(ROOT, j.cls, "images");
    if (fs.existsSync(imgSrc)) fs.cpSync(imgSrc, path.join(j.outDir, "images"), { recursive: true });
    console.log(`  ✓ written ${path.relative(process.cwd(), out)}`);
  }
  if (failedAll.length) { console.log("\nFAILED ROWS:\n" + failedAll.join("\n")); process.exitCode = 1; }
  else console.log("\nDone. Next: npm run seed:marathi:dry");
})();
