import XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import {
  Script,
  Category,
  Goal,
  ScriptStatus,
} from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExportPayload {
  scripts: Script[];
  categories: Category[];
  goals: Goal[];
}

export interface SampleExcelOptions {
  categories: Category[];
  goals: Goal[];
}

export interface ParsedImportData {
  scripts: Partial<Script>[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: ParsedImportData;
  count: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STATUSES: ScriptStatus[] = ['not_started', 'in_progress', 'completed'];

/**
 * Excel stores dates as serial numbers (days since 1899-12-30).
 * This converts an Excel serial number to a JS Date.
 */
function excelSerialToDate(serial: number): Date {
  // Excel epoch is 1899-12-30 (accounting for the Lotus 1-2-3 leap year bug)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(excelEpoch.getTime() + serial * 86400000);
}

/**
 * Parse a cell value into a Date, handling:
 *   - JS Date objects (from cellDates:true)
 *   - Excel serial numbers (raw numbers)
 *   - ISO / human-readable date strings
 */
function parseDateValue(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'number') {
    // Likely an Excel serial date number
    if (v > 1 && v < 2958466) { // reasonable Excel date range (year 1900–9999)
      return excelSerialToDate(v);
    }
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isValidDate(v: unknown): boolean {
  return parseDateValue(v) !== null;
}

function toISODateOrNull(v: unknown): string | null {
  const d = parseDateValue(v);
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

function sanitizeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportToExcel(payload: ExportPayload): string {
  const { scripts, categories, goals } = payload;

  // Build lookups for readable names
  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const goalMap = new Map(goals.map(g => [g.id, g.title]));

  // Single Scripts sheet with all columns
  const scriptsData = scripts.map(s => ({
    Title: s.title,
    Notes: s.notes,
    Reference: s.reference ?? '',
    Status: s.status,
    Categories: s.categoryIds.map(id => catMap.get(id) ?? id).join(', '),
    Goal: s.goalId ? (goalMap.get(s.goalId) ?? '') : '',
    Deadline: s.deadline ?? '',
    'Voice Notes': s.voiceNotes?.length ?? 0,
    'Attached Files': s.attachedFiles?.length ?? 0,
    Created: s.createdAt,
    Modified: s.modifiedAt,
  }));

  // Build workbook with a single sheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    scriptsData.length ? scriptsData : [{ Title: '', Notes: '', Reference: '', Status: '', Categories: '', Goal: '', Deadline: '', 'Voice Notes': 0, 'Attached Files': 0, Created: '', Modified: '' }],
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Scripts');

  // Write to base64
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  // Save to cache
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `ScriptVault_Export_${timestamp}.xlsx`;
  const file = new File(Paths.cache, fileName);

  // Decode base64 to Uint8Array
  const binaryStr = atob(wbout);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  file.write(bytes);

  return file.uri;
}

// ── Sample Template (uses ExcelJS for real data validations) ─────────────────

export async function generateSampleExcel(options: SampleExcelOptions): Promise<string> {
  // Dynamic import to avoid bundling ExcelJS in regular export/import flows
  const ExcelJS = require('exceljs');

  const { categories, goals } = options;

  const statusValues = ['not_started', 'in_progress', 'completed'];
  const categoryNames = categories.map((c: Category) => c.name);
  const goalTitles = goals.map((g: Goal) => g.title);

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // ── Create workbook & sheets ──
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ScriptVault';
  workbook.created = today;

  const sheet = workbook.addWorksheet('Scripts');

  // ── Define columns with proper widths ──
  sheet.columns = [
    { header: 'Title',      key: 'title',      width: 28 },
    { header: 'Notes',      key: 'notes',      width: 42 },
    { header: 'Reference',  key: 'reference',  width: 26 },
    { header: 'Status',     key: 'status',     width: 16 },
    { header: 'Categories', key: 'categories', width: 26 },
    { header: 'Goal',       key: 'goal',       width: 22 },
    { header: 'Deadline',   key: 'deadline',   width: 16 },
    { header: 'Created',    key: 'created',    width: 16 },
    { header: 'Modified',   key: 'modified',   width: 16 },
  ];

  // ── Style the header row ──
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3B82F6' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // ── Add 2 sample rows ──
  sheet.addRow({
    title: 'My First Script',
    notes: 'Write your script notes here...',
    reference: 'https://example.com',
    status: 'not_started',
    categories: categoryNames.length > 0 ? categoryNames[0] : 'Work',
    goal: goalTitles.length > 0 ? goalTitles[0] : '',
    deadline: nextWeek,
    created: today,
    modified: today,
  });

  sheet.addRow({
    title: 'Sample Completed Script',
    notes: 'This script is already done.',
    reference: '',
    status: 'completed',
    categories: categoryNames.length > 1
      ? `${categoryNames[0]}, ${categoryNames[1]}`
      : categoryNames.length > 0
        ? categoryNames[0]
        : 'Personal',
    goal: goalTitles.length > 0 ? goalTitles[0] : '',
    deadline: today,
    created: today,
    modified: today,
  });

  // ── Apply date number format to date columns (Deadline=G, Created=H, Modified=I) ──
  const dateColKeys = ['deadline', 'created', 'modified'];
  for (const key of dateColKeys) {
    const col = sheet.getColumn(key);
    col.numFmt = 'yyyy-mm-dd';
  }

  // ── Apply data validations for rows 2..100 ──
  // (Rows 2 onward = data rows; row 1 is header)
  const LAST_ROW = 100;

  for (let row = 2; row <= LAST_ROW; row++) {
    // Status dropdown (column D)
    sheet.getCell(`D${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${statusValues.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Invalid Status',
      error: 'Please choose: not_started, in_progress, or completed',
      errorStyle: 'warning',
    };

    // Categories dropdown (column E) — only if categories exist
    if (categoryNames.length > 0) {
      sheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${categoryNames.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Unknown Category',
        error: 'Choose from your categories or type a comma-separated list.',
        errorStyle: 'warning',
      };
    }

    // Goal dropdown (column F) — only if goals exist
    if (goalTitles.length > 0) {
      sheet.getCell(`F${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${goalTitles.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Unknown Goal',
        error: 'Choose from your existing goals.',
        errorStyle: 'warning',
      };
    }

    // Date validation for Deadline (G), Created (H), Modified (I)
    for (const col of ['G', 'H', 'I']) {
      sheet.getCell(`${col}${row}`).dataValidation = {
        type: 'date',
        allowBlank: true,
        operator: 'greaterThan',
        formulae: [new Date(1900, 0, 1)],
        showErrorMessage: true,
        errorTitle: 'Invalid Date',
        error: 'Please enter a valid date (YYYY-MM-DD format).',
        errorStyle: 'warning',
      };
      // Ensure date format on empty cells too
      sheet.getCell(`${col}${row}`).numFmt = 'yyyy-mm-dd';
    }
  }

  // ── Write to buffer then save to cache ──
  const buffer: ArrayBuffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);

  const fileName = 'ScriptVault_Sample_Template.xlsx';
  const file = new File(Paths.cache, fileName);
  file.write(bytes);

  return file.uri;
}


// ── Import validation (Scripts only) ─────────────────────────────────────────
// Required columns: Title, Notes, Status
// Optional columns: Reference, Categories, Goal, Deadline, Voice Notes, Attached Files, Created, Modified

export async function validateExcelFile(
  fileUri: string,
  existingScripts: Script[],
  existingCategories: Category[] = [],
  existingGoals: Goal[] = [],
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const result: ParsedImportData = { scripts: [] };

  try {
    // Read file as base64
    const srcFile = new File(fileUri);
    const base64 = await srcFile.base64();

    // Parse workbook
    const wb = XLSX.read(base64, { type: 'base64', cellDates: true });

    // Use the first sheet regardless of its name
    if (wb.SheetNames.length === 0) {
      errors.push('Excel file has no sheets.');
      return { valid: false, errors, warnings, data: result, count: 0 };
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) {
      errors.push('The sheet is empty — no rows found.');
      return { valid: false, errors, warnings, data: result, count: 0 };
    }

    // Validate header has at least Title column
    const firstRowKeys = Object.keys(rows[0]);
    if (!firstRowKeys.some(k => k.toLowerCase() === 'title')) {
      errors.push('Missing required "Title" column. The sheet must have at least Title, Notes, and Status columns.');
      return { valid: false, errors, warnings, data: result, count: 0 };
    }

    // Build lookup: category name (lowered) → category id
    const catNameToId = new Map(
      existingCategories.map(c => [c.name.toLowerCase().trim(), c.id]),
    );

    // Build lookup: goal title (lowered) → goal id
    const goalTitleToId = new Map(
      existingGoals.map(g => [g.title.toLowerCase().trim(), g.id]),
    );

    // Existing title set for duplicate detection
    const existingTitles = new Set(existingScripts.map(s => s.title.toLowerCase()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      const title = sanitizeString(row['Title']);
      const notes = sanitizeString(row['Notes']);
      const reference = sanitizeString(row['Reference']);
      const statusRaw = sanitizeString(row['Status']).toLowerCase();
      const deadline = row['Deadline']; // keep raw value for date parsing

      // ── Required: Title
      if (!title) {
        errors.push(`Row ${rowNum}: "Title" is required.`);
        continue;
      }

      // ── Required: Notes (allow empty, just warn)
      // Notes can be empty — no error

      // ── Status validation (defaults to not_started if empty)
      const status = (statusRaw || 'not_started') as ScriptStatus;
      if (statusRaw && !VALID_STATUSES.includes(status)) {
        errors.push(`Row ${rowNum}: Status "${statusRaw}" is invalid. Must be one of: ${VALID_STATUSES.join(', ')}.`);
        continue;
      }

      // ── Optional: Deadline
      if (deadline && !isValidDate(deadline)) {
        errors.push(`Row ${rowNum}: Deadline "${deadline}" is not a valid date.`);
        continue;
      }

      // ── Duplicate check
      if (existingTitles.has(title.toLowerCase())) {
        warnings.push(`Row ${rowNum}: "${title}" already exists — will be skipped.`);
        continue;
      }

      // Add to dedup set to catch duplicates within the import file
      existingTitles.add(title.toLowerCase());

      // ── Map category names → IDs
      const categoriesRaw = sanitizeString(row['Categories']);
      const categoryIds: string[] = [];
      if (categoriesRaw) {
        const names = categoriesRaw.split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
        for (const name of names) {
          const id = catNameToId.get(name);
          if (id) {
            categoryIds.push(id);
          } else {
            warnings.push(`Row ${rowNum}: Category "${name}" not found — skipped.`);
          }
        }
      }

      // ── Map goal title → ID
      const goalRaw = sanitizeString(row['Goal']);
      let goalId: string | undefined;
      if (goalRaw) {
        const id = goalTitleToId.get(goalRaw.toLowerCase());
        if (id) {
          goalId = id;
        } else {
          warnings.push(`Row ${rowNum}: Goal "${goalRaw}" not found — skipped.`);
        }
      }

      result.scripts.push({
        title,
        notes,
        reference,
        status,
        deadline: toISODateOrNull(deadline),
        categoryIds,
        goalId,
        voiceNotes: [],
        videoNotes: [],
        attachedFiles: [],
      });
    }
  } catch (e: any) {
    errors.push(`Failed to read Excel file: ${e.message ?? 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: result,
    count: result.scripts.length,
  };
}
