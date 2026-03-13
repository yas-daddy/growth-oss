import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MonthlyMetric, formatMonthLabel } from '@/hooks/useMonthlyMetrics';

interface MonthlySummaryExportButtonProps {
  metrics: MonthlyMetric[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyDecimal(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.round(value));
}

function getChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function MonthlySummaryExportButton({ metrics }: MonthlySummaryExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Create an off-screen container with dark styling
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.backgroundColor = '#0a0a0b';
      container.style.padding = '32px';
      container.style.borderRadius = '16px';
      container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      container.style.color = '#fafafa';
      container.style.width = 'fit-content';
      
      // Build the table HTML
      const monthHeaders = metrics.map(m => formatMonthLabel(m.month_start)).join('');
      
      const rows = [
        { 
          label: 'Installs', 
          getValue: (m: MonthlyMetric) => m.total_installs, 
          format: formatNumber,
          invertColors: false 
        },
        { 
          label: 'FTDs', 
          getValue: (m: MonthlyMetric) => m.total_ftds, 
          format: formatNumber,
          invertColors: false 
        },
        { 
          label: 'STDs', 
          getValue: (m: MonthlyMetric) => m.total_stds, 
          format: formatNumber,
          invertColors: false 
        },
        { 
          label: 'Cost per FTD', 
          getValue: (m: MonthlyMetric) => m.blended_cpa, 
          format: formatCurrency,
          invertColors: true 
        },
        { 
          label: 'Net Deposit per New User', 
          getValue: (m: MonthlyMetric) => m.total_ftds > 0 ? m.new_users_net_deposits / m.total_ftds : 0, 
          format: formatCurrencyDecimal,
          invertColors: false 
        },
      ];
      
      const buildRowHtml = (row: typeof rows[0]) => {
        const cells = metrics.map((m, idx) => {
          const value = row.getValue(m);
          const formatted = row.format(value);
          const change = idx < metrics.length - 1 
            ? getChange(value, row.getValue(metrics[idx + 1])) 
            : null;
          
          const hasChange = change !== null && isFinite(change);
          const isPositive = change !== null && change >= 0;
          const colorStyle = row.invertColors 
            ? (isPositive ? 'color: #ef4444;' : 'color: #22c55e;')
            : (isPositive ? 'color: #22c55e;' : 'color: #ef4444;');
          
          const changeHtml = hasChange 
            ? `<div style="font-size: 12px; margin-top: 4px; ${colorStyle}">${isPositive ? '+' : ''}${Math.round(change)}%</div>` 
            : '';
          
          return `<td style="padding: 16px 24px; text-align: center; font-size: 16px; border-bottom: 1px solid #27272a;">
            <div style="font-weight: 500;">${formatted}</div>
            ${changeHtml}
          </td>`;
        }).join('');
        
        return `<tr>
          <td style="padding: 16px 24px; font-weight: 600; font-size: 15px; border-bottom: 1px solid #27272a; white-space: nowrap;">${row.label}</td>
          ${cells}
        </tr>`;
      };
      
      container.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 6px 0; color: #fafafa;">Monthly Summary</h2>
          <p style="font-size: 14px; color: #a1a1aa; margin: 0;">Key metrics by month with MoM comparison</p>
        </div>
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="border-bottom: 2px solid #3f3f46;">
              <th style="padding: 12px 24px; text-align: left; font-size: 14px; font-weight: 600; color: #a1a1aa;">Metric</th>
              ${metrics.map(m => `<th style="padding: 12px 24px; text-align: center; font-size: 14px; font-weight: 600; color: #a1a1aa;">${formatMonthLabel(m.month_start)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(buildRowHtml).join('')}
          </tbody>
        </table>
        <div style="margin-top: 16px; font-size: 11px; color: #71717a; text-align: right;">
          Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      `;
      
      document.body.appendChild(container);
      
      const canvas = await html2canvas(container, {
        backgroundColor: '#0a0a0b',
        scale: 2,
        logging: false,
      });
      
      document.body.removeChild(container);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `monthly-summary-${new Date().toISOString().split('T')[0]}.png`;
          link.click();
          URL.revokeObjectURL(url);
          toast.success('Monthly summary exported as PNG');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Failed to export image');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Export PNG
    </Button>
  );
}
