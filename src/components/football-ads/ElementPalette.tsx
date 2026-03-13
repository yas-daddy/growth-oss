import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Clock, 
  Type, 
  Image, 
  FileText, 
  TrendingUp 
} from "lucide-react";
import { TemplateElement } from "@/hooks/useAdTemplates";

interface ElementPaletteProps {
  onAddElement: (type: TemplateElement['type']) => void;
}

const elementTypes: { type: TemplateElement['type']; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    type: 'home_team_icon', 
    label: 'Home Team', 
    icon: <Shield className="h-4 w-4" />,
    description: 'Home team icon placeholder'
  },
  { 
    type: 'away_team_icon', 
    label: 'Away Team', 
    icon: <Shield className="h-4 w-4 rotate-180" />,
    description: 'Away team icon placeholder'
  },
  { 
    type: 'match_time', 
    label: 'Match Time', 
    icon: <Clock className="h-4 w-4" />,
    description: 'Match date and kickoff time'
  },
  { 
    type: 'vs_text', 
    label: 'VS Text', 
    icon: <Type className="h-4 w-4" />,
    description: '"VS" separator text'
  },
  { 
    type: 'odds_display', 
    label: 'Odds', 
    icon: <TrendingUp className="h-4 w-4" />,
    description: 'Betting odds display'
  },
  { 
    type: 'custom_image', 
    label: 'Custom Image', 
    icon: <Image className="h-4 w-4" />,
    description: 'Upload custom image'
  },
  { 
    type: 'custom_text', 
    label: 'Custom Text', 
    icon: <Type className="h-4 w-4" />,
    description: 'Static text element'
  },
  { 
    type: 'terms', 
    label: 'Terms', 
    icon: <FileText className="h-4 w-4" />,
    description: 'T&C disclaimer text'
  },
];

export function ElementPalette({ onAddElement }: ElementPaletteProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Elements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {elementTypes.map(({ type, label, icon, description }) => (
          <Button
            key={type}
            variant="outline"
            className="w-full justify-start h-auto py-2"
            onClick={() => onAddElement(type)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 text-muted-foreground">
                {icon}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
