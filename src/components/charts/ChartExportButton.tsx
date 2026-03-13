import { useRef, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChartExportButtonProps {
  chartRef: RefObject<HTMLDivElement>;
  filename?: string;
}

export function ChartExportButton({ chartRef, filename = 'chart' }: ChartExportButtonProps) {
  const { toast } = useToast();

  const handleExport = async () => {
    if (!chartRef.current) {
      toast({
        title: 'Export failed',
        description: 'Chart element not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: 'white',
        scale: 2, // Higher resolution
        logging: false,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          toast({
            title: 'Export failed',
            description: 'Failed to generate image',
            variant: 'destructive',
          });
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Chart exported',
          description: 'PNG downloaded successfully',
        });
      }, 'image/png');
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export chart',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleExport}
      className="h-8 w-8"
      title="Download as PNG"
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
