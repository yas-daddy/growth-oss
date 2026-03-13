import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ElementPalette } from "./ElementPalette";
import { PropertyPanel } from "./PropertyPanel";
import { TemplatePreview } from "./TemplatePreview";
import { useAdTemplates, TemplateElement } from "@/hooks/useAdTemplates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Upload, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CANVAS_WIDTH = 1080;
const DEFAULT_CANVAS_HEIGHT = 1080;

export function TemplateEditor() {
  const { templates, createTemplate, updateTemplate, deleteTemplate, isLoading } = useAdTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("New Template");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [termsText, setTermsText] = useState("18+ | BeGambleAware.org | T&Cs Apply");
  const [ctaText, setCtaText] = useState("Bet Now");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH);
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT);
  const [isUploading, setIsUploading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load selected template
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        setTemplateName(template.name);
        setBackgroundUrl(template.background_image_url);
        setElements(template.elements as TemplateElement[]);
        setTermsText(template.terms_text || "");
        setCtaText(template.cta_text || "Bet Now");
        setDestinationUrl(template.destination_url || "");
        setCanvasWidth(template.width || DEFAULT_CANVAS_WIDTH);
        setCanvasHeight(template.height || DEFAULT_CANVAS_HEIGHT);
      }
    }
  }, [selectedTemplateId, templates]);

  const selectedElement = elements.find(e => e.id === selectedElementId);

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('football-ad-backgrounds')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('football-ad-backgrounds')
        .getPublicUrl(filePath);

      setBackgroundUrl(publicUrl);
      toast.success("Background uploaded");
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddElement = (type: TemplateElement['type']) => {
    const newElement: TemplateElement = {
      id: `element-${Date.now()}`,
      type,
      x: 100,
      y: 100,
      width: type.includes('icon') || type === 'custom_image' ? 150 : undefined,
      height: type.includes('icon') || type === 'custom_image' ? 150 : undefined,
      fontSize: type.includes('text') || type === 'match_time' || type === 'odds_display' || type === 'terms' ? 32 : undefined,
      fontColor: '#ffffff',
      text: type === 'vs_text' ? 'VS' : type === 'custom_text' ? 'Custom Text' : undefined,
      format: type === 'match_time' ? 'ddd D MMM, HH:mm' : undefined,
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  const handleUpdateElement = (id: string, updates: Partial<TemplateElement>) => {
    setElements(elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    ));
  };

  const handleDeleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  const handleElementDrag = (id: string, x: number, y: number) => {
    handleUpdateElement(id, { x, y });
  };

  const handleElementResize = (id: string, width: number, height: number) => {
    handleUpdateElement(id, { width, height });
  };

  const handleSaveTemplate = async () => {
    try {
      const templateData = {
        name: templateName,
        background_image_url: backgroundUrl,
        width: canvasWidth,
        height: canvasHeight,
        elements,
        terms_text: termsText,
        cta_text: ctaText,
        destination_url: destinationUrl,
        is_active: true,
      };

      if (selectedTemplateId) {
        await updateTemplate({ id: selectedTemplateId, ...templateData });
        toast.success("Template updated");
      } else {
        const newTemplate = await createTemplate(templateData);
        if (newTemplate) {
          setSelectedTemplateId(newTemplate.id);
          toast.success("Template created");
        }
      }
    } catch (error: any) {
      toast.error("Save failed: " + error.message);
    }
  };

  const handleNewTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateName("New Template");
    setBackgroundUrl(null);
    setElements([]);
    setSelectedElementId(null);
    setTermsText("18+ | BeGambleAware.org | T&Cs Apply");
    setCtaText("Bet Now");
    setDestinationUrl("");
    setCanvasWidth(DEFAULT_CANVAS_WIDTH);
    setCanvasHeight(DEFAULT_CANVAS_HEIGHT);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    
    if (confirm("Are you sure you want to delete this template?")) {
      await deleteTemplate(selectedTemplateId);
      handleNewTemplate();
      toast.success("Template deleted");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Panel - Element Palette */}
      <div className="lg:col-span-2">
        <ElementPalette onAddElement={handleAddElement} />
      </div>

      {/* Center - Canvas */}
      <div className="lg:col-span-7 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select 
                  value={selectedTemplateId || "new"} 
                  onValueChange={(v) => v === "new" ? handleNewTemplate() : setSelectedTemplateId(v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">+ New Template</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-[200px]"
                  placeholder="Template name"
                />
              </div>
              <div className="flex items-center gap-2">
                {selectedTemplateId && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteTemplate}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button onClick={handleSaveTemplate} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Background upload */}
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? "Uploading..." : "Upload Background"}
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Canvas:</span>
                  <Input
                    type="number"
                    value={canvasWidth}
                    onChange={(e) => setCanvasWidth(Number(e.target.value))}
                    className="w-20 h-8"
                  />
                  <span>×</span>
                  <Input
                    type="number"
                    value={canvasHeight}
                    onChange={(e) => setCanvasHeight(Number(e.target.value))}
                    className="w-20 h-8"
                  />
                </div>
              </div>

              {/* Canvas Preview */}
              <TemplatePreview
                ref={canvasRef}
                backgroundUrl={backgroundUrl}
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onDragElement={handleElementDrag}
                onResizeElement={handleElementResize}
                canvasWidth={canvasWidth}
                canvasHeight={canvasHeight}
              />
            </div>
          </CardContent>
        </Card>

        {/* Terms and CTA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Ad Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CTA Button Text</Label>
                <Input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Bet Now"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination URL</Label>
                <Input
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Terms & Conditions Text</Label>
              <Textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                placeholder="18+ | BeGambleAware.org | T&Cs Apply"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Properties */}
      <div className="lg:col-span-3">
        <PropertyPanel
          element={selectedElement}
          onUpdate={(updates) => selectedElementId && handleUpdateElement(selectedElementId, updates)}
          onDelete={() => selectedElementId && handleDeleteElement(selectedElementId)}
        />
      </div>
    </div>
  );
}
