import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ListWithItems, ListItem, PublicPageData } from '@/types';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle, Copy, Check, ListTodo } from 'lucide-react';

export function PublicPageView() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<PublicPageData>({
    queryKey: ['public-page', slug],
    queryFn: () => apiClient.getPublicPage(slug!),
    enabled: !!slug,
    retry: false,
  });

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('common.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('share.copy_failed'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header Skeleton */}
          <div className="mb-12">
            <Skeleton className="h-12 w-96 bg-slate-200 dark:bg-slate-700" />
            <Skeleton className="h-5 w-full max-w-2xl mt-4 bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-96 rounded-xl bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full border-destructive/20 shadow-xl bg-white dark:bg-slate-800">
          <CardContent className="pt-8">
            <div className="text-center space-y-5">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {error instanceof Error ? error.message : t('public.load_error')}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {t('public.not_found_desc')}
                </p>
              </div>
              <Button asChild className="w-full bg-violet-500 hover:bg-violet-600">
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('public.go_home')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -ml-48 -mb-48" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        {/* Header Section */}
        <header className="border-b border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
                    <ListTodo className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {data.page.title}
                  </h1>
                </div>
                {data.page.description && (
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl pl-[60px]">
                    {data.page.description}
                  </p>
                )}
              </div>
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 whitespace-nowrap shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    {t('common.ok')}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('share.button')}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Content Section */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {data.lists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Card className="w-full max-w-md border-dashed border-2 border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ListTodo className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-lg font-medium text-center text-slate-500 dark:text-slate-400">
                    {t('public.no_lists')}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.lists.map((listWithItems) => (
                <ListCard key={listWithItems.id} list={listWithItems} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface ListCardProps {
  list: ListWithItems;
}

function ListCard({ list }: ListCardProps) {
  const { t } = useTranslation();
  const completedCount = list.items.filter((item: ListItem) => item.checked).length;
  const totalCount = list.items.length;
  const completionPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 group">
      {/* Card Header */}
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg font-bold line-clamp-2 flex-1 text-slate-900 dark:text-white">
              {list.title}
            </CardTitle>
            {list.show_progress ? (
              <Badge className="shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100">
                {completedCount}/{totalCount}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                {t('public.items_count', { count: totalCount })}
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          {totalCount > 0 && list.show_progress && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {Math.round(completionPercent)}% {t('public.completed')}
              </p>
            </div>
          )}
        </div>
      </CardHeader>

      {/* Card Content */}
      <CardContent className="flex-1 overflow-y-auto py-4">
        {list.items.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center">
              {t('public.no_items')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.items.map((item: ListItem) => (
              <li
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-700/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
              >
                {list.show_checkboxes && (
                  <div className="flex-shrink-0 mt-0.5">
                    <Checkbox
                      checked={item.checked}
                      disabled
                      className="cursor-default data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                    />
                  </div>
                )}
                <span
                  className={`text-sm leading-relaxed break-words transition-all ${
                    item.checked && list.show_checkboxes
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
