'use client';

import React, { useState } from 'react';
import { X, Cpu, Zap, Sliders, Check, RotateCcw, AlertCircle } from 'lucide-react';

interface ChessEngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDepth: number;
  onDepthChange: (newDepth: number) => void;
  isEngineActive: boolean;
  onToggleEngineActive: (active: boolean) => void;
  onClearCache?: () => void;
}

const DEPTH_PRESETS = [
  {
    depth: 10,
    label: 'Cepat',
    sublabel: 'Depth 10',
    timeEst: '~40 ms',
    desc: 'Respons instan, cocok untuk browsing langkah catur secara cepat.',
    color: '#10b981',
  },
  {
    depth: 14,
    label: 'Standar (Rekomendasi)',
    sublabel: 'Depth 14',
    timeEst: '~150 ms',
    desc: 'Kombinasi ideal antara kecepatan tinggi dan akurasi taktik.',
    color: '#81b64c',
  },
  {
    depth: 18,
    label: 'Mendalam',
    sublabel: 'Depth 18',
    timeEst: '~500 ms',
    desc: 'Kalkulasi tajam untuk menganalisis taktik pengorbanan & blunder rumit.',
    color: '#3b82f6',
  },
  {
    depth: 22,
    label: 'Master',
    sublabel: 'Depth 22',
    timeEst: '~1.5 s',
    desc: 'Analisis level Grandmaster dengan pencarian pohon variasi sangat dalam.',
    color: '#a855f7',
  },
];

export const ChessEngineSettingsModal: React.FC<ChessEngineSettingsModalProps> = ({
  isOpen,
  onClose,
  currentDepth,
  onDepthChange,
  isEngineActive,
  onToggleEngineActive,
  onClearCache,
}) => {
  const [selectedDepth, setSelectedDepth] = useState<number>(currentDepth);
  const [activeEngine, setActiveEngine] = useState<boolean>(isEngineActive);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onDepthChange(selectedDepth);
    onToggleEngineActive(activeEngine);
    if (typeof window !== 'undefined') {
      localStorage.setItem('stockfish_depth', selectedDepth.toString());
      localStorage.setItem('stockfish_active', activeEngine ? 'true' : 'false');
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="chess-depth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="chess-depth-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chess-depth-modal-header">
          <div className="chess-depth-modal-title-cluster">
            <div className="chess-depth-modal-icon-badge">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="chess-depth-modal-title">Pengaturan Engine Stockfish 19</h3>
              <p className="chess-depth-modal-subtitle">
                Atur kedalaman pencarian (*depth*) & performa evaluasi taktis
              </p>
            </div>
          </div>
          <button
            type="button"
            className="chess-depth-modal-close-btn"
            onClick={onClose}
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="chess-depth-modal-body">
          {/* Active Engine Toggle */}
          <div className="engine-toggle-card">
            <div className="engine-toggle-info">
              <div className="engine-toggle-title-row">
                <Zap size={16} className={activeEngine ? 'text-green' : 'text-gray'} />
                <span className="engine-toggle-title">Evaluasi Real-Time Aktif</span>
              </div>
              <p className="engine-toggle-desc">
                Menghitung bar evaluasi dan langkah terbaik secara otomatis di setiap posisi.
              </p>
            </div>
            <label className="chess-switch-label">
              <input
                type="checkbox"
                checked={activeEngine}
                onChange={(e) => setActiveEngine(e.target.checked)}
                className="chess-switch-input"
              />
              <span className="chess-switch-slider" />
            </label>
          </div>

          {/* Current Depth Display Slider */}
          <div className="depth-slider-card">
            <div className="depth-slider-header">
              <div className="depth-slider-label-cluster">
                <Sliders size={16} />
                <span className="depth-slider-label">Kedalaman Pencarian (*Depth*)</span>
              </div>
              <div className="depth-badge-live">
                Depth <strong>{selectedDepth}</strong> ply
              </div>
            </div>

            <div className="depth-slider-track-wrap">
              <input
                type="range"
                min={8}
                max={24}
                step={1}
                value={selectedDepth}
                onChange={(e) => setSelectedDepth(parseInt(e.target.value, 10))}
                className="chess-depth-range-input"
              />
              <div className="depth-slider-ticks">
                <span>8 (Cepat)</span>
                <span>12</span>
                <span className="tick-recommended">14 (Standar)</span>
                <span>18</span>
                <span>24 (Maksimal)</span>
              </div>
            </div>
          </div>

          {/* Preset Cards */}
          <div className="depth-presets-grid">
            {DEPTH_PRESETS.map((p) => {
              const isSelected = selectedDepth === p.depth;
              return (
                <button
                  key={p.depth}
                  type="button"
                  onClick={() => setSelectedDepth(p.depth)}
                  className={`depth-preset-card ${isSelected ? 'is-selected' : ''}`}
                  style={isSelected ? { borderColor: p.color } : undefined}
                >
                  <div className="depth-preset-header">
                    <span className="depth-preset-name" style={{ color: isSelected ? p.color : undefined }}>
                      {p.label}
                    </span>
                    <span className="depth-preset-time">{p.timeEst}</span>
                  </div>
                  <p className="depth-preset-desc">{p.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Technical Note */}
          <div className="depth-info-alert">
            <AlertCircle size={15} className="depth-alert-icon" />
            <span>
              <strong>1 Depth</strong> setara dengan 1 langkah giliran (*half-move/ply*). Stockfish 19
              juga menerapkan *selective depth* hingga 20+ langkah untuk jalur serangan skak tajam.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="chess-depth-modal-footer">
          {onClearCache && (
            <button
              type="button"
              onClick={onClearCache}
              className="btn-clear-cache"
              title="Kosongkan memori cache evaluasi FEN"
            >
              <RotateCcw size={14} />
              <span>Reset Cache</span>
            </button>
          )}

          <div className="chess-depth-footer-right">
            <button type="button" onClick={onClose} className="btn-cancel-depth">
              Batal
            </button>
            <button type="button" onClick={handleSave} className="btn-save-depth">
              {isSaved ? <Check size={16} /> : null}
              <span>{isSaved ? 'Tersimpan!' : 'Terapkan Pengaturan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
