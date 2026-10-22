'use client';

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  X,
  Check,
  Play,
  Music,
} from 'lucide-react';
import {
  ChessSoundTheme,
  CHESS_SOUND_THEMES,
  getChessAudioManager,
} from '@/utils/chessAudio';

interface ChessSoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChange?: (theme: ChessSoundTheme) => void;
}

export const ChessSoundSettingsModal: React.FC<ChessSoundSettingsModalProps> = ({
  isOpen,
  onClose,
  onThemeChange,
}) => {
  const audioManager = getChessAudioManager();
  const [selectedTheme, setSelectedTheme] = useState<ChessSoundTheme>(
    audioManager.getTheme()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    audioManager.getIsEnabled()
  );

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    audioManager.setIsEnabled(nextState);
    if (nextState) {
      audioManager.play('move-self', selectedTheme);
    }
  };

  const handleSelectTheme = (theme: ChessSoundTheme) => {
    setSelectedTheme(theme);
    audioManager.setTheme(theme);
    audioManager.play('move-self', theme);
    if (onThemeChange) {
      onThemeChange(theme);
    }
  };

  const handlePreviewSound = (theme: ChessSoundTheme, action: 'move-self' | 'capture') => {
    audioManager.play(action, theme);
  };

  return (
    <div
      className="chess-sound-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="chess-sound-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="chess-sound-modal-header">
          <div className="modal-title-cluster">
            <div className="modal-title-icon">
              <Music size={18} />
            </div>
            <div>
              <h3>Efek Suara Catur</h3>
              <p>Pilih tema audio resmi untuk setiap pergerakan bidak</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Sound Toggle Card */}
        <div className="chess-sound-toggle-card">
          <div className="toggle-info">
            <div className={`sound-status-icon ${soundEnabled ? 'active' : 'muted'}`}>
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <h4>Suara Pergerakan Bidak</h4>
              <p>{soundEnabled ? 'Efek audio aktif saat langkah dimainkan' : 'Audio dibisukan (senyap)'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            className={`btn-sound-toggle-switch ${soundEnabled ? 'on' : 'off'}`}
            title={soundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Sound Theme Selection Grid */}
        <div className="chess-sound-theme-section">
          <label className="section-label">PILIH TEMA SUARA ({CHESS_SOUND_THEMES.length} TEMA)</label>
          <div className="sound-themes-list">
            {CHESS_SOUND_THEMES.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`sound-theme-card ${isSelected ? 'is-selected' : ''}`}
                >
                  <div className="theme-card-left">
                    <span className="theme-emoji-badge">{theme.icon}</span>
                    <div className="theme-text-info">
                      <div className="theme-name-row">
                        <span className="theme-name">{theme.name}</span>
                        {isSelected && (
                          <span className="theme-active-tag">
                            <Check size={12} /> Aktif
                          </span>
                        )}
                      </div>
                      <span className="theme-desc">{theme.description}</span>
                    </div>
                  </div>

                  <div className="theme-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound(theme.id, 'move-self')}
                      className="btn-preview-audio"
                      title="Dengarkan Langkah Normal"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Move</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePreviewSound(theme.id, 'capture')}
                      className="btn-preview-audio capture"
                      title="Dengarkan Memakan Bidak (Capture)"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Capture</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="chess-sound-modal-footer">
          <span className="footer-note">
            Tema tersimpan otomatis di perangkat Anda
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-done"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
