'use strict';
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Clock } from 'lucide-react';

interface ChessTimerModalProps {
  whiteName?: string;
  blackName?: string;
  onClose: () => void;
}

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && activeTurn) {
      timerRef.current = setInterval(() => {
        if (activeTurn === 'white') {
          setWhiteSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        } else {
          setBlackSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, activeTurn]);

  const handleSwitchTurn = () => {
    if (!isRunning) {
      setIsRunning(true);
      setActiveTurn('white');
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

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ padding: '0.45rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <Clock size={18} />
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'var(--font-display)' }}>
              Jam Catur Digital (Blitz & Rapid)
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.35rem', fontSize: '1.1rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Presets */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'rgba(6, 10, 18, 0.7)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {[
            { label: '3+2 Blitz', sec: 180, inc: 2 },
            { label: '5+3 Blitz', sec: 300, inc: 3 },
            { label: '10+0 Rapid', sec: 600, inc: 0 },
            { label: '15+10 Rapid', sec: 900, inc: 10 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleReset(preset.sec, preset.inc)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.75rem',
                fontFamily: 'var(--font-code)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                background:
                  initialTime === preset.sec && increment === preset.inc
                    ? 'rgba(56, 189, 248, 0.2)'
                    : 'rgba(15, 23, 42, 0.8)',
                color:
                  initialTime === preset.sec && increment === preset.inc
                    ? '#38bdf8'
                    : '#94a3b8',
                border:
                  initialTime === preset.sec && increment === preset.inc
                    ? '1px solid rgba(56, 189, 248, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Dual Clocks */}
        <div className="timer-clocks-grid">
          <div
            onClick={handleSwitchTurn}
            style={{
              padding: '1.25rem 1rem',
              borderRadius: '16px',
              border: '1.5px solid',
              borderColor: activeTurn === 'white' && isRunning ? '#38bdf8' : 'rgba(255,255,255,0.08)',
              background: activeTurn === 'white' && isRunning ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '160px',
              boxShadow: activeTurn === 'white' && isRunning ? '0 0 20px rgba(56, 189, 248, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
              PUTIH ({whiteName})
            </span>
            <div style={{ fontSize: 'clamp(2.25rem, 7vw, 3.25rem)', fontWeight: 900, fontFamily: 'var(--font-code)', margin: '0.5rem 0', color: '#fff' }}>
              {formatTime(whiteSeconds)}
            </div>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>
              {activeTurn === 'white' && isRunning ? '⚡ GILIRAN JALAN' : 'MENUNGGU'}
            </span>
          </div>

          <div
            onClick={handleSwitchTurn}
            style={{
              padding: '1.25rem 1rem',
              borderRadius: '16px',
              border: '1.5px solid',
              borderColor: activeTurn === 'black' && isRunning ? '#ffd700' : 'rgba(255,255,255,0.08)',
              background: activeTurn === 'black' && isRunning ? 'rgba(212, 175, 55, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '160px',
              boxShadow: activeTurn === 'black' && isRunning ? '0 0 20px rgba(212, 175, 55, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>
              HITAM ({blackName})
            </span>
            <div style={{ fontSize: 'clamp(2.25rem, 7vw, 3.25rem)', fontWeight: 900, fontFamily: 'var(--font-code)', margin: '0.5rem 0', color: '#fff' }}>
              {formatTime(blackSeconds)}
            </div>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>
              {activeTurn === 'black' && isRunning ? '⚡ GILIRAN JALAN' : 'MENUNGGU'}
            </span>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => handleReset()}
            className="btn-glass-secondary"
          >
            <RotateCcw size={14} />
            <span>Reset Waktu</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="btn-gold-action"
          >
            {isRunning ? (
              <>
                <Pause size={15} />
                <span>Jeda (Pause)</span>
              </>
            ) : (
              <>
                <Play size={15} />
                <span>Mulai (Start)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
