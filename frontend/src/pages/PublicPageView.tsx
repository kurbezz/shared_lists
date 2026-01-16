import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useTranslation } from 'react-i18next';

export function PublicPageView() {
    const { t } = useTranslation();
    const { slug } = useParams<{ slug: string }>();

    const { data, isLoading, error } = useQuery({
        queryKey: ['public-page', slug],
        queryFn: () => apiClient.getPublicPage(slug!),
        enabled: !!slug,
        retry: false,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-6 w-96" />
                    <div className="space-y-4">
                        <Skeleton className="h-48" />
                        <Skeleton className="h-48" />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md w-full mx-4">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                            <h2 className="text-xl font-semibold">
                                {error instanceof Error ? error.message : t('public.load_error')}
                            </h2>
                            <p className="text-muted-foreground">
                                {t('public.not_found_desc')}
                            </p>
                            <Button asChild variant="outline">
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
        <div className="min-h-screen bg-background">
            {/* Content */}
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold">{data.page.title}</h1>
                    {data.page.description && (
                        <p className="mt-2 text-muted-foreground">{data.page.description}</p>
                    )}
                </div>

                {/* Lists */}
                {data.lists.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            {t('public.no_lists')}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {data.lists.map((listWithItems) => (
                            <Card key={listWithItems.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">{listWithItems.title}</CardTitle>
                                        <Badge variant="secondary">
                                            {t('public.items_count', { count: listWithItems.items.length })}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {listWithItems.items.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            {t('public.no_items')}
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {listWithItems.items.map((item) => (
                                                <li
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                                                >
                                                    <Checkbox
                                                        checked={item.checked}
                                                        disabled
                                                        className="cursor-default"
                                                    />
                                                    <span
                                                        className={
                                                            item.checked
                                                                ? 'line-through text-muted-foreground'
                                                                : ''
                                                        }
                                                    >
                                                        {item.content}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
