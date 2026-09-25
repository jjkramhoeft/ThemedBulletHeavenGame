// Attribution for a Theme's third-party art, read from the CREDITS.csv its generator writes
// (columns: filename, notes, authors, licenses, urls; list fields are comma-separated inside quotes).

export interface CreditRow {
  file: string;
  notes: string;
  authors: string[];
  licenses: string[];
  urls: string[];
}

export interface CreditSummary {
  authors: string[];
  licenses: string[];
  urls: string[];
  files: number;
}

/** RFC 4180-style CSV: quoted fields, `""` escapes, commas and newlines allowed inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { quoted = true; i++; continue; }
    if (ch === ',') { row.push(field.trim()); field = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((f) => f !== '')) rows.push(row);
      row = []; field = ''; i++; continue;
    }
    field += ch; i++;
  }
  row.push(field.trim());
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export function parseCredits(text: string): CreditRow[] {
  const [header, ...rows] = parseCsv(text);
  if (!header || header[0] !== 'filename') throw new Error('CREDITS.csv must start with a "filename,notes,authors,licenses,urls" header');
  return rows.map(([file = '', notes = '', authors, licenses, urls]) => ({ file, notes, authors: list(authors), licenses: list(licenses), urls: list(urls) }));
}

/** Unique authors, licences and source links across all rows, sorted for display. */
export function summarize(rows: CreditRow[]): CreditSummary {
  const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return {
    authors: uniq(rows.flatMap((r) => r.authors)),
    licenses: uniq(rows.flatMap((r) => r.licenses)),
    urls: uniq(rows.flatMap((r) => r.urls)),
    files: rows.length,
  };
}
