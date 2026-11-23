import {
  AdminUser,
  AnalyticsOverview,
  AuditLogItem,
  BackupItem,
  BroadcastNotificationItem,
  ClanItem,
  ClanMemberItem,
  DashboardStats,
  GamePlayItem,
  PromoCodeItem,
  PromoRedemptionItem,
  PurchaseItem,
  QuestionCategoryStat,
  QuizQuestionItem,
  ReportItem,
  RuntimeStatus,
  SystemConfig,
  UserFullDetails,
  UserItem,
} from '../types';

const STORAGE_KEY_TOKEN = 'kafehfekr_admin_token';
const STORAGE_KEY_API_URL = 'kafehfekr_admin_api_url';
const DEFAULT_API_URL =
  typeof window !== 'undefined' && window.location.port === '5002'
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
      if (err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        throw new Error(
          `اتصال به سرور (${this.baseUrl}) برقرار نشد. لطفاً از روشن بودن سرور ادمین اطمینان حاصل کنید.`
        );
      }
      throw err;
    }
  }

  // ---------------- Auth ----------------
  public static async login(
    username: string,
    password: string
  ): Promise<{ access_token: string; admin: AdminUser }> {
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

  public static async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<{ status: string; message: string }> {
    return this.request('/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  }

  // ---------------- Admins Management ----------------
  public static async listAdmins(): Promise<{ admins: AdminUser[] }> {
    return this.request<{ admins: AdminUser[] }>('/admin/admins');
  }

  public static async createAdmin(
    data: Partial<AdminUser> & { password: string }
  ): Promise<{ admin: AdminUser }> {
    return this.request('/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async updateAdmin(
    adminId: string,
    data: Partial<AdminUser> & { password?: string }
  ): Promise<{ admin: AdminUser }> {
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

  public static async getAnalytics(days = 14): Promise<AnalyticsOverview> {
    return this.request<AnalyticsOverview>(`/admin/analytics?days=${days}`);
  }

  public static async getAuditLogs(params?: {
    limit?: number;
    action?: string;
    search?: string;
  }): Promise<{ logs: AuditLogItem[] }> {
    const q = new URLSearchParams();
    q.append('limit', String(params?.limit || 80));
    if (params?.action && params.action !== 'all') q.append('action', params.action);
    if (params?.search) q.append('search', params.search);
    return this.request<{ logs: AuditLogItem[] }>(`/admin/audit-logs?${q.toString()}`);
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
    return this.request<UserFullDetails>(`/admin/users/${encodeURIComponent(userId)}`);
  }

  public static async updateUser(userId: string, data: Partial<UserItem>): Promise<{ user: UserItem }> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}`, {
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
    return this.request(`/admin/users/${encodeURIComponent(userId)}/adjust-currency`, {
      method: 'POST',
      body: JSON.stringify({ field, amount, reason }),
    });
  }

  public static async toggleBan(
    userId: string,
    isActive: boolean,
    reason?: string,
    durationHours?: number | null
  ): Promise<any> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/toggle-ban`, {
      method: 'POST',
      body: JSON.stringify({
        is_active: isActive,
        reason,
        duration_hours: durationHours && durationHours > 0 ? durationHours : null,
      }),
    });
  }

  public static async forceLogoutUser(
    userId: string,
    reason?: string
  ): Promise<{ ok: boolean; user_id: string; reachable: boolean; kicked: number; error?: string | null }> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/force-logout`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    });
  }

  public static async resetUserLocks(userId: string): Promise<any> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}/reset-locks`, {
      method: 'POST',
    });
  }

  public static async bulkResetLocks(userIds?: string[]): Promise<{ modified_count: number; matched_count: number }> {
    return this.request('/admin/users/bulk-reset-locks', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds && userIds.length > 0 ? userIds : null }),
    });
  }

  public static async deleteUser(userId: string): Promise<{ status: string }> {
    return this.request(`/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }

  public static async bulkDistributeCoins(
    amount: number,
    filterType = 'all',
    reason?: string
  ): Promise<{ modified_count: number; amount: number }> {
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
    return this.request(`/admin/games/${encodeURIComponent(gameId)}`);
  }

  public static async terminateGame(gameId: string): Promise<any> {
    return this.request(`/admin/games/${encodeURIComponent(gameId)}/terminate`, {
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

  public static async setMaintenance(maintenanceMode: boolean, maintenanceMessage = ''): Promise<any> {
    return this.request('/admin/config/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        maintenance_mode: maintenanceMode,
        maintenance_message: maintenanceMessage,
      }),
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

  public static async getClanDetails(
    clanId: string
  ): Promise<{ clan: ClanItem; members: ClanMemberItem[]; challenges: any[] }> {
    return this.request(`/admin/clans/${encodeURIComponent(clanId)}`);
  }

  public static async updateClan(clanId: string, data: Partial<ClanItem>): Promise<ClanItem> {
    return this.request(`/admin/clans/${encodeURIComponent(clanId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static async removeClanMember(clanId: string, userId: string): Promise<any> {
    return this.request(
      `/admin/clans/${encodeURIComponent(clanId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
  }

  public static async disbandClan(clanId: string): Promise<any> {
    return this.request(`/admin/clans/${encodeURIComponent(clanId)}`, {
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
    return this.request(`/admin/reports/${encodeURIComponent(reportId)}`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_notes: adminNotes }),
    });
  }

  // ---------------- Notifications ----------------
  public static async sendNotification(payload: {
    target_type: 'user' | 'clan' | 'all';
    title: string;
    message: string;
    user_id?: string;
    clan_id?: string;
  }): Promise<BroadcastNotificationItem> {
    return this.request('/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async getNotificationHistory(
    limit = 30
  ): Promise<{ items: BroadcastNotificationItem[] }> {
    return this.request(`/admin/notifications/history?limit=${limit}`);
  }

  // ---------------- System Operations ----------------
  public static async triggerBackup(): Promise<{ status: string; message: string; filename?: string }> {
    return this.request('/admin/system/backup', {
      method: 'POST',
    });
  }

  public static async getBackups(): Promise<{ backups: BackupItem[] }> {
    return this.request('/admin/system/backups');
  }

  public static async downloadBackup(filename: string): Promise<void> {
    const url = `${this.baseUrl}/admin/system/backups/${encodeURIComponent(filename)}/download`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.detail || `خطا در دانلود فایل پشتیبان (${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  public static async deleteBackup(filename: string): Promise<{ status: string; filename: string }> {
    return this.request(`/admin/system/backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  public static async getRuntimeStatus(): Promise<RuntimeStatus> {
    return this.request<RuntimeStatus>('/admin/system/runtime-status');
  }

  // ---------------- Quiz Question Bank ----------------
  public static async getQuestionCategories(): Promise<{ total: number; categories: QuestionCategoryStat[] }> {
    return this.request('/admin/questions/categories');
  }

  public static async listQuestions(params: {
    page?: number;
    limit?: number;
    search?: string;
    category_title?: string;
  }): Promise<{ items: QuizQuestionItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', String(params.page));
    if (params.limit) q.append('limit', String(params.limit));
    if (params.search) q.append('search', params.search);
    if (params.category_title && params.category_title !== 'all') {
      q.append('category_title', params.category_title);
    }
    return this.request(`/admin/questions?${q.toString()}`);
  }

  public static async createQuestion(payload: {
    question: string;
    options: string[];
    correct: number;
    category_id?: number;
    category_title?: string;
  }): Promise<{ question: QuizQuestionItem }> {
    return this.request('/admin/questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async updateQuestion(
    questionId: string,
    payload: {
      question: string;
      options: string[];
      correct: number;
      category_id?: number;
      category_title?: string;
    }
  ): Promise<{ question: QuizQuestionItem }> {
    return this.request(`/admin/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public static async deleteQuestion(questionId: string): Promise<{ status: string; id: string }> {
    return this.request(`/admin/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    });
  }

  public static async bulkImportQuestions(
    items: Array<Record<string, any>>
  ): Promise<{ inserted_count: number; skipped_count: number; errors: string[] }> {
    return this.request('/admin/questions/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // ---------------- Promo / Gift Codes ----------------
  public static async listPromos(params: {
    page?: number;
    limit?: number;
    search?: string;
    status_filter?: string;
  }): Promise<{ items: PromoCodeItem[]; total: number; page: number; limit: number; total_pages: number }> {
    const q = new URLSearchParams();
    if (params.page) q.append('page', String(params.page));
    if (params.limit) q.append('limit', String(params.limit));
    if (params.search) q.append('search', params.search);
    if (params.status_filter && params.status_filter !== 'all') {
      q.append('status_filter', params.status_filter);
    }
    return this.request(`/admin/promos?${q.toString()}`);
  }

  public static async createPromo(payload: {
    code: string;
    title?: string;
    reward_coin: number;
    reward_xp: number;
    max_uses: number;
    per_user_limit: number;
    expires_at?: string | null;
    is_active?: boolean;
  }): Promise<{ promo: PromoCodeItem }> {
    return this.request('/admin/promos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async updatePromo(
    promoId: string,
    payload: Partial<{
      title: string;
      reward_coin: number;
      reward_xp: number;
      max_uses: number;
      per_user_limit: number;
      expires_at: string | null;
      is_active: boolean;
    }>
  ): Promise<{ promo: PromoCodeItem }> {
    return this.request(`/admin/promos/${encodeURIComponent(promoId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  public static async deletePromo(promoId: string): Promise<{ status: string; promo_id: string }> {
    return this.request(`/admin/promos/${encodeURIComponent(promoId)}`, {
      method: 'DELETE',
    });
  }

  public static async getPromoRedemptions(
    promoId: string,
    limit = 50
  ): Promise<{ promo: PromoCodeItem; items: PromoRedemptionItem[]; total: number }> {
    return this.request(`/admin/promos/${encodeURIComponent(promoId)}/redemptions?limit=${limit}`);
  }
}
