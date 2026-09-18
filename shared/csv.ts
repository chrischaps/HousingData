/**
 * Minimal RFC 4180 helpers shared by the data pipeline and the app.
 *
 * Zillow's Metro and CountyName columns routinely contain commas
 * ("New York-Newark-Jersey City, NY-NJ-PA"), so any field written or read
 * without quote handling silently shifts every later column by one.
 */

/** Quote a field if it contains a comma, quote, or line break. */
export function quoteCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Join fields into one CSV line, quoting where required. */
export function toCsvLine(fields: readonly string[]): string {
  return fields.map(quoteCsvField).join(',');
}

/** Split one CSV line into fields, honouring quotes and doubled quotes. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
