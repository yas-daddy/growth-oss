import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  Search, 
  ArrowUpDown, 
  DollarSign, 
  Users, 
  TrendingUp,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Link2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from '@/components/dashboard/KPICard';
import { AffiliateDialog } from '@/components/affiliates/AffiliateDialog';
import { AffiliateLinkGenerator } from '@/components/affiliates/AffiliateLinkGenerator';
import { useAffiliates, useDeleteAffiliate, Affiliate } from '@/hooks/useAffiliates';

export default function AffiliateSettings() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null);

  const { data: affiliates = [], isLoading } = useAffiliates();
  const deleteAffiliate = useDeleteAffiliate();


  const totalFTDs = affiliates.reduce((sum, a) => sum + a.ftds, 0);
  const totalMonthlyCap = affiliates.reduce((sum, a) => sum + (a.monthly_cap || 0), 0);
  const avgCPA = affiliates.length > 0 ? affiliates.reduce((sum, a) => sum + a.cpa, 0) / affiliates.length : 0;

  const filteredAffiliates = affiliates.filter(affiliate =>
    affiliate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    affiliate.channel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setDialogOpen(true);
  };

  const handleDelete = (affiliate: Affiliate) => {
    setAffiliateToDelete(affiliate);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (affiliateToDelete) {
      await deleteAffiliate.mutateAsync(affiliateToDelete.id);
      setDeleteDialogOpen(false);
      setAffiliateToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingAffiliate(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/30">active</Badge>;
      case 'paused':
        return <Badge variant="secondary">paused</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-muted-foreground">inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Affiliate Settings</h1>
          <p className="text-muted-foreground">
            Manage affiliate partners and their configurations
          </p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Affiliate
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Active Affiliates"
          value={affiliates.filter(a => a.status === 'active').length.toString()}
          icon={<Users className="h-5 w-5" />}
          variant="primary"
        />
        <KPICard
          title="Total Monthly Cap"
          value={`£${totalMonthlyCap.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          title="Average CPA"
          value={`£${avgCPA.toFixed(2)}`}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="accent"
        />
      </div>

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners" className="gap-2">
            <Users className="h-4 w-4" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Link2 className="h-4 w-4" />
            Link Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          {/* Affiliates Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Affiliate Partners</CardTitle>
                  <CardDescription>
                    {affiliates.length} affiliates • {affiliates.filter(a => a.status === 'active').length} active
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search affiliates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : affiliates.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No affiliates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first affiliate partner to start tracking performance.
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Affiliate
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="gap-1 -ml-3 font-medium">
                          Affiliate Name
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Channel ID</TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1 font-medium">
                          CPA
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1 font-medium">
                          Monthly Cap
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAffiliates.map((affiliate) => (
                      <TableRow 
                        key={affiliate.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/settings/affiliates/${affiliate.id}`)}
                      >
                        <TableCell className="font-medium">{affiliate.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {affiliate.channel}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(affiliate.cpa).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          £{Number(affiliate.monthly_cap || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(affiliate.status)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(affiliate)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(affiliate)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <AffiliateLinkGenerator />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AffiliateDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        affiliate={editingAffiliate}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Affiliate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{affiliateToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAffiliate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
