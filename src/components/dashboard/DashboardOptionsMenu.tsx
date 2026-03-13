import { useState } from 'react';
import { MoreHorizontal, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardEditorDialog } from './DashboardEditorDialog';
import { useUserRole } from '@/hooks/useUserRole';

interface DashboardOptionsMenuProps {
  dashboardSlug: string;
  onConfigChange?: () => void;
}

export function DashboardOptionsMenu({ dashboardSlug, onConfigChange }: DashboardOptionsMenuProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const { role } = useUserRole();
  const isAdmin = role === 'admin';

  if (!isAdmin) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Dashboard options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditorOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Edit Dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DashboardEditorDialog
        dashboardSlug={dashboardSlug}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onConfigChange={onConfigChange}
      />
    </>
  );
}
