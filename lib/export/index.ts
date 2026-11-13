/**
 * Convert an array of objects into an RFC 4180 compliant CSV string and trigger browser download.
 */
export function generateCsvContent<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; header: string }>
): string {
  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

export function downloadCsvFile<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: Array<{ key: keyof T; header: string }>
): void {
  const csv = generateCsvContent(rows, columns);
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
