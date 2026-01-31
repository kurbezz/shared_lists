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
} from "../types";

const getApiBaseUrl = (): string => {
  // Prefer an explicit VITE_API_URL when set, but guard against accidental
  // build-time defaults that point at localhost in production builds.
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const hostname = parsed.hostname.toLowerCase();

      const isLocalhost =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

      // Allow localhost when in development, but ignore it in production to avoid
      // accidentally pointing production clients at a developer backend.
      if (!(isLocalhost && import.meta.env.MODE === "production")) {
        return envUrl;
      }

      // In DEV mode, log a warning so developers see what's happening.
      if (import.meta.env.DEV) {
        console.warn(
          `VITE_API_URL='${envUrl}' looks like a localhost address and will be ignored in production builds. Falling back to window.location.origin + '/api'.`,
        );
      }
    } catch {
      // If env var is a relative path (like '/api'), allow it.
      if (envUrl.startsWith("/")) {
        return envUrl;
      }
      if (import.meta.env.DEV) {
        console.warn(
          `VITE_API_URL='${envUrl}' is not a valid URL. Falling back to window.location.origin + '/api'.`,
        );
      }
    }
  }

  return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit & { params?: Record<string, string> } = {},
  ): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    // Use credentials to send httpOnly cookie (auth_token) if present
    const response = await fetch(url.toString(), {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401) {
      // In cookie-based auth flow we don't store the token client-side; ensure any remnant is removed.
      try {
        localStorage.removeItem("auth_token");
      } catch {
        /* ignore */
      }

      // Avoid causing a reload/redirect loop when already on an auth-related page
      // (for example '/login' or the OAuth '/auth/callback'). Only navigate to
      // '/login' when we're on some other (non-auth) page.
      const pathname =
        typeof window !== "undefined" &&
        window.location &&
        window.location.pathname
          ? window.location.pathname
          : "";
      const isAuthPage = pathname === "/login" || pathname.startsWith("/auth");
      if (!isAuthPage) {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({}) as Record<string, unknown>);

      const getErrorMessageFromData = (d: Record<string, unknown> | null) => {
        if (!d) return undefined;
        const maybeError = d["error"];
        if (typeof maybeError === "string") return maybeError;
        const maybeMessage = d["message"];
        if (typeof maybeMessage === "string") return maybeMessage;
        return undefined;
      };

      const msg =
        getErrorMessageFromData(errorData) ||
        response.statusText ||
        `HTTP error! status: ${response.status}`;
      console.error("API error response", {
        url: url.toString(),
        status: response.status,
        body: errorData,
      });
      throw new Error(msg);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  // Auth methods
  getLoginUrl(): string {
    return `${API_BASE_URL}/auth/login`;
  }

  // Users
  async searchUsers(query: string): Promise<User[]> {
    return this.request<User[]>("/users/search", {
      params: { q: query },
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>(`/users/me`);
  }

  async updateCurrentUser(data: UpdateUser): Promise<User> {
    return this.request<User>(`/users/me`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // API Keys
  async getApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>(`/settings/api-keys`);
  }

  async createApiKey(data: {
    name?: string | null;
    scopes: string[];
  }): Promise<CreateApiKeyResponse> {
    return this.request<CreateApiKeyResponse>(`/settings/api-keys`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.request(`/settings/api-keys/${id}`, {
      method: "DELETE",
    });
  }

  async deleteApiKey(id: string): Promise<void> {
    await this.request(`/settings/api-keys/${id}?hard=true`, {
      method: "DELETE",
    });
  }

  // Pages
  async getPages(): Promise<PageWithPermission[]> {
    return this.request<PageWithPermission[]>("/pages");
  }

  async getPage(pageId: string): Promise<PageWithPermission> {
    return this.request<PageWithPermission>(`/pages/${pageId}`);
  }

  async createPage(data: CreatePage): Promise<Page> {
    return this.request<Page>("/pages", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePage(pageId: string, data: UpdatePage): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deletePage(pageId: string): Promise<void> {
    await this.request(`/pages/${pageId}`, {
      method: "DELETE",
    });
  }

  // Page permissions
  async getPagePermissions(pageId: string): Promise<PagePermissionWithUser[]> {
    return this.request<PagePermissionWithUser[]>(
      `/pages/${pageId}/permissions`,
    );
  }

  async grantPermission(
    pageId: string,
    data: GrantPermission,
  ): Promise<PagePermissionWithUser> {
    return this.request<PagePermissionWithUser>(
      `/pages/${pageId}/permissions`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updatePermission(
    pageId: string,
    permissionId: string,
    data: UpdatePermission,
  ): Promise<PagePermissionWithUser> {
    return this.request<PagePermissionWithUser>(
      `/pages/${pageId}/permissions/${permissionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  }

  async revokePermission(pageId: string, permissionId: string): Promise<void> {
    await this.request(`/pages/${pageId}/permissions/${permissionId}`, {
      method: "DELETE",
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
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateList(
    pageId: string,
    listId: string,
    data: UpdateList,
  ): Promise<List> {
    return this.request<List>(`/pages/${pageId}/lists/${listId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteList(pageId: string, listId: string): Promise<void> {
    await this.request(`/pages/${pageId}/lists/${listId}`, {
      method: "DELETE",
    });
  }

  // List items
  async getListItems(listId: string): Promise<ListItem[]> {
    return this.request<ListItem[]>(`/lists/${listId}/items`);
  }

  async getListItem(listId: string, itemId: string): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items/${itemId}`);
  }

  async createListItem(
    listId: string,
    data: CreateListItem,
  ): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateListItem(
    listId: string,
    itemId: string,
    data: UpdateListItem,
  ): Promise<ListItem> {
    return this.request<ListItem>(`/lists/${listId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteListItem(listId: string, itemId: string): Promise<void> {
    await this.request(`/lists/${listId}/items/${itemId}`, {
      method: "DELETE",
    });
  }

  // Public link methods
  async setPublicSlug(pageId: string, data: SetPublicSlug): Promise<Page> {
    return this.request<Page>(`/pages/${pageId}/public-slug`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getPublicPage(slug: string): Promise<PublicPageData> {
    return this.request<PublicPageData>(`/public/${slug}`);
  }
}

export const apiClient = new ApiClient();
