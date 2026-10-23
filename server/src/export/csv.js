// Spreadsheets treat a cell starting with one of these as a formula, which a story title
// could use to run commands or leak data when the file is opened (CSV injection, T-12).
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

// Every field is quoted, so commas, quotes, and newlines inside a title stay in one cell.
export function toCsv(rows) {
  return rows.map((row) => `${row.map(cell).join(",")}\r\n`).join("");
}
