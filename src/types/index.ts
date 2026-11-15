export type AdminRole = 'superadmin' | 'admin' | 'moderator' | 'support';

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
    latest_version: string;
    allowed_version: string;
    maintenance_mode: boolean;
    announcement: string;
  };
  server_time: string;
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

export interface ReportItem {
  _id: string;
  reporter_id: string;
  target_user_id: string;
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
  latest_version: string;
  allowed_version: string;
  maintenance_mode?: boolean;
  announcement?: string;
  update_finish_date?: string;
}

export interface AuditLogItem {
  _id: string;
  admin_id: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}
