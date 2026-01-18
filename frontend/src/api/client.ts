import type {
  User,
  Page,
  PageWithPermission,
  PagePermissionWithUser,
  List,
  ListItem,
  ListWithItems,
  CreatePage,
  UpdatePage,
  CreateList,
  UpdateList,
  CreateListItem,
  UpdateListItem,
  GrantPermission,
  UpdatePermission,
  SetPublicSlug,
  PublicPageData,
  ApiKey,
  CreateApiKeyResponse,
  UpdateUser,
} from '../types';

// Determine API base URL from browser origin
// In development: window.location.origin will be http://localhost:5173
// In production: window.location.origin will be the actual domain
const getApiBaseUrl = (): string => {
  // Check if VITE_API_URL is explicitly set (for custom configurations)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Use browser's origin + /api path
  // This works for both development (with Vite proxy) and production
  return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit & { params?: Record<string, string> } = {}
  ): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({} as Record<string, unknown>));

      const getErrorMessageFromData = (d: Record<string, unknown> | null) => {
        if (!d) return undefined;
        const maybeError = d['error'];
        if (typeof maybeError === 'string') return maybeError;
        const maybeMessage = d['message'];
        if (typeof maybeMessage === 'string') return maybeMessage;
        return undefined;
      };

      const msg = getErrorMessageFromData(errorData) || response.statusText || `HTTP error! status: ${response.status}`;
      // Log full response for easier debugging
      console.error('API error response', { url: url.toString(), status: response.status, body: errorData });
      throw new Error(msg);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    // Some successful endpoints return 200 with an empty body — handle that gracefully
    try {
      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } catch {
      // If parsing fails, return undefined instead of throwing to avoid showing spurious errors
      return undefined as T;
    }
  }

  // Auth methods
  getLoginUrl(): string {
    return `${API_BASE_URL}/auth/login`;
  }

  // Users
  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>('/users/search', {
      params: { q: query },
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>(`/users/me`);
  }

  async updateCurrentUser(data: UpdateUser): Promise<User> {
    return this.request<User>(`/users/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>(`/settings/api-keys`);
  }

  async createApiKey(data: { name?: string | null; scopes: string[] }): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>(`/settings/api-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.request(`/settings/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteApiKey(id: string): Promise<void> {
    await this.request(`/settings/api-keys/${id}?hard=true`, {
      method: 'DELETE',
    });
  }

  // Pages
  async getPages(): Promise<PageWithPermission[]> {
    return this.request<PageWithPermission[]>('/pages');
  }

  async getPage(pageId: string): Promise<PageWithPermission> {
    return this.request<PageWithPermission>(`/pages/${pageId}`);
  }

  async createPage(data: CreatePage): Promise<Page> {
    return this.request<Page>('/pages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePage(pageId: string, data: UpdatePage): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePage(pageId: string): Promise<void> {
    await this.request(`/pages/${pageId}`, {
      method: 'DELETE',
    });
  }

  // Page permissions
  async getPagePermissions(pageId: string): Promise<PagePermissionWithUser[]> {
    return this.request<PagePermissionWithUser[]>(`/pages/${pageId}/permissions`);
  }

  async grantPermission(pageId: string, data: GrantPermission): Promise<PagePermissionWithUser> {
    return this.request<PagePermissionWithUser>(`/pages/${pageId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePermission(
    pageId: string,
    permissionId: string,
    data: UpdatePermission
  ): Promise<PagePermissionWithUser> {
    return this.request<PagePermissionWithUser>(
      `/pages/${pageId}/permissions/${permissionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async revokePermission(pageId: string, permissionId: string): Promise<void> {
    await this.request(`/pages/${pageId}/permissions/${permissionId}`, {
      method: 'DELETE',
    });
  }

  // Lists
  async getLists(pageId: string): Promise<List[]> {
    return this.request<List[]>(`/pages/${pageId}/lists`);
  }

  async getList(pageId: string, listId: string): Promise<ListWithItems> {
    return this.request<ListWithItems>(`/pages/${pageId}/lists/${listId}`);
  }

  async createList(pageId: string, data: CreateList): Promise<List> {
    return this.request<List>(`/pages/${pageId}/lists`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateList(pageId: string, listId: string, data: UpdateList): Promise<List> {
    return this.request<List>(`/pages/${pageId}/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteList(pageId: string, listId: string): Promise<void> {
    await this.request(`/pages/${pageId}/lists/${listId}`, {
      method: 'DELETE',
    });
  }

  // List items
  async getListItems(listId: string): Promise<ListItem[]> {
    return this.request<ListItem[]>(`/lists/${listId}/items`);
  }

  async getListItem(listId: string, itemId: string): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items/${itemId}`);
  }

  async createListItem(listId: string, data: CreateListItem): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateListItem(listId: string, itemId: string, data: UpdateListItem): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteListItem(listId: string, itemId: string): Promise<void> {
    await this.request(`/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Public link methods
  async setPublicSlug(pageId: string, data: SetPublicSlug): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}/public-slug`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getPublicPage(slug: string): Promise<PublicPageData> {
    return this.request<PublicPageData>(`/public/${slug}`);
  }
}

export const apiClient = new ApiClient();