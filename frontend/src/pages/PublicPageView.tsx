import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ListWithItems, ListItem, PublicPageData } from '@/types';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, AlertCircle, Copy, Check, ListTodo, Globe } from 'lucide-react';

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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <div className="h-7 w-64 rounded bg-subtle animate-pulse" />
            <div className="mt-2 h-4 w-96 rounded bg-subtle animate-pulse" />
          </div>

          {/* Columns Skeleton */}
          <div className="mt-4 flex items-start gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-[320px] flex flex-col gap-2">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-9 rounded bg-subtle animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-3">
          <AlertCircle className="mx-auto size-8 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            {error instanceof Error ? error.message : t('public.not_found')}
          </h2>
          <p className="text-sm text-secondary-foreground">{t('public.not_found_desc')}</p>
          <Button asChild variant="outline">
            <Link to="/login">
              <ArrowLeft className="size-4" />
              {t('public.go_home')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="size-3" />
                <span>{t('public.public_page', 'Public page')}</span>
                <span>·</span>
                <span>{t('public.read_only', 'Read only')}</span>
              </div>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.01em]">
                {data.page.title}
              </h1>
              {data.page.description && (
                <p className="mt-0.5 text-[13px] text-secondary-foreground">
                  {data.page.description}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-accent" />
                  <span>{t('common.ok')}</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span className="hidden sm:inline">{t('share.button')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Content Section */}
      <main className="mx-auto max-w-5xl px-4 py-4 md:px-6">
        {data.lists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-strong py-10 flex flex-col items-center justify-center text-center">
            <ListTodo className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-secondary-foreground mt-3">
              {t('public.no_lists')}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 overflow-x-auto">
            {data.lists.map((listWithItems) => (
              <ListCard key={listWithItems.id} list={listWithItems} />
            ))}
          </div>
        )}
      </main>
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
    <Card className="flex w-[320px] shrink-0 flex-col rounded-lg border border-border bg-surface">
      {/* Card Header */}
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium line-clamp-2 flex-1">
            {list.title}
          </CardTitle>
          <Badge variant="counter">
            {list.show_progress ? `${completedCount}/${totalCount}` : totalCount}
          </Badge>
        </div>
        {totalCount > 0 && list.show_progress && (
          <div className="mt-2">
            <div
              className="h-1.5 w-full rounded-full bg-subtle"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label={list.title}
            >
              <div
                className="h-full rounded-full bg-accent-solid transition-[width] duration-300 ease-out"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {completedCount} / {totalCount}
            </p>
          </div>
        )}
      </CardHeader>

      {/* Card Content */}
      <CardContent className="flex-1 overflow-y-auto p-1.5">
        {list.items.length === 0 ? (
          <p className="px-3 py-2 text-[13px] text-muted-foreground">
            {t('public.no_items')}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {list.items.map((item: ListItem) => (
              <li
                key={item.id}
                className="flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1"
              >
                {list.show_checkboxes && (
                  <Checkbox checked={item.checked} disabled aria-label={item.content} />
                )}
                <span
                  className={cn(
                    'flex-1 text-sm leading-5',
                    item.checked && list.show_checkboxes &&
                      'text-muted-foreground line-through decoration-muted-foreground/60'
                  )}
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
