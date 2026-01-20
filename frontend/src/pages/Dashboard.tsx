import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from '@/components/UserMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ArrowRight, ListTodo } from 'lucide-react';

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['pages'],
    queryFn: () => apiClient.getPages(),
  });

  const createPageMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) => apiClient.createPage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setIsCreateOpen(false);
      setNewPageTitle('');
      setNewPageDesc('');
    },
    onError: () => {
      toast.error(t('dashboard.create_error'));
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => apiClient.deletePage(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setPageToDelete(null);
    },
    onError: () => {
      toast.error(t('dashboard.delete_error'));
    },
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageDesc, setNewPageDesc] = useState('');
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  const handleCreatePage = () => {
    if (!newPageTitle.trim()) return;
    createPageMutation.mutate({
      title: newPageTitle.trim(),
      description: newPageDesc.trim() || undefined,
    });
  };

  const handleDeletePage = () => {
    if (!pageToDelete) return;
    deletePageMutation.mutate(pageToDelete);
  };

  const createdPages = pages.filter((p) => p.is_creator);
  const sharedPages = pages.filter((p) => !p.is_creator);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t('dashboard.title')}
                </h1>
                {user && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('dashboard.welcome', { name: user.display_name || user.username })}
                  </p>
                )}
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Actions Bar */}
        {(createdPages.length > 0 || sharedPages.length > 0) && (
          <div className="flex justify-end">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              {t('dashboard.create_page')}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            {/* My Pages */}
            {createdPages.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('dashboard.my_pages', { count: createdPages.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {createdPages.map((page) => (
                    <Card
                      key={page.id}
                      className="group cursor-pointer transition-all hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-1 border-l-4 border-l-violet-500 bg-white dark:bg-slate-800"
                      onClick={() => navigate(`/pages/${page.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          {page.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[2.5em]">
                          {page.description || t('dashboard.no_description')}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center text-xs text-slate-500 pt-4">
                        <span>{new Date(page.created_at).toLocaleDateString(i18n.language)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPageToDelete(page.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Shared Pages */}
            {sharedPages.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('dashboard.shared_with_me', { count: sharedPages.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sharedPages.map((page) => (
                    <Card
                      key={page.id}
                      className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-white dark:bg-slate-800"
                      onClick={() => navigate(`/pages/${page.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-lg line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {page.title}
                          </CardTitle>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              page.can_edit
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {page.can_edit ? t('dashboard.role_editor') : t('dashboard.role_viewer')}
                          </span>
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[2.5em]">
                          {page.description || t('dashboard.no_description')}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center text-xs text-slate-500 pt-4">
                        <span>{new Date(page.created_at).toLocaleDateString(i18n.language)}</span>
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-violet-500" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {createdPages.length === 0 && sharedPages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-6">
                  <Plus className="h-12 w-12 text-violet-500" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {t('dashboard.no_pages')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm text-center">
                  {t('dashboard.no_pages_description')}
                </p>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/20"
                >
                  <Plus className="w-5 h-5" />
                  {t('dashboard.create_page')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!pageToDelete} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.delete_confirm_description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Page Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('dashboard.new_page_title')}</DialogTitle>
            <DialogDescription>{t('dashboard.new_page_description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">{t('dashboard.label_title')}</Label>
              <Input
                id="title"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder={t('dashboard.placeholder_title')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreatePage();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">{t('dashboard.label_description')}</Label>
              <Textarea
                id="desc"
                value={newPageDesc}
                onChange={(e) => setNewPageDesc(e.target.value)}
                placeholder={t('dashboard.placeholder_description')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCreatePage();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreatePage}
              disabled={!newPageTitle.trim() || createPageMutation.isPending}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {createPageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}