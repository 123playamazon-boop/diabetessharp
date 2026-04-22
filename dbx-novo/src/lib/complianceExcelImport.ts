import * as XLSX from "xlsx";

/** Converts the first sheet to CSV text (one row per line) for compliance checking. */
export function listingTextFromExcelArrayBuffer(buf: ArrayBuffer): string {
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return "";
  const sheet = wb.Sheets[name];
  if (!sheet) return "";
  return XLSX.utils.sheet_to_csv(sheet).trim();
}
