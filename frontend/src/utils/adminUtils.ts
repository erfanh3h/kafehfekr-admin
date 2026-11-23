import { AdminUser, LangCode } from '../types';

/**
 * Mirrors backend RBAC permission checks for UI gating.
 */
export function hasAdminPermission(admin: AdminUser | null | undefined, permission: string): boolean {
  if (!admin) return false;
  if (admin.role === 'superadmin') return true;
  const perms = admin.permissions || [];
  if (perms.includes('*') || perms.includes(permission)) return true;
  const colonIdx = permission.indexOf(':');
  if (colonIdx > 0) {
    const ns = permission.slice(0, colonIdx);
    if (perms.includes(`${ns}:*`)) return true;
  }
  return false;
}

/**
 * Escapes a value for RFC-4180 CSV and guards against spreadsheet formula injection.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Builds a UTF-8 BOM CSV string ready for Persian & English Excel compatibility.
 */
export function buildCsvContent(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

/**
 * Computes SVG coordinates for a series of non-negative values.
 */
export function computeChartPoints(
  values: number[],
  width: number,
  height: number,
  paddingX = 16,
  paddingY = 14
): { points: ChartPoint[]; maxVal: number; linePath: string; areaPath: string } {
  if (values.length === 0) {
    return { points: [], maxVal: 0, linePath: '', areaPath: '' };
  }

  const maxVal = Math.max(1, ...values);
  const usableW = Math.max(1, width - paddingX * 2);
  const usableH = Math.max(1, height - paddingY * 2);
  const stepX = values.length > 1 ? usableW / (values.length - 1) : 0;

  const points: ChartPoint[] = values.map((v, idx) => {
    const clamped = Math.max(0, Number.isFinite(v) ? v : 0);
    const x = values.length === 1 ? width / 2 : paddingX + idx * stepX;
    const y = paddingY + usableH - (clamped / maxVal) * usableH;
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      value: clamped,
      index: idx,
    };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const baselineY = Number((height - paddingY).toFixed(2));
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
      : '';

  return { points, maxVal, linePath, areaPath };
}

export function formatNumber(n: number | undefined | null, lang: LangCode = 'fa'): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

/**
 * Safely parses ISO datetime string into Date in Tehran timezone (UTC+03:30).
 * If the string has no timezone offset (naive), it assumes UTC from server and appends 'Z'.
 */
function parseToTehranDate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  let str = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += 'Z';
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatShortDate(iso: string | undefined | null, lang: LangCode = 'fa'): string {
  if (!iso) return '—';
  const d = parseToTehranDate(iso);
  if (!d) return String(iso).slice(0, 10);
  return d.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US', {
    timeZone: 'Asia/Tehran',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | undefined | null, lang: LangCode = 'fa'): string {
  if (!iso) return '—';
  const d = parseToTehranDate(iso);
  if (!d) return String(iso);
  return d.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', {
    timeZone: 'Asia/Tehran',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTehranClock(date: Date = new Date(), lang: LangCode = 'fa'): string {
  return date.toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-US', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDurationSeconds(seconds: number | undefined | null, lang: LangCode = 'fa'): string {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (lang === 'fa') {
    if (d > 0) return `${formatNumber(d, lang)} روز و ${formatNumber(h, lang)} ساعت`;
    if (h > 0) return `${formatNumber(h, lang)} ساعت و ${formatNumber(m, lang)} دقیقه`;
    return `${formatNumber(Math.max(1, m), lang)} دقیقه`;
  }
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

const AUDIT_LABELS: Record<string, { fa: string; en: string }> = {
  adjust_currency: { fa: 'تغییر موجودی بازیکن', en: 'Adjust Currency' },
  toggle_user_status: { fa: 'تغییر وضعیت مسدودی', en: 'Toggle User Ban' },
  force_logout_user: { fa: 'اخراج فوری از نشست', en: 'Force Logout Player' },
  update_user: { fa: 'ویرایش پروفایل بازیکن', en: 'Update User Profile' },
  reset_user_locks: { fa: 'رفع قفل بازیکن', en: 'Reset User Locks' },
  bulk_reset_locks: { fa: 'رفع قفل گروهی', en: 'Bulk Reset Locks' },
  delete_user: { fa: 'حذف حساب بازیکن', en: 'Delete User' },
  bulk_adjust_coins: { fa: 'توزیع همگانی سکه', en: 'Bulk Coin Grant' },
  terminate_game: { fa: 'توقف اجباری بازی', en: 'Terminate Match' },
  cleanup_stuck_games: { fa: 'پاکسازی بازی‌های معلق', en: 'Cleanup Stuck Matches' },
  set_queue_status: { fa: 'تغییر وضعیت صف', en: 'Update Queue Status' },
  set_app_versions: { fa: 'تنظیم نسخه کلاینت', en: 'Update App Versions' },
  set_announcement: { fa: 'تنظیم اعلان بنر', en: 'Update Banner' },
  set_maintenance_mode: { fa: 'تغییر حالت تعمیرات', en: 'Maintenance Mode' },
  update_clan: { fa: 'ویرایش کلن', en: 'Update Clan' },
  remove_clan_member: { fa: 'اخراج عضو کلن', en: 'Remove Clan Member' },
  disband_clan: { fa: 'انحلال کلن', en: 'Disband Clan' },
  update_report: { fa: 'رسیدگی به گزارش', en: 'Moderate Report' },
  send_notification: { fa: 'ارسال اعلان درون‌بازی', en: 'Send Notification' },
  create_question: { fa: 'افزودن سوال کوییز', en: 'Create Quiz Question' },
  update_question: { fa: 'ویرایش سوال کوییز', en: 'Update Quiz Question' },
  delete_question: { fa: 'حذف سوال کوییز', en: 'Delete Quiz Question' },
  bulk_import_questions: { fa: 'ورود گروهی سوالات', en: 'Bulk Import Questions' },
  create_promo: { fa: 'ایجاد کد هدیه', en: 'Create Promo Code' },
  update_promo: { fa: 'ویرایش کد هدیه', en: 'Update Promo Code' },
  delete_promo: { fa: 'حذف کد هدیه', en: 'Delete Promo Code' },
  manual_backup: { fa: 'پشتیبان‌گیری دستی', en: 'Manual Backup' },
  delete_backup: { fa: 'حذف فایل پشتیبان', en: 'Delete Backup' },
  create_admin: { fa: 'ایجاد مدیر جدید', en: 'Create Staff Admin' },
  update_admin: { fa: 'ویرایش مدیر', en: 'Update Staff Admin' },
  delete_admin: { fa: 'حذف مدیر', en: 'Delete Staff Admin' },
  change_password: { fa: 'تغییر رمز عبور', en: 'Change Password' },
};

export function getAuditActionLabel(action: string, lang: LangCode): string {
  const hit = AUDIT_LABELS[action];
  if (hit) return hit[lang];
  return action;
}

export const AUDIT_ACTION_OPTIONS = Object.keys(AUDIT_LABELS);
