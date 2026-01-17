import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ListComponent } from '../components/ListComponent';
import { ShareDialog } from '../components/ShareDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Trash2, Plus, Loader2, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from 'react-i18next';

export const PageView: React.FC = () => {
  const { t } = useTranslation();
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newListTitle, setNewListTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editPageTitle, setEditPageTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editPageDesc, setEditPageDesc] = useState('');

  // Queries
  const { data: page, error: pageError } = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => apiClient.getPage(pageId!),
    enabled: !!pageId,
  });

  const { data: lists = [], isLoading: isListsLoading } = useQuery({
    queryKey: ['lists', pageId],
    queryFn: () => apiClient.getLists(pageId!),
    enabled: !!pageId,
    select: (data) => [...data].sort((a, b) => a.position - b.position),
  });

  useEffect(() => {
    if (page) {
      setEditPageTitle(page.title);
      setEditPageDesc(page.description || '');
    }
  }, [page]);

  useEffect(() => {
    if (pageError) {
      console.error('Failed to load page:', pageError);
      alert(t('page.load_error'));
      navigate('/');
    }
  }, [pageError, navigate, t]);

  // Mutations
  const addListMutation = useMutation({
    mutationFn: (title: string) => apiClient.createList(pageId!, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
      setNewListTitle('');
    },
    onError: (error) => {
      console.error('Failed to create list:', error);
      alert(t('page.create_list_error'));
    },
  });

  const updateListMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: string; title: string }) =>
      apiClient.updateList(pageId!, listId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
    },
    onError: (error) => {
      console.error('Failed to update list:', error);
      alert(t('page.update_list_error'));
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: string) => apiClient.deleteList(pageId!, listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', pageId] });
    },
    onError: (error) => {
      console.error('Failed to delete list:', error);
      alert(t('page.delete_list_error'));
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string }) =>
      apiClient.updatePage(pageId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      setIsEditingTitle(false);
      setIsEditingDesc(false);
    },
    onError: (error) => {
      console.error('Failed to update page:', error);
      alert(t('page.update_title_error'));
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: () => apiClient.deletePage(pageId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate('/');
    },
    onError: (error) => {
      console.error('Failed to delete page:', error);
      alert(t('dashboard.delete_error'));
    },
  });

  const handleAddList = async () => {
    if (!pageId || !newListTitle.trim()) return;
    addListMutation.mutate(newListTitle.trim());
  };

  const handleUpdateList = async (listId: string, title: string) => {
    if (!pageId) return;
    updateListMutation.mutate({ listId, title });
  };

  const handleDeleteList = async (listId: string) => {
    if (!pageId) return;
    deleteListMutation.mutate(listId);
  };

  const handleUpdatePageTitle = async () => {
    if (!pageId || !editPageTitle.trim() || editPageTitle === page?.title) {
      setIsEditingTitle(false);
      return;
    }
    updatePageMutation.mutate({ title: editPageTitle.trim() });
  };

  const handleUpdatePageDescription = async () => {
    if (!pageId || editPageDesc === (page?.description || '')) {
      setIsEditingDesc(false);
      return;
    }
    updatePageMutation.mutate({ description: editPageDesc.trim() || undefined });
  };

  const handleDeletePage = async () => {
    if (!pageId) return;
    deletePageMutation.mutate();
  };

  const handleKeyDownNewList = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddList();
    }
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditPageTitle(page?.title || '');
      setIsEditingTitle(false);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleKeyDownDesc = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setEditPageDesc(page?.description || '');
      setIsEditingDesc(false);
      window.getSelection()?.removeAllRanges();
    }
  };

  if (!page) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  title={t('page.back_to_pages')}
                  className="mr-1"
                  data-cy="back-to-dashboard-btn"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                {isEditingTitle ? (
                  <div className="flex items-center gap-2 flex-1 max-w-lg">
                    <Input
                      value={editPageTitle}
                      onChange={(e) => setEditPageTitle(e.target.value)}
                      onKeyDown={handleKeyDownTitle}
                      onBlur={handleUpdatePageTitle} // Keep blur for now
                      autoFocus
                      className="text-2xl font-bold h-10"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleUpdatePageTitle} onMouseDown={(e) => e.preventDefault()}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h1
                    className="text-2xl font-bold cursor-pointer hover:underline decoration-dashed underline-offset-4 decoration-muted-foreground/50 truncate"
                    onDoubleClick={() => page.can_edit && setIsEditingTitle(true)}
                    title={t('page.edit_title_hint')}
                    data-cy="page-title"
                  >
                    {page.title}
                  </h1>
                )}
              </div>

              <div className="pl-12">
                {isEditingDesc ? (
                  <div className="flex items-start gap-2 max-w-lg">
                    <Textarea
                      value={editPageDesc}
                      onChange={(e) => setEditPageDesc(e.target.value)}
                      onKeyDown={handleKeyDownDesc}
                      onBlur={handleUpdatePageDescription}
                      autoFocus
                      rows={2}
                      placeholder={t('page.add_desc_placeholder')}
                      className="min-h-[60px]"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdatePageDescription} onMouseDown={(e) => e.preventDefault()}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p
                    className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors max-w-3xl"
                    onDoubleClick={() => page.can_edit && setIsEditingDesc(true)}
                    title={page.can_edit ? t('page.edit_desc_hint') : ''}
                  >
                    {page.description || (page.can_edit ? <span className="italic opacity-50">{t('page.add_desc_placeholder')}</span> : '')}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  {page.is_creator ? (
                    <Badge variant="default">{t('page.role_creator')}</Badge>
                  ) : page.can_edit ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">{t('page.role_editor')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('page.role_viewer')}</Badge>
                  )}
                </div>
              </div>
            </div>

            {page.is_creator && (
              <div className="flex gap-2">
                <ShareDialog page={page} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-cy="delete-page-btn">
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('page.delete_page')}
                    </Button>
                  </AlertDialogTrigger>
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
                        data-cy="confirm-delete-page-btn"
                      >
                        {t('common.delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-hidden">
        {/* Horizontal Scroll Area */}
        <div className="h-full overflow-x-auto p-6">
          <div className="flex gap-6 h-full items-start min-w-min">
            {isListsLoading ? (
              <div className="flex gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-[300px] h-[200px] bg-muted/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              lists.map((list) => (
                <ListComponent
                  key={list.id}
                  list={list}
                  canEdit={page.can_edit}
                  onUpdate={handleUpdateList}
                  onDelete={handleDeleteList}
                />
              ))
            )}

            {/* Add List */}
            {page.can_edit && (
              <Card className="w-[300px] flex-shrink-0 bg-muted/30 border-dashed border-2 shadow-none hover:bg-muted/50 transition-colors">
                <CardContent className="p-4 pt-4">
                  <h3 className="font-semibold text-lg mb-3">{t('page.new_list')}</h3>
                  <div className="flex gap-2">
                    <Input
                      value={newListTitle}
                      onChange={(e) => setNewListTitle(e.target.value)}
                      onKeyDown={handleKeyDownNewList}
                      placeholder={t('page.new_list_placeholder')}
                      disabled={addListMutation.isPending}
                      className="bg-background"
                      data-cy="create-list-input"
                    />
                    <Button
                      size="icon"
                      onClick={handleAddList}
                      disabled={addListMutation.isPending || !newListTitle.trim()}
                      className="flex-shrink-0"
                      data-cy="create-list-btn"
                    >
                      {addListMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};