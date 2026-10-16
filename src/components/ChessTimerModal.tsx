'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Clock } from 'lucide-react';

interface ChessTimerModalProps {
  whiteName?: string;
  blackName?: string;
  onClose: () => void;
}

const PRESETS = [
  { label: '3+2 Blitz', sec: 180, inc: 2 },
  { label: '5+3 Blitz', sec: 300, inc: 3 },
  { label: '10+0 Rapid', sec: 600, inc: 0 },
  { label: '15+10 Rapid', sec: 900, inc: 10 },
];

export const ChessTimerModal: React.FC<ChessTimerModalProps> = ({
  whiteName = 'Putih',
  blackName = 'Hitam',
  onClose,
}) => {
  const [initialTime, setInitialTime] = useState<number>(300);
  const [increment, setIncrement] = useState<number>(2);
  const [whiteSeconds, setWhiteSeconds] = useState<number>(300);
  const [blackSeconds, setBlackSeconds] = useState<number>(300);
  const [activeTurn, setActiveTurn] = useState<'white' | 'black' | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flagFell = whiteSeconds === 0 || blackSeconds === 0;

  useEffect(() => {
    if (isRunning && activeTurn) {
      timerRef.current = setInterval(() => {
        if (activeTurn === 'white') {
          setWhiteSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        } else {
          setBlackSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        }
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, activeTurn]);

  // Stop the clock automatically when a flag falls
  useEffect(() => {
    if (flagFell) setIsRunning(false);
  }, [flagFell]);

  const handleSwitchTurn = () => {
    if (flagFell) return;
    if (!isRunning) {
      setIsRunning(true);
      setActiveTurn(activeTurn ?? 'white');
      return;
    }
    if (activeTurn === 'white') {
      setWhiteSeconds((s) => s + increment);
      setActiveTurn('black');
    } else {
      setBlackSeconds((s) => s + increment);
      setActiveTurn('white');
    }
  };

  const handleReset = (sec = initialTime, inc = increment) => {
    setIsRunning(false);
    setActiveTurn(null);
    setInitialTime(sec);
    setIncrement(inc);
    setWhiteSeconds(sec);
    setBlackSeconds(sec);
  };

  // Spacebar switches turn, Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSwitchTurn();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const stateLabel = (side: 'white' | 'black', seconds: number) => {
    if (seconds === 0) return '⏰ WAKTU HABIS';
    return activeTurn === side && isRunning ? '⚡ GILIRAN JALAN' : 'MENUNGGU';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-title-icon">
              <Clock size={18} />
            </span>
            Jam Catur Digital
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="timer-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleReset(preset.sec, preset.inc)}
              className={`preset-btn ${
                initialTime === preset.sec && increment === preset.inc ? 'active' : ''
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="timer-clocks-grid">
          <div
            onClick={handleSwitchTurn}
            className={`timer-clock ${activeTurn === 'white' && isRunning ? 'active-white' : ''}`}
          >
            <span className="timer-clock-label">PUTIH ({whiteName})</span>
            <div className="timer-clock-time">{formatTime(whiteSeconds)}</div>
            <span className="timer-clock-state">{stateLabel('white', whiteSeconds)}</span>
          </div>

          <div
            onClick={handleSwitchTurn}
            className={`timer-clock ${activeTurn === 'black' && isRunning ? 'active-black' : ''}`}
          >
            <span className="timer-clock-label">HITAM ({blackName})</span>
            <div className="timer-clock-time">{formatTime(blackSeconds)}</div>
            <span className="timer-clock-state">{stateLabel('black', blackSeconds)}</span>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" onClick={() => handleReset()} className="btn-glass-secondary">
            <RotateCcw size={14} />
            <span>Reset Waktu</span>
          </button>

          <span className="section-hint">Tekan Spasi untuk ganti giliran</span>

          <button
            type="button"
            onClick={() => (isRunning ? setIsRunning(false) : handleSwitchTurn())}
            disabled={flagFell}
            className="btn-gold-action"
          >
            {isRunning ? (
              <>
                <Pause size={15} />
                <span>Jeda</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Mulai</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
