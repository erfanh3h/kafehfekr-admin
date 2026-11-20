import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAdminPermission,
  escapeCsvCell,
  buildCsvContent,
  computeChartPoints,
  getAuditActionLabel,
} from '../src/utils/adminUtils';
import type { AdminUser } from '../src/types';

const makeAdmin = (overrides: Partial<AdminUser>): AdminUser => ({
  _id: 'adm_1',
  username: 'staff',
  full_name: 'Staff',
  role: 'support',
  permissions: ['dashboard:read', 'users:read'],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

test('hasAdminPermission enforces superadmin, wildcards, exact perms, and denies missing perms', () => {
  const superadmin = makeAdmin({ role: 'superadmin', permissions: [] });
  assert.equal(hasAdminPermission(superadmin, 'admins:manage'), true);
  assert.equal(hasAdminPermission(superadmin, 'anything:write'), true);

  const support = makeAdmin({ role: 'support', permissions: ['dashboard:read', 'users:read'] });
  assert.equal(hasAdminPermission(support, 'users:read'), true);
  assert.equal(hasAdminPermission(support, 'users:write'), false);
  assert.equal(hasAdminPermission(support, 'system:backup'), false);

  const namespaced = makeAdmin({ role: 'admin', permissions: ['clans:*'] });
  assert.equal(hasAdminPermission(namespaced, 'clans:manage'), true);
  assert.equal(hasAdminPermission(namespaced, 'users:write'), false);

  assert.equal(hasAdminPermission(null, 'dashboard:read'), false);
});

test('escapeCsvCell handles commas, quotes, newlines, and formula injection safely', () => {
  assert.equal(escapeCsvCell('simple'), 'simple');
  assert.equal(escapeCsvCell('hello, "world"'), '"hello, ""world"""');
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell('+cmd'), "'+cmd");
  assert.equal(escapeCsvCell(null), '');
});

test('buildCsvContent emits UTF-8 BOM and CRLF rows', () => {
  const csv = buildCsvContent(['ID', 'Name'], [['u1', 'علی, تست']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv.includes('"علی, تست"'), true);
  assert.equal(csv.includes('\r\n'), true);
});

test('computeChartPoints generates valid SVG paths for empty, single, and multi-point series', () => {
  const empty = computeChartPoints([], 600, 200);
  assert.equal(empty.points.length, 0);
  assert.equal(empty.linePath, '');

  const single = computeChartPoints([10], 600, 200);
  assert.equal(single.points.length, 1);
  assert.equal(single.maxVal, 10);
  assert.equal(single.areaPath, '');

  const multi = computeChartPoints([0, 50, 100], 640, 200, 16, 16);
  assert.equal(multi.points.length, 3);
  assert.equal(multi.maxVal, 100);
  assert.equal(multi.linePath.startsWith('M '), true);
  assert.equal(multi.areaPath.endsWith(' Z'), true);
  // Highest value should have smallest y (top padding)
  assert.equal(multi.points[2].y, 16);
});

test('getAuditActionLabel returns localized labels and falls back for unknown actions', () => {
  assert.equal(getAuditActionLabel('set_maintenance_mode', 'en'), 'Maintenance Mode');
  assert.equal(getAuditActionLabel('set_maintenance_mode', 'fa'), 'تغییر حالت تعمیرات');
  assert.equal(getAuditActionLabel('custom_unknown_event', 'en'), 'custom_unknown_event');
});
