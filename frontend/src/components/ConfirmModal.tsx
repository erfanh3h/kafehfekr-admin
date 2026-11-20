import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ConfirmDialogOptions, LangCode } from '../types';

interface ConfirmModalProps {
  dialog: ConfirmDialogOptions | null;
  onClose: () => void;
  lang: LangCode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ dialog, onClose, lang }) => {
  const [busy, setBusy] = useState(false);

  if (!dialog) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await dialog.onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const confirmClass =
    dialog.variant === 'danger'
      ? 'btn-danger-solid'
      : dialog.variant === 'warning'
      ? 'btn-primary'
      : 'btn-primary';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={() => !busy && onClose()}
    >
      <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" id="confirm-modal-title">
            <AlertTriangle
              size={18}
              style={{
                color: dialog.variant === 'danger' ? 'var(--crimson)' : 'var(--amber)',
              }}
            />
            <span>{dialog.title}</span>
          </div>
          <button
            type="button"
            className="btn-icon sm"
            onClick={onClose}
            disabled={busy}
            aria-label={lang === 'fa' ? 'بستن' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {dialog.message}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {dialog.cancelLabel || (lang === 'fa' ? 'انصراف' : 'Cancel')}
          </button>
          <button
            type="button"
            className={`btn ${confirmClass}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy
              ? lang === 'fa'
                ? 'در حال اجرا...'
                : 'Processing...'
              : dialog.confirmLabel || (lang === 'fa' ? 'تأیید و اجرا' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
