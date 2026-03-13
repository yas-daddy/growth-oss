import { useState } from "react";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Zap } from "lucide-react";
import { RulesList } from "@/components/automation/RulesList";
import { MetaRulesList } from "@/components/automation/MetaRulesList";
import { RuleEditorDialog } from "@/components/automation/RuleEditorDialog";
import { MetaRuleEditorDialog } from "@/components/automation/MetaRuleEditorDialog";
import { ExecutionHistoryDialog } from "@/components/automation/ExecutionHistoryDialog";
import { AutomationRule } from "@/hooks/useAutomationRules";

export default function AutomationRules() {
  const [platform, setPlatform] = useState<"apple" | "meta">("apple");
  const [editorOpen, setEditorOpen] = useState(false);
  const [metaEditorOpen, setMetaEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleViewHistory = (rule: AutomationRule) => {
    setHistoryRule(rule);
    setHistoryOpen(true);
  };

  const handleCreateNew = () => {
    if (platform === "apple") {
      setEditingRule(null);
      setEditorOpen(true);
    } else {
      setMetaEditorOpen(true);
    }
  };

  return (
    <>
      <Helmet>
        <title>Automation Rules | GrowthOS</title>
        <meta
          name="description"
          content="Create and manage automated rules for keyword bid adjustments and status changes"
        />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6" />
              Automation Rules
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage automation rules for Apple Search Ads and Meta Ads.
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>
              {platform === "apple" 
                ? "Custom rules that evaluate keyword performance and execute actions when conditions are met."
                : "Rules synced with Meta Ads Manager. Create rules here or sync existing ones from Meta."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={platform}
              onValueChange={(v) => setPlatform(v as "apple" | "meta")}
            >
              <TabsList>
                <TabsTrigger value="apple">Apple Search Ads</TabsTrigger>
                <TabsTrigger value="meta">Meta Ads</TabsTrigger>
              </TabsList>

              <TabsContent value="apple" className="mt-4">
                <RulesList
                  platform="apple"
                  onEdit={handleEdit}
                  onViewHistory={handleViewHistory}
                />
              </TabsContent>

              <TabsContent value="meta" className="mt-4">
                <MetaRulesList />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <RuleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule}
      />

      <MetaRuleEditorDialog
        open={metaEditorOpen}
        onOpenChange={setMetaEditorOpen}
      />

      <ExecutionHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        rule={historyRule}
      />
    </>
  );
}
