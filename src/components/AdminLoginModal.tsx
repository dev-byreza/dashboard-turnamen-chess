'use client';

import React, { useState } from 'react';
import { Lock, Key, ShieldCheck, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { verifyAdminPin } from '../utils/adminAuth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (pin: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pin.trim()) {
      setErrorMsg('Silakan masukkan PIN Admin.');
      return;
    }

    setIsSubmitting(true);
    const valid = verifyAdminPin(pin);

    if (valid) {
      onLoginSuccess(pin.trim());
      setPin('');
      setErrorMsg('');
      onClose();
    } else {
      setErrorMsg('PIN Admin tidak valid. Silakan periksa kembali.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box admin-login-box">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Lock className="modal-title-icon" size={20} />
            <span>Login Akses Admin</span>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="admin-login-body">
          <div className="admin-login-icon-wrap">
            <div className="admin-shield-icon">
              <ShieldCheck size={36} />
            </div>
            <h4 className="admin-login-heading">Otorisasi Administrator</h4>
            <p className="admin-login-desc">
              Masukkan PIN Admin untuk mengubah skor laga, memajukan babak Swiss, dan mengelola data turnamen.
            </p>
          </div>

          {errorMsg && (
            <div className="admin-login-error">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="admin-pin-input-group">
            <label className="admin-pin-label">PIN / Password Admin</label>
            <div className="admin-pin-input-wrapper">
              <Key size={16} className="admin-pin-icon" />
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan PIN Admin..."
                className="admin-pin-input"
                autoFocus
              />
              <button
                type="button"
                className="admin-pin-toggle-btn"
                onClick={() => setShowPin(!showPin)}
                title={showPin ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="admin-login-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-glass-secondary"
              style={{ flex: 1 }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-gold-action"
              style={{ flex: 1 }}
            >
              <Lock size={15} />
              <span>Masuk Admin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
