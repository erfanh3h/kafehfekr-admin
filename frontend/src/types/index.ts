export type AdminRole = 'superadmin' | 'admin' | 'moderator' | 'support';
export type ThemeMode = 'dark' | 'light';
export type LangCode = 'fa' | 'en';

export type NavTab =
  | 'dashboard'
  | 'users'
  | 'games'
  | 'clans'
  | 'questions'
  | 'promos'
  | 'notifications'
  | 'purchases'
  | 'reports'
  | 'config'
  | 'admins'
  | 'system';

export interface AdminUser {
  _id: string;
  username: string;
  full_name: string;
  role: AdminRole;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  created_by?: string;
}

export interface DashboardStats {
  users: {
    total: number;
    real: number;
    bots: number;
    joined_today: number;
    banned?: number;
    locked?: number;
  };
  matches: {
    total: number;
    live: number;
    finished: number;
    today: number;
    breakdown: Record<string, number>;
  };
  purchases: {
    total: number;
    bazaar: number;
    myket: number;
  };
  clans_count: number;
  open_reports_count: number;
  config: {
    is_queue_open: boolean;
    queue_open_hour?: number;
    queue_open_minute?: number;
    latest_version: string;
    allowed_version: string;
    maintenance_mode: boolean;
    maintenance_message?: string;
    announcement: string;
    announcement_active?: boolean;
  };
  server_time: string;
}

export interface DailySeriesPoint {
  date: string;
  users: number;
  matches: number;
  purchases: number;
}

export interface AnalyticsOverview {
  days: number;
  daily_series: DailySeriesPoint[];
  economy: {
    total_coins: number;
    avg_coins_real: number;
    real_users: number;
    banned_users: number;
    locked_users: number;
  };
  top_by_score: Array<{
    _id: string;
    username: string;
    score: number;
    coin: number;
    xp?: number;
    is_active?: boolean;
  }>;
  top_by_coin: Array<{
    _id: string;
    username: string;
    score: number;
    coin: number;
    xp?: number;
    is_active?: boolean;
  }>;
  mode_breakdown: Record<string, number>;
  product_breakdown: Record<string, number>;
}

export interface UserItem {
  _id: string;
  username: string;
  phone: string;
  coin: number;
  score: number;
  xp: number;
  image: number;
  is_active: boolean;
  join_date?: string;
  last_time_played?: string;
  open_game_id?: string;
  open_pre_game_id?: string;
  device_id?: string;
  created_clan_id?: string;
  ban_reason?: string;
  ban_until?: string | null;
  ban_duration_hours?: number | null;
}

export interface UserHistory {
  _id?: string;
  win?: number;
  lose?: number;
  draw?: number;
  [key: string]: any;
}

export interface UserFullDetails {
  user: UserItem;
  history: UserHistory;
  recent_games: GamePlayItem[];
  purchases: PurchaseItem[];
  clan?: ClanItem | null;
}

export interface GamePlayItem {
  _id: string;
  game_types: string[];
  game_score_type: string;
  is_finished: boolean;
  start_date: string;
  finish_date?: string;
  winner_id?: string;
  winner_list?: any[];
  user_ids?: string[];
  user1_id?: string;
  user2_id?: string;
  user_scores?: any[];
  users_info?: any[];
  player_names?: Record<string, string>;
  terminated_by_admin?: boolean;
}

export interface GameRoundItem {
  _id: string;
  game_play_id: string;
  game_type: string;
  winner_id: string | number;
  winner_user_id?: string;
  date?: string;
  game_data?: any;
}

export interface PurchaseItem {
  _id: string;
  user_id: string;
  username?: string;
  product_id: string;
  market_type: string;
  token: string;
  date: string;
}

export interface ClanItem {
  _id: string;
  name: string;
  tag: string;
  description: string;
  level: number;
  xp?: number;
  trophies: number;
  owner_id: string;
  owner_name?: string;
  member_count?: number;
  max_members?: number;
  badge?: number;
  created_at?: string;
}

export interface ClanMemberItem {
  _id?: string;
  clan_id?: string;
  user_id: string;
  username?: string;
  role?: string;
  joined_at?: string;
}

export interface ReportItem {
  _id: string;
  reporter_id: string;
  reporter_username?: string;
  target_user_id: string;
  target_username?: string;
  target_type: string;
  target_id?: string;
  reason: string;
  details?: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  admin_notes?: string;
}

export interface SystemConfig {
  _id?: number;
  is_queue_open: boolean;
  queue_open_hour?: number;
  queue_open_minute?: number;
  latest_version: string;
  allowed_version: string;
  maintenance_mode?: boolean;
  maintenance_message?: string;
  announcement?: string;
  announcement_active?: boolean;
  update_finish_date?: string;
}

export interface AuditLogItem {
  _id: string;
  admin_id: string;
  admin_username?: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface BackupItem {
  filename: string;
  size_bytes: number;
  size_formatted: string;
  file_count?: number;
  is_dir?: boolean;
  modified: string;
}

export interface BroadcastNotificationItem {
  _id: string;
  target_type: 'user' | 'clan' | 'all';
  target_label: string;
  user_id?: string | null;
  clan_id?: string | null;
  title: string;
  message: string;
  sent_count: number;
  admin_id: string;
  admin_username?: string;
  created_at: string;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => Promise<void> | void;
}

export interface RuntimeStatus {
  checked_at: string;
  mongodb: {
    online: boolean;
    ping_ms: number | null;
  };
  backend: {
    online: boolean;
    url: string;
    latency_ms: number | null;
    uptime_seconds: number;
    online_social_users: number;
    social_sockets: number;
    active_game_sockets: number;
    active_ram_games_count: number;
    active_ram_games: Array<{
      game_id: string;
      game_types: string[];
      game_score_type: string;
      players: Array<{ user_id: string; username: string }>;
      spectators: number;
      is_finished: boolean;
    }>;
    ranked_queue_count: number;
    active_pre_games_count: number;
    multi_queue_count: number;
    multi_queue_breakdown: Record<string, number>;
    lobbies_count: number;
    spectators_count: number;
    spectator_rooms_count: number;
    error?: string | null;
  };
  server: {
    online: boolean;
    url: string;
    latency_ms: number | null;
    uptime_seconds: number;
    mongo_ok: boolean;
    mongo_ping_ms: number | null;
    error?: string | null;
  };
}

export interface QuizQuestionItem {
  _id: string;
  question_id?: number;
  category_id: number;
  category_title: string;
  question: string;
  options: string[];
  correct: number;
  created_at?: string;
  updated_at?: string;
}

export interface QuestionCategoryStat {
  category_id: number;
  category_title: string;
  count: number;
}

export interface PromoCodeItem {
  _id: string;
  code: string;
  title: string;
  reward_coin: number;
  reward_xp: number;
  max_uses: number;
  per_user_limit: number;
  used_count: number;
  expires_at?: string | null;
  is_active: boolean;
  is_expired?: boolean;
  is_exhausted?: boolean;
  created_at?: string;
}

export interface PromoRedemptionItem {
  _id: string;
  promo_id: string;
  code: string;
  user_id: string;
  username?: string;
  reward_coin: number;
  reward_xp: number;
  redeemed_at: string;
}
