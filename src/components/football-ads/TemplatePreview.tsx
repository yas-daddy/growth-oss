import { forwardRef, useState, useCallback, useRef, useEffect } from "react";
import { TemplateElement } from "@/hooks/useAdTemplates";
import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  backgroundUrl: string | null;
  elements: TemplateElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onDragElement: (id: string, x: number, y: number) => void;
  onResizeElement?: (id: string, width: number, height: number) => void;
  canvasWidth: number;
  canvasHeight: number;
}

// Sample data for preview
const SAMPLE_DATA = {
  homeTeam: { name: 'Arsenal', shortName: 'ARS' },
  awayTeam: { name: 'Chelsea', shortName: 'CHE' },
  matchDate: new Date('2025-02-15T15:00:00'),
  homeOdds: 2.10,
  drawOdds: 3.40,
  awayOdds: 3.20,
};

export const TemplatePreview = forwardRef<HTMLDivElement, TemplatePreviewProps>(
  ({ backgroundUrl, elements, selectedElementId, onSelectElement, onDragElement, onResizeElement, canvasWidth, canvasHeight }, ref) => {
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizing, setResizing] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate scale to fit preview in container
    const maxPreviewWidth = 600;
    const scale = Math.min(1, maxPreviewWidth / canvasWidth);

    const handleMouseDown = (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      const element = elements.find(el => el.id === elementId);
      if (!element) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = (e.clientX - rect.left) / scale;
      const mouseY = (e.clientY - rect.top) / scale;

      setDragOffset({
        x: mouseX - element.x,
        y: mouseY - element.y,
      });
      setDragging(elementId);
      onSelectElement(elementId);
    };

    const handleResizeStart = (e: React.MouseEvent, elementId: string) => {
      e.stopPropagation();
      e.preventDefault();
      const element = elements.find(el => el.id === elementId);
      if (!element) return;

      setResizing(elementId);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: element.width || 150,
        height: element.height || 150,
      });
      onSelectElement(elementId);
    };

    // Window-level event listeners for smooth drag/resize
    useEffect(() => {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (dragging) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;

          const mouseX = (e.clientX - rect.left) / scale;
          const mouseY = (e.clientY - rect.top) / scale;

          const newX = Math.max(0, Math.min(canvasWidth - 50, mouseX - dragOffset.x));
          const newY = Math.max(0, Math.min(canvasHeight - 50, mouseY - dragOffset.y));

          onDragElement(dragging, Math.round(newX), Math.round(newY));
        }

        if (resizing && onResizeElement) {
          const deltaX = (e.clientX - resizeStart.x) / scale;
          const deltaY = (e.clientY - resizeStart.y) / scale;

          const newWidth = Math.max(30, Math.round(resizeStart.width + deltaX));
          const newHeight = Math.max(30, Math.round(resizeStart.height + deltaY));

          onResizeElement(resizing, newWidth, newHeight);
        }
      };

      const handleGlobalMouseUp = () => {
        setDragging(null);
        setResizing(null);
      };

      if (dragging || resizing) {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
      }

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }, [dragging, resizing, dragOffset, resizeStart, scale, canvasWidth, canvasHeight, onDragElement, onResizeElement]);

    const renderResizeHandle = (elementId: string, isSelected: boolean) => {
      if (!isSelected) return null;
      
      return (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary border-2 border-background rounded-sm cursor-se-resize z-10 hover:bg-primary/80 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, elementId)}
        />
      );
    };

    const renderElement = (element: TemplateElement) => {
      const isSelected = selectedElementId === element.id;
      const isDragging = dragging === element.id;
      const isResizingThis = resizing === element.id;
      
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: element.x,
        top: element.y,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging || isResizingThis ? 'none' : 'opacity 0.15s',
      };

      const selectedClass = isSelected 
        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
        : 'hover:ring-1 hover:ring-primary/50';

      const isResizable = element.type === 'home_team_icon' || element.type === 'away_team_icon' || element.type === 'custom_image';

      switch (element.type) {
        case 'home_team_icon':
        case 'away_team_icon':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                width: element.width || 150,
                height: element.height || 150,
              }}
              className={cn(
                "relative bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center",
                selectedClass
              )}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs text-muted-foreground font-medium">
                {element.type === 'home_team_icon' ? 'HOME' : 'AWAY'}
              </span>
              {renderResizeHandle(element.id, isSelected)}
            </div>
          );

        case 'match_time':
          const formattedDate = SAMPLE_DATA.matchDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }) + ', ' + SAMPLE_DATA.matchDate.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                fontSize: element.fontSize || 32,
                color: element.fontColor || '#ffffff',
              }}
              className={cn("font-bold whitespace-nowrap px-2 py-1 rounded", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {formattedDate}
            </div>
          );

        case 'vs_text':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                fontSize: element.fontSize || 64,
                color: element.fontColor || '#ffffff',
              }}
              className={cn("font-bold px-2 py-1 rounded", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {element.text || 'VS'}
            </div>
          );

        case 'odds_display':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                fontSize: element.fontSize || 24,
                color: element.fontColor || '#ffffff',
              }}
              className={cn("font-semibold px-2 py-1 rounded flex gap-4", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <span>{SAMPLE_DATA.homeOdds.toFixed(2)}</span>
              <span>{SAMPLE_DATA.drawOdds.toFixed(2)}</span>
              <span>{SAMPLE_DATA.awayOdds.toFixed(2)}</span>
            </div>
          );

        case 'custom_image':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                width: element.width || 150,
                height: element.height || 150,
              }}
              className={cn("relative rounded overflow-hidden", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {element.imageUrl ? (
                <img 
                  src={element.imageUrl} 
                  alt="Custom" 
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Image</span>
                </div>
              )}
              {renderResizeHandle(element.id, isSelected)}
            </div>
          );

        case 'custom_text':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                fontSize: element.fontSize || 24,
                color: element.fontColor || '#ffffff',
              }}
              className={cn("font-medium px-2 py-1 rounded whitespace-nowrap", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {element.text || 'Custom Text'}
            </div>
          );

        case 'terms':
          return (
            <div
              key={element.id}
              style={{
                ...baseStyle,
                fontSize: element.fontSize || 12,
                color: element.fontColor || '#cccccc',
              }}
              className={cn("px-2 py-1 rounded max-w-[80%]", selectedClass)}
              onMouseDown={(e) => handleMouseDown(e, element.id)}
              onClick={(e) => e.stopPropagation()}
            >
              18+ | BeGambleAware.org | T&Cs Apply
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div 
        ref={ref}
        className="overflow-auto border rounded-lg bg-muted/20"
        style={{ maxWidth: '100%' }}
      >
        <div
          ref={containerRef}
          style={{
            width: canvasWidth * scale,
            height: canvasHeight * scale,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <div
            className="relative bg-gray-900"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={() => onSelectElement(null)}
          >
            {!backgroundUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-muted-foreground text-sm">
                  Upload a background image
                </span>
              </div>
            )}
            {elements.map(renderElement)}
          </div>
        </div>
      </div>
    );
  }
);

TemplatePreview.displayName = "TemplatePreview";
