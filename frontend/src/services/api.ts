import {
  AdminUser,
  DashboardStats,
  UserItem,
  UserFullDetails,
  GamePlayItem,
  PurchaseItem,
  ClanItem,
  ReportItem,
  SystemConfig,
  AuditLogItem,
} from '../types';

const STORAGE_KEY_TOKEN = 'kafehfekr_admin_token';
const STORAGE_KEY_API_URL = 'kafehfekr_admin_api_url';
const DEFAULT_API_URL = typeof window !== 'undefined' && window.location.port === '5002'
  ? window.location.origin
  : 'http://localhost:5002';

export class ApiService {
  private static baseUrl: string = localStorage.getItem(STORAGE_KEY_API_URL) || DEFAULT_API_URL;
  private static token: string | null = localStorage.getItem(STORAGE_KEY_TOKEN);

  public static getBaseUrl(): string {
    return this.baseUrl;
  }

  public static setBaseUrl(url: string): void {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    this.baseUrl = clean;
    localStorage.setItem(STORAGE_KEY_API_URL, clean);
  }

  public static getToken(): string | null {
    return this.token;
  }

  public static setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }

  public static logout(): void {
    this.setToken(null);
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token invalid / expired
        if (this.token && !endpoint.includes('/auth/login')) {
          this.logout();
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.detail || data?.message || `خطا در ارتباط با سرور (${response.status})`;
        throw new Error(message);
      }

      return data as T;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message?.includes('fetch')) {
        throw new Error(`اتصال به سرور (${this.baseUrl}) برقرار نشد. لطفاً از روشن بودن سرور پایتون اطمینان حاصل کنید.`);
      }
      throw err;
    }
  }

  // ---------------- Auth ----------------
  public static async login(username: string, password: string): Promise<{ access_token: string; admin: AdminUser }> {
    const res = await this.request<{ access_token: string; admin: AdminUser }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public static async getMe(): Promise<{ admin: AdminUser }> {
    return this.request<{ admin: AdminUser }>('/admin/auth/me');
  }

  public static async changePassword(oldPassword: string, newPassword: string): Promise<{ status: string; message: string }> {
    return this.request('/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  }

  // ---------------- Admins Management ----------------
  public static async listAdmins(): Promise<{ admins: AdminUser[] }> {
    return this.request<{ admins: AdminUser[] }>('/admin/admins');
  }

  public static async createAdmin(data: Partial<AdminUser> & { password: string }): Promise<{ admin: AdminUser }> {
    return this.request('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async updateAdmin(adminId: string, data: Partial<AdminUser> & { password?: string }): Promise<{ admin: AdminUser }> {
    return this.request(`/admin/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static async deleteAdmin(adminId: string): Promise<{ status: string }> {
    return this.request(`/admin/admins/${adminId}`, {
      method: 'DELETE',
    });
  }

  // ---------------- Dashboard & Analytics ----------------
  public static async getStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/admin/stats');
  }

  public static async getAuditLogs(limit = 50): Promise<{ logs: AuditLogItem[] }> {
    return this.request<{ logs: AuditLogItem[] }>(`/admin/audit-logs?limit=${limit}`);
  }

  // ---------------- Users ----------------
  public static async listUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    filter_type?: string;
    sort_by?: string;
    sort_order?: number;
  }): Promise<{ items: UserItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search) q.append('search', params.search);
    if (params.filter_type) q.append('filter_type', params.filter_type);
    if (params.sort_by) q.append('sort_by', params.sort_by);
    if (params.sort_order) q.append('sort_order', params.sort_order.toString());

    return this.request(`/admin/users?${q.toString()}`);
  }

  public static async getUserDetails(userId: string): Promise<UserFullDetails> {
    return this.request<UserFullDetails>(`/admin/users/${userId}`);
  }

  public static async updateUser(userId: string, data: Partial<UserItem>): Promise<{ user: UserItem }> {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static async adjustCurrency(
    userId: string,
    field: 'coin' | 'score' | 'xp',
    amount: number,
    reason?: string
  ): Promise<any> {
    return this.request(`/admin/users/${userId}/adjust-currency`, {
      method: 'POST',
      body: JSON.stringify({ field, amount, reason }),
    });
  }

  public static async toggleBan(userId: string, isActive: boolean, reason?: string): Promise<any> {
    return this.request(`/admin/users/${userId}/toggle-ban`, {
      method: 'POST',
      body: JSON.stringify({ is_active: isActive, reason }),
    });
  }

  public static async resetUserLocks(userId: string): Promise<any> {
    return this.request(`/admin/users/${userId}/reset-locks`, {
      method: 'POST',
    });
  }

  public static async deleteUser(userId: string): Promise<{ status: string }> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  public static async bulkDistributeCoins(amount: number, filterType = 'all', reason?: string): Promise<any> {
    return this.request('/admin/users/bulk-coins', {
      method: 'POST',
      body: JSON.stringify({ amount, filter_type: filterType, reason }),
    });
  }

  // ---------------- Games & Matches ----------------
  public static async getLiveGames(): Promise<{ games: GamePlayItem[] }> {
    return this.request<{ games: GamePlayItem[] }>('/admin/games/live');
  }

  public static async getGameHistory(params: {
    page?: number;
    limit?: number;
    game_type?: string;
    game_score_type?: string;
    user_id?: string;
  }): Promise<{ items: GamePlayItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.game_type) q.append('game_type', params.game_type);
    if (params.game_score_type) q.append('game_score_type', params.game_score_type);
    if (params.user_id) q.append('user_id', params.user_id);

    return this.request(`/admin/games/history?${q.toString()}`);
  }

  public static async getGameDetails(gameId: string): Promise<{ match: GamePlayItem; rounds: any[] }> {
    return this.request(`/admin/games/${gameId}`);
  }

  public static async terminateGame(gameId: string): Promise<any> {
    return this.request(`/admin/games/${gameId}/terminate`, {
      method: 'POST',
    });
  }

  public static async cleanupStuckGames(maxAgeMinutes = 120): Promise<{ cleaned_games_count: number }> {
    return this.request(`/admin/games/cleanup-stuck?max_age_minutes=${maxAgeMinutes}`, {
      method: 'POST',
    });
  }

  // ---------------- Config & Queue ----------------
  public static async getConfig(): Promise<SystemConfig> {
    return this.request<SystemConfig>('/admin/config');
  }

  public static async setQueue(isOpen: boolean, hour = 0, minute = 0): Promise<any> {
    return this.request('/admin/config/queue', {
      method: 'POST',
      body: JSON.stringify({ is_open: isOpen, hour, minute }),
    });
  }

  public static async setVersions(allowedVersion: string, latestVersion: string): Promise<any> {
    return this.request('/admin/config/version', {
      method: 'POST',
      body: JSON.stringify({ allowed_version: allowedVersion, latest_version: latestVersion }),
    });
  }

  public static async setAnnouncement(announcement: string, isActive = true): Promise<any> {
    return this.request('/admin/config/announcement', {
      method: 'POST',
      body: JSON.stringify({ announcement, is_active: isActive }),
    });
  }

  // ---------------- Purchases ----------------
  public static async getPurchases(params: {
    page?: number;
    limit?: number;
    market_type?: string;
    product_id?: string;
    user_id?: string;
  }): Promise<{ items: PurchaseItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.market_type) q.append('market_type', params.market_type);
    if (params.product_id) q.append('product_id', params.product_id);
    if (params.user_id) q.append('user_id', params.user_id);

    return this.request(`/admin/purchases?${q.toString()}`);
  }

  // ---------------- Clans ----------------
  public static async getClans(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ items: ClanItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search) q.append('search', params.search);

    return this.request(`/admin/clans?${q.toString()}`);
  }

  public static async getClanDetails(clanId: string): Promise<{ clan: ClanItem; members: any[]; challenges: any[] }> {
    return this.request(`/admin/clans/${clanId}`);
  }

  public static async updateClan(clanId: string, data: Partial<ClanItem>): Promise<any> {
    return this.request(`/admin/clans/${clanId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static async disbandClan(clanId: string): Promise<any> {
    return this.request(`/admin/clans/${clanId}`, {
      method: 'DELETE',
    });
  }

  // ---------------- Reports ----------------
  public static async getReports(params: {
    page?: number;
    limit?: number;
    status_filter?: string;
  }): Promise<{ items: ReportItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.status_filter) q.append('status_filter', params.status_filter);

    return this.request(`/admin/reports?${q.toString()}`);
  }

  public static async updateReport(reportId: string, status: string, adminNotes?: string): Promise<any> {
    return this.request(`/admin/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    });
  }

  // ---------------- System Operations ----------------
  public static async triggerBackup(): Promise<{ status: string; message: string }> {
    return this.request('/admin/system/backup', {
      method: 'POST',
    });
  }

  public static async getBackups(): Promise<{ backups: any[] }> {
    return this.request('/admin/system/backups');
  }
}
