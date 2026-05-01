import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';

export type AuditAction =
  | 'staff_created'
  | 'payment_initiated'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_mismatch'
  | 'case_assigned'
  | 'staff_status_changed'
  | 'settings_updated';

export interface AuditEntry {
  action: AuditAction;
  actorUid: string | null;
  targetId: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Fire-and-forget audit log write. Errors are swallowed so audit failures
 * never block the main request path.
 */
export function writeAuditLog(entry: AuditEntry): void {
  getAdminDb()
    .collection('auditLog')
    .add({ ...entry, timestamp: FieldValue.serverTimestamp() })
    .catch((err) => console.error('[auditLog] Failed to write audit entry:', err));
}
