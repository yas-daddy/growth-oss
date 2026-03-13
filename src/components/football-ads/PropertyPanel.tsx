import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplateElement } from "@/hooks/useAdTemplates";
import { Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropertyPanelProps {
  element: TemplateElement | undefined;
  onUpdate: (updates: Partial<TemplateElement>) => void;
  onDelete: () => void;
}

export function PropertyPanel({ element, onUpdate, onDelete }: PropertyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!element) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select an element to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `custom-${Date.now()}.${fileExt}`;
      const filePath = `custom-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('football-ad-backgrounds')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('football-ad-backgrounds')
        .getPublicUrl(filePath);

      onUpdate({ imageUrl: publicUrl });
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const getElementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      home_team_icon: 'Home Team Icon',
      away_team_icon: 'Away Team Icon',
      match_time: 'Match Time',
      vs_text: 'VS Text',
      odds_display: 'Odds Display',
      custom_image: 'Custom Image',
      custom_text: 'Custom Text',
      terms: 'Terms & Conditions',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{getElementTypeLabel(element.type)}</CardTitle>
          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">X Position</Label>
            <Input
              type="number"
              value={element.x}
              onChange={(e) => onUpdate({ x: Number(e.target.value) })}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Y Position</Label>
            <Input
              type="number"
              value={element.y}
              onChange={(e) => onUpdate({ y: Number(e.target.value) })}
              className="h-8"
            />
          </div>
        </div>

        {/* Size (for icons and images) */}
        {(element.type.includes('icon') || element.type === 'custom_image') && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={element.width || 150}
                onChange={(e) => onUpdate({ width: Number(e.target.value) })}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={element.height || 150}
                onChange={(e) => onUpdate({ height: Number(e.target.value) })}
                className="h-8"
              />
            </div>
          </div>
        )}

        {/* Font settings (for text elements) */}
        {(element.type === 'match_time' || element.type === 'vs_text' || 
          element.type === 'odds_display' || element.type === 'custom_text' || 
          element.type === 'terms') && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={element.fontSize || 32}
                  onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Font Color</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={element.fontColor || '#ffffff'}
                    onChange={(e) => onUpdate({ fontColor: e.target.value })}
                    className="h-8 w-12 p-0.5 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={element.fontColor || '#ffffff'}
                    onChange={(e) => onUpdate({ fontColor: e.target.value })}
                    className="h-8 flex-1"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Text content */}
        {(element.type === 'vs_text' || element.type === 'custom_text') && (
          <div className="space-y-1">
            <Label className="text-xs">Text</Label>
            <Input
              value={element.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              className="h-8"
            />
          </div>
        )}

        {/* Date format */}
        {element.type === 'match_time' && (
          <div className="space-y-1">
            <Label className="text-xs">Date Format</Label>
            <Input
              value={element.format || 'ddd D MMM, HH:mm'}
              onChange={(e) => onUpdate({ format: e.target.value })}
              className="h-8"
              placeholder="ddd D MMM, HH:mm"
            />
            <p className="text-xs text-muted-foreground">
              e.g., "Sat 15 Feb, 15:00"
            </p>
          </div>
        )}

        {/* Custom image upload */}
        {element.type === 'custom_image' && (
          <div className="space-y-2">
            <Label className="text-xs">Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload Image"}
            </Button>
            {element.imageUrl && (
              <img 
                src={element.imageUrl} 
                alt="Custom" 
                className="w-full h-20 object-contain rounded border"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
