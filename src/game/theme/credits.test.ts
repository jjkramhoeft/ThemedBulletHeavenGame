import { describe, expect, it } from 'vitest';
import { parseCredits, parseCsv, summarize } from './credits';

const CSV = [
  'filename,notes,authors,licenses,urls',
  '"body/walk.png","see ""details""","bluecarrot16,Eliza Wyatt (ElizaWy)","OGA-BY 3.0,CC-BY-SA 3.0","https://a.example,https://b.example"',
  '"hat/walk.png","","Eliza Wyatt (ElizaWy),Stephen Challener (Redshrike)","CC-BY-SA 3.0","https://a.example"',
].join('\r\n');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF and trailing newlines', () => {
    expect(parseCsv('"a","b ""c""",d\r\n"x,y",z\n\n')).toEqual([['a', 'b "c"', 'd'], ['x,y', 'z']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"line one\nline two",x')).toEqual([['line one\nline two', 'x']]);
  });
});

describe('parseCredits', () => {
  it('splits the list columns', () => {
    const [row] = parseCredits(CSV);
    expect(row).toEqual({
      file: 'body/walk.png', notes: 'see "details"',
      authors: ['bluecarrot16', 'Eliza Wyatt (ElizaWy)'], licenses: ['OGA-BY 3.0', 'CC-BY-SA 3.0'], urls: ['https://a.example', 'https://b.example'],
    });
  });

  it('rejects a file without the header', () => {
    expect(() => parseCredits('"body/walk.png","","x","y","z"')).toThrow();
  });
});

describe('summarize', () => {
  it('dedupes and sorts authors, licences and links', () => {
    expect(summarize(parseCredits(CSV))).toEqual({
      authors: ['bluecarrot16', 'Eliza Wyatt (ElizaWy)', 'Stephen Challener (Redshrike)'],
      licenses: ['CC-BY-SA 3.0', 'OGA-BY 3.0'],
      urls: ['https://a.example', 'https://b.example'],
      files: 2,
    });
  });
});
