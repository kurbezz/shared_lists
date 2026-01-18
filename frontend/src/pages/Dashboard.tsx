import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../contexts/useAuth';
import UserMenu from '../components/UserMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/useToast';
import { Plus, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Queries
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['pages'],
    queryFn: () => apiClient.getPages(),
  });

  // Mutations
  const createPageMutation = useMutation({
    mutationFn: (data: { title: string; description?: string }) => apiClient.createPage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setIsCreateOpen(false);
      setNewPageTitle('');
      setNewPageDesc('');
    },
    onError: (error) => {
      console.error('Failed to create page:', error);
      notify(t('dashboard.create_error'));
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: string) => apiClient.deletePage(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setPageToDelete(null);
    },
    onError: (error) => {
      console.error('Failed to delete page:', error);
      notify(t('dashboard.delete_error'));
    },
  });

  // Create Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageDesc, setNewPageDesc] = useState('');

  // Delete Alert State
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;
    createPageMutation.mutate({
      title: newPageTitle.trim(),
      description: newPageDesc.trim() || undefined,
    });
  };

  const handleDeletePage = async () => {
    if (!pageToDelete) return;
    deletePageMutation.mutate(pageToDelete);
  };

  const createdPages = pages.filter((p) => p.is_creator);
  const sharedPages = pages.filter((p) => !p.is_creator);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
              {user && (
                <p className="text-muted-foreground text-sm">
                  {t('dashboard.welcome', { name: user.display_name || user.username })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Actions Bar */}
        <div className="flex justify-between items-center">
          <div></div> {/* Spacer */}
          {(createdPages.length > 0 || sharedPages.length > 0) && (
            <Button className="gap-2" onClick={() => setIsCreateOpen(true)} data-cy="create-page-btn">
              <Plus className="w-4 h-4" />
              {t('dashboard.create_page')}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Created Pages */}
            {createdPages.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('dashboard.my_pages', { count: createdPages.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {createdPages.map((page) => (
                    <Card
                      key={page.id}
                      className="group hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-primary"
                      onClick={() => navigate(`/pages/${page.id}`)}
                      data-cy={`page-card-${page.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">{page.title}</CardTitle>
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[2.5em]">
                          {page.description || t('dashboard.no_description')}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-4">
                        <span>{new Date(page.created_at).toLocaleDateString(i18n.language)}</span>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPageToDelete(page.id);
                          }}
                          data-cy="delete-page-btn"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Shared Pages */}
            {sharedPages.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-tight">
                  {t('dashboard.shared_with_me', { count: sharedPages.length })}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sharedPages.map((page) => (
                    <Card
                      key={page.id}
                      className="group hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => navigate(`/pages/${page.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">{page.title}</CardTitle>
                          {page.can_edit ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {t('dashboard.role_editor')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-secondary-foreground">
                              {t('dashboard.role_viewer')}
                            </span>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 min-h-[2.5em]">
                          {page.description || t('dashboard.no_description')}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="flex justify-between items-center text-xs text-muted-foreground pt-4">
                        <span>{new Date(page.created_at).toLocaleDateString(i18n.language)}</span>
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {createdPages.length === 0 && sharedPages.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-muted/30 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-6">
                  <Plus className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{t('dashboard.no_pages')}</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {t('dashboard.no_pages_description')}
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2" size="lg" data-cy="create-page-btn-empty">
                  <Plus className="w-5 h-5" />
                  {t('dashboard.create_page')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

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
              variant="destructive"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('dashboard.new_page_title')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.new_page_description')}
            </DialogDescription>
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
                data-cy="create-page-title-input"
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
                data-cy="create-page-desc-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreatePage} disabled={!newPageTitle.trim() || createPageMutation.isPending} data-cy="create-page-confirm-btn">
              {createPageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};