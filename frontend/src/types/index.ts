export interface User {
  id: string;
  twitch_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  title: string;
  description?: string;
  creator_id: string;
  public_slug?: string;
  created_at: string;
  updated_at: string;
}

export interface PageWithPermission extends Page {
  is_creator: boolean;
  can_edit: boolean;
}

export interface PagePermission {
  id: string;
  page_id: string;
  user_id: string;
  can_edit: boolean;
  granted_by: string;
  created_at: string;
}

export interface PagePermissionWithUser extends PagePermission {
  user: User;
}

export interface List {
  id: string;
  page_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  content: string;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ListWithItems extends List {
  items: ListItem[];
}

export interface CreatePage {
  title: string;
  description?: string;
}

export interface UpdatePage {
  title?: string;
  description?: string;
}

export interface CreateList {
  title: string;
  position?: number;
}

export interface UpdateList {
  title?: string;
  position?: number;
}

export interface CreateListItem {
  content: string;
  position?: number;
}

export interface UpdateListItem {
  content?: string;
  checked?: boolean;
  position?: number;
}

export interface GrantPermission {
  user_id: string;
  can_edit: boolean;
}

export interface UpdatePermission {
  can_edit: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UpdateUser {
  username?: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  email?: string | null;
}

export interface SetPublicSlug {
  public_slug: string | null;
}

export interface PublicPageData {
  page: Page;
  lists: ListWithItems[];
}