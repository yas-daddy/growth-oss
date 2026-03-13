// CSV Export utility for tracker tables

export interface MetricRow {
  label: string;
  values: (string | number)[];
}

export function generateCsv(headers: string[], rows: MetricRow[]): string {
  const csvRows: string[] = [];
  
  // Header row
  csvRows.push(['Metric', ...headers].map(escapeCell).join(','));
  
  // Data rows
  rows.forEach(row => {
    csvRows.push([row.label, ...row.values.map(v => v.toString())].map(escapeCell).join(','));
  });
  
  return csvRows.join('\n');
}

function escapeCell(value: string): string {
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
