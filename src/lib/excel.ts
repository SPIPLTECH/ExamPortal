import ExcelJS from "exceljs";
import { CATEGORIES, DIFFICULTIES, OPTION_KEYS, STREAMS } from "./constants";

/**
 * Excel question import/export.
 * Template columns (order matters for the header row):
 *   Question | Class | Difficulty | Option A | Option B | Option C | Option D |
 *   Correct Answer | Class Group | Category | Stream
 */
export const TEMPLATE_COLUMNS = [
  "Question",
  "Class",
  "Difficulty",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Answer",
  "Class Group",
  "Category",
  "Stream",
  "Image URL",
] as const;

export type NormalizedQuestion = {
  text: string;
  options: { key: string; text: string }[];
  correctOption: string;
  difficulty: string;
  class: number;
  classGroup: string | null;
  category: string;
  stream: string | null;
  imageUrl: string | null;
};

export type ParsedRow = {
  row: number; // 1-based worksheet row number
  valid: boolean;
  errors: string[];
  data?: NormalizedQuestion;
};

const CATEGORY_ALIASES: Record<string, string> = {
  SYLLABUS: "SYLLABUS",
  "AI LITERACY": "AI_LITERACY",
  AI: "AI_LITERACY",
  AI_LITERACY: "AI_LITERACY",
  "IT LITERACY": "IT_LITERACY",
  IT: "IT_LITERACY",
  IT_LITERACY: "IT_LITERACY",
};

export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Exam Portal";
  const ws = wb.addWorksheet("Questions");

  ws.columns = TEMPLATE_COLUMNS.map((c) => ({
    header: c,
    key: c,
    width: c === "Question" ? 50 : 16,
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  // Sample rows to guide the user.
  ws.addRow([
    "What does CPU stand for?",
    9,
    "Easy",
    "Central Processing Unit",
    "Computer Personal Unit",
    "Central Print Unit",
    "Control Program Unit",
    "A",
    "Computers",
    "IT Literacy",
    "",
  ]);
  ws.addRow([
    "Which is an AI application?",
    11,
    "Medium",
    "Chatbot",
    "Hammer",
    "Notebook",
    "Chair",
    "A",
    "AI Basics",
    "AI Literacy",
    "Science",
  ]);

  // Reference sheet with allowed values.
  const ref = wb.addWorksheet("Reference");
  ref.addRow(["Field", "Allowed values"]);
  ref.getRow(1).font = { bold: true };
  ref.addRow(["Class", "5 to 12"]);
  ref.addRow(["Difficulty", DIFFICULTIES.join(", ")]);
  ref.addRow(["Category", "Syllabus, AI Literacy, IT Literacy"]);
  ref.addRow(["Correct Answer", "A / B / C / D (or the exact option text)"]);
  ref.addRow(["Stream", "Science, Commerce, Arts (required for class 11-12)"]);
  ref.getColumn(1).width = 16;
  ref.getColumn(2).width = 60;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
  return String(v).trim();
}

export async function parseWorkbook(buffer: Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  // @types/node Buffer generic vs exceljs's Buffer param — cast is safe.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.getWorksheet("Questions") ?? wb.worksheets[0];
  if (!ws) throw new Error("No worksheet found in the uploaded file.");

  // Map header names → column index from the first row.
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    header[cellText(cell.value).toLowerCase()] = col;
  });

  const get = (row: ExcelJS.Row, name: string): string => {
    const col = header[name.toLowerCase()];
    return col ? cellText(row.getCell(col).value) : "";
  };

  const rows: ParsedRow[] = [];
  const lastRow = ws.rowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const text = get(row, "Question");
    // Skip fully empty rows.
    const anything = TEMPLATE_COLUMNS.some((c) => get(row, c) !== "");
    if (!anything) continue;

    rows.push(validateRow(r, {
      text,
      class: get(row, "Class"),
      difficulty: get(row, "Difficulty"),
      a: get(row, "Option A"),
      b: get(row, "Option B"),
      c: get(row, "Option C"),
      d: get(row, "Option D"),
      correct: get(row, "Correct Answer"),
      classGroup: get(row, "Class Group"),
      category: get(row, "Category"),
      stream: get(row, "Stream"),
      imageUrl: get(row, "Image URL"),
    }));
  }
  return rows;
}

type RawRow = {
  text: string;
  class: string;
  difficulty: string;
  a: string;
  b: string;
  c: string;
  d: string;
  correct: string;
  classGroup: string;
  category: string;
  stream: string;
  imageUrl: string;
};

export function validateRow(rowNum: number, raw: RawRow): ParsedRow {
  const errors: string[] = [];

  if (!raw.text || raw.text.length < 5) errors.push("Question text is required (min 5 chars)");

  const cls = Number(raw.class);
  if (!Number.isInteger(cls) || cls < 5 || cls > 12) errors.push("Class must be 5-12");

  const difficulty = raw.difficulty.toUpperCase();
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty))
    errors.push(`Difficulty must be one of ${DIFFICULTIES.join("/")}`);

  const optionTexts = [raw.a, raw.b, raw.c, raw.d];
  const presentOptions = optionTexts
    .map((t, i) => ({ key: OPTION_KEYS[i], text: t }))
    .filter((o) => o.text !== "");
  if (presentOptions.length < 2) errors.push("At least 2 options required");

  // Correct answer: letter or exact text match.
  let correctKey = "";
  const correctRaw = raw.correct.trim();
  const asLetter = correctRaw.toUpperCase();
  if (presentOptions.find((o) => o.key === asLetter)) {
    correctKey = asLetter;
  } else {
    const byText = presentOptions.find(
      (o) => o.text.toLowerCase() === correctRaw.toLowerCase()
    );
    if (byText) correctKey = byText.key;
  }
  if (!correctKey) errors.push("Correct Answer must be a valid option letter (A-D) or match an option's text");

  const category = CATEGORY_ALIASES[raw.category.toUpperCase().replace(/[_-]/g, " ").trim()]
    ?? CATEGORY_ALIASES[raw.category.toUpperCase().trim()];
  if (!category || !(CATEGORIES as readonly string[]).includes(category))
    errors.push("Category must be Syllabus, AI Literacy or IT Literacy");

  let stream: string | null = null;
  if (raw.stream) {
    const s = raw.stream.toUpperCase();
    if (!(STREAMS as readonly string[]).includes(s)) errors.push("Stream must be Science, Commerce or Arts");
    else stream = s;
  }
  if (cls >= 11 && !stream) errors.push("Stream is required for class 11-12");

  if (errors.length > 0) return { row: rowNum, valid: false, errors };

  return {
    row: rowNum,
    valid: true,
    errors: [],
    data: {
      text: raw.text,
      options: presentOptions,
      correctOption: correctKey,
      difficulty,
      class: cls,
      classGroup: raw.classGroup || null,
      category: category!,
      stream: cls >= 11 ? stream : null,
      imageUrl: raw.imageUrl?.trim() ? raw.imageUrl.trim() : null,
    },
  };
}

// ─── Image-format import (Q No | Chapter | Question | Image | Option A-D | Answer | Difficulty) ───

export const IMAGE_TEMPLATE_COLUMNS = [
  "Q No",
  "Chapter",
  "Question",
  "Image",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Answer",
  "Difficulty",
] as const;

export async function buildImageTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Exam Portal";
  const ws = wb.addWorksheet("Questions");
  ws.columns = IMAGE_TEMPLATE_COLUMNS.map((c) => ({
    header: c,
    key: c,
    width: c === "Question" ? 46 : c === "Chapter" ? 22 : 16,
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.addRow([1, "1. Roman Numerals", "Which Roman numeral represents 9?", "", "XI", "IX", "VIIII", "IXX", "B", "Easy"]);
  ws.addRow([2, "1. Roman Numerals", "Which is NOT a Roman numeral symbol?", "https://example.com/q.png", "B", "X", "V", "L", "A", "Easy"]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Parse the image-format workbook. Class/stream are taken from the test, not the sheet. */
export async function parseImageWorkbook(buffer: Buffer): Promise<ParsedRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.getWorksheet("Questions") ?? wb.worksheets[0];
  if (!ws) throw new Error("No worksheet found in the uploaded file.");

  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    header[cellText(cell.value).toLowerCase()] = col;
  });
  const get = (row: ExcelJS.Row, name: string): string => {
    const col = header[name.toLowerCase()];
    return col ? cellText(row.getCell(col).value) : "";
  };

  const rows: ParsedRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const anything = IMAGE_TEMPLATE_COLUMNS.some((c) => get(row, c) !== "");
    if (!anything) continue;
    rows.push(validateImageRow(r, {
      question: get(row, "Question"),
      chapter: get(row, "Chapter"),
      image: get(row, "Image"),
      a: get(row, "Option A"),
      b: get(row, "Option B"),
      c: get(row, "Option C"),
      d: get(row, "Option D"),
      answer: get(row, "Answer"),
      difficulty: get(row, "Difficulty"),
    }));
  }
  return rows;
}

function validateImageRow(
  rowNum: number,
  raw: { question: string; chapter: string; image: string; a: string; b: string; c: string; d: string; answer: string; difficulty: string }
): ParsedRow {
  const errors: string[] = [];
  if (!raw.question || raw.question.length < 3) errors.push("Question text is required");

  const difficulty = (raw.difficulty || "MEDIUM").toUpperCase();
  const diff = (DIFFICULTIES as readonly string[]).includes(difficulty) ? difficulty : "MEDIUM";

  const optionTexts = [raw.a, raw.b, raw.c, raw.d];
  const presentOptions = optionTexts
    .map((t, i) => ({ key: OPTION_KEYS[i], text: t }))
    .filter((o) => o.text !== "");
  if (presentOptions.length < 2) errors.push("At least 2 options required");

  let correctKey = "";
  const asLetter = raw.answer.trim().toUpperCase();
  if (presentOptions.find((o) => o.key === asLetter)) correctKey = asLetter;
  else {
    const byText = presentOptions.find((o) => o.text.toLowerCase() === raw.answer.trim().toLowerCase());
    if (byText) correctKey = byText.key;
  }
  if (!correctKey) errors.push("Answer must be a valid option letter (A-D) or match an option");

  if (errors.length > 0) return { row: rowNum, valid: false, errors };

  return {
    row: rowNum,
    valid: true,
    errors: [],
    data: {
      text: raw.question,
      options: presentOptions,
      correctOption: correctKey,
      difficulty: diff,
      class: 0, // set from the test on commit
      classGroup: raw.chapter || null,
      category: "SYLLABUS",
      stream: null,
      imageUrl: raw.image?.trim() ? raw.image.trim() : null,
    },
  };
}
