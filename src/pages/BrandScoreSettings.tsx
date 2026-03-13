import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Brain, Eye, Radio, Shield, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useBrandScoreExplanations, useUpdateBrandScoreExplanation } from "@/hooks/useBrandScoreExplanations";

const componentIcons: Record<string, React.ReactNode> = {
  memorability: <Brain className="h-5 w-5" />,
  visibility: <Eye className="h-5 w-5" />,
  reach: <Radio className="h-5 w-5" />,
  trust: <Shield className="h-5 w-5" />,
  community: <UsersRound className="h-5 w-5" />,
};

const componentOrder = ["trust", "visibility", "reach", "memorability", "community"];

export default function BrandScoreSettings() {
  const { data: explanations, isLoading } = useBrandScoreExplanations();
  const updateExplanation = useUpdateBrandScoreExplanation();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (explanations) {
      const initial: Record<string, string> = {};
      for (const key of Object.keys(explanations)) {
        initial[key] = explanations[key].explanation;
      }
      setEditedValues(initial);
    }
  }, [explanations]);

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges((prev) => ({
      ...prev,
      [key]: value !== explanations?.[key]?.explanation,
    }));
  };

  const handleSave = (key: string) => {
    const explanation = explanations?.[key];
    if (explanation && editedValues[key]) {
      updateExplanation.mutate(
        { id: explanation.id, explanation: editedValues[key] },
        {
          onSuccess: () => {
            setHasChanges((prev) => ({ ...prev, [key]: false }));
          },
        }
      );
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Brand Score Explanations</h1>
          <p className="text-muted-foreground">
            Customize the explanations shown for each Brand Score component
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          componentOrder.map((key) => {
            const explanation = explanations?.[key];
            if (!explanation) return null;

            return (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-primary">{componentIcons[key]}</span>
                    {explanation.label}
                  </CardTitle>
                  <CardDescription>
                    This text appears when users click the info icon next to {explanation.label} in the Score Breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`explanation-${key}`}>Explanation</Label>
                    <Textarea
                      id={`explanation-${key}`}
                      value={editedValues[key] || ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      rows={5}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => handleSave(key)}
                      disabled={!hasChanges[key] || updateExplanation.isPending}
                      size="sm"
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
