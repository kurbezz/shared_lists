import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle, Share2, Copy, Check } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { ListWithItems, ListItem, PublicPageData } from '../types';

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

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {/* Header Skeleton */}
                    <div className="mb-12">
                        <Skeleton className="h-12 w-96" />
                        <Skeleton className="h-5 w-full max-w-2xl mt-4" />
                    </div>

                    {/* Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-96 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center px-4 py-12">
                <Card className="max-w-md w-full border-destructive/20 shadow-lg">
                    <CardContent className="pt-8">
                        <div className="text-center space-y-5">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-destructive/10 rounded-full">
                                <AlertCircle className="h-7 w-7 text-destructive" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">
                                    {error instanceof Error ? error.message : t('public.load_error')}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {t('public.not_found_desc')}
                                </p>
                            </div>
                            <Button asChild className="w-full">
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
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/3 rounded-full blur-3xl -ml-48 -mb-48" />
            </div>

            {/* Main Content */}
            <div className="relative z-10">
                {/* Header Section */}
                <div className="border-b border-border/40 bg-background/50 backdrop-blur-sm sticky top-0 z-20">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
                            <div className="flex-1 min-w-0">
                                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
                                    {data.page.title}
                                </h1>
                                {data.page.description && (
                                    <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
                                        {data.page.description}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={handleCopyLink}
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2 whitespace-nowrap shrink-0 hover:bg-muted"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4" />
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
                </div>

                {/* Content Section */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    {data.lists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Card className="w-full max-w-md border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Share2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                                    <p className="text-lg font-medium text-center text-muted-foreground">
                                        {t('public.no_lists')}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <>
                            {/* List Grid - Responsive columns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                                {data.lists.map((listWithItems) => (
                                    <ListCard key={listWithItems.id} list={listWithItems} />
                                ))}
                            </div>

                        </>
                    )}
                </div>
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
        <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card/70">
            {/* Card Header */}
            <CardHeader className="pb-4 border-b border-border/40">
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-xl font-bold line-clamp-2 flex-1">
                            {list.title}
                        </CardTitle>
                        <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/20">
                            {completedCount}/{totalCount}
                        </Badge>
                    </div>

                    {/* Progress Bar */}
                    {totalCount > 0 && (
                        <div className="space-y-2">
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300"
                                    style={{ width: `${completionPercent}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground font-medium">
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
                        <p className="text-sm text-muted-foreground text-center">
                            {t('public.no_items')}
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {list.items.map((item: ListItem) => (
                            <li
                                key={item.id}
                                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex-shrink-0 mt-1">
                                    <Checkbox
                                        checked={item.checked}
                                        disabled
                                        className="cursor-default"
                                    />
                                </div>
                                <span
                                    className={`text-sm leading-relaxed break-words transition-all ${
                                        item.checked
                                            ? 'line-through text-muted-foreground/60'
                                            : 'text-foreground'
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
