'use client';

import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  X,
  Trophy,
  Zap,
  Flame,
  Clock,
  ShieldAlert,
  Loader2,
  Calendar,
  Globe,
  Award,
} from 'lucide-react';
import {
  fetchFullChessComPlayer,
  ChessComPlayerDetails,
  sanitizeChessComUsername,
} from '../utils/chessComApi';

interface ChessComProfileModalProps {
  isOpen: boolean;
  username: string | null;
  onClose: () => void;
  /** Optional fallback display name (e.g. from local tournament roster) */
  localPlayerName?: string;
  /** Callback when real Chess.com avatar is fetched so parent can save it locally */
  onAvatarSync?: (username: string, avatarUrl: string) => void;
}

export const ChessComProfileModal: React.FC<ChessComProfileModalProps> = ({
  isOpen,
  username,
  onClose,
  localPlayerName,
  onAvatarSync,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ChessComPlayerDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !username) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const cleanUser = sanitizeChessComUsername(username);

    fetchFullChessComPlayer(cleanUser)
      .then((res) => {
        if (!isMounted) return;
        if (!res) {
          setError(`Akun Chess.com "${cleanUser}" tidak ditemukan atau berstatus privat.`);
        } else {
          setData(res);
          if (res.profile.avatar && onAvatarSync) {
            onAvatarSync(cleanUser, res.profile.avatar);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError('Gagal memuat data dari Chess.com. Silakan periksa koneksi internet.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, username]);

  if (!isOpen || !username) return null;

  const profile = data?.profile;
  const stats = data?.stats;

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('id-ID', {
      month: 'short',
      year: 'numeric',
    });
  };

  const calcWinRate = (record?: { win: number; loss: number; draw: number }) => {
    if (!record) return null;
    const total = record.win + record.loss + record.draw;
    if (total === 0) return '0%';
    const pct = Math.round((record.win / total) * 100);
    return `${pct}%`;
  };

  return (
    <div className="chesscom-modal-backdrop" onClick={onClose}>
      <div
        className="chesscom-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="chesscom-modal-header">
          <div className="chesscom-brand-tag">
            <span className="chesscom-pawn-icon">♟</span>
            <span>CHESS.COM VERIFIED PROFILE</span>
          </div>
          <button
            onClick={onClose}
            className="chesscom-close-btn"
            title="Tutup (Esc)"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="chesscom-modal-body">
          {loading ? (
            <div className="chesscom-loading-state">
              <Loader2 size={36} className="chesscom-spinner" />
              <p>Menghubungkan ke server Chess.com...</p>
              <span>Mengambil rating & statistik akun @{username}</span>
            </div>
          ) : error ? (
            <div className="chesscom-error-state">
              <ShieldAlert size={40} className="chesscom-error-icon" />
              <h4>Pemain Tidak Ditemukan</h4>
              <p>{error}</p>
              <a
                href={`https://www.chess.com/member/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="chesscom-action-btn primary"
              >
                Cari Manual di Chess.com <ExternalLink size={14} />
              </a>
            </div>
          ) : profile && stats ? (
            <>
              {/* Profile Bar */}
              <div className="chesscom-profile-card">
                <div className="chesscom-avatar-wrap">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.username}
                      referrerPolicy="no-referrer"
                      className="chesscom-avatar-img"
                    />
                  ) : (
                    <div className="chesscom-avatar-placeholder">
                      {profile.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {profile.title && (
                    <span className="chesscom-title-badge">{profile.title}</span>
                  )}
                </div>

                <div className="chesscom-profile-meta">
                  <div className="chesscom-name-row">
                    <h3 className="chesscom-name-heading">
                      {profile.name || localPlayerName || profile.username}
                    </h3>
                  </div>
                  <div className="chesscom-username-sub">
                    <span>@{profile.username}</span>
                    {profile.countryCode && (
                      <span className="chesscom-country-badge">
                        <Globe size={11} /> {profile.countryCode}
                      </span>
                    )}
                    {profile.joined && (
                      <span className="chesscom-joined-badge">
                        <Calendar size={11} /> Sejak {formatDate(profile.joined)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="chesscom-stats-section">
                <h4 className="chesscom-stats-title">
                  <Award size={15} style={{ color: 'var(--gold)' }} />
                  Rating Resmi Chess.com
                </h4>

                <div className="chesscom-stats-grid">
                  {/* Rapid */}
                  <div className="chesscom-rating-card rapid">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Clock size={16} />
                        <span>Rapid</span>
                      </div>
                      <span className="rating-number">
                        {stats.rapid?.rating || '-'}
                      </span>
                    </div>
                    {stats.rapid?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.rapid.record.win}M</span>
                        <span className="rec-draw">{stats.rapid.record.draw}R</span>
                        <span className="rec-loss">{stats.rapid.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.rapid.record)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Blitz */}
                  <div className="chesscom-rating-card blitz">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Zap size={16} />
                        <span>Blitz</span>
                      </div>
                      <span className="rating-number">
                        {stats.blitz?.rating || '-'}
                      </span>
                    </div>
                    {stats.blitz?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.blitz.record.win}M</span>
                        <span className="rec-draw">{stats.blitz.record.draw}R</span>
                        <span className="rec-loss">{stats.blitz.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.blitz.record)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bullet */}
                  <div className="chesscom-rating-card bullet">
                    <div className="rating-card-top">
                      <div className="rating-type">
                        <Flame size={16} />
                        <span>Bullet</span>
                      </div>
                      <span className="rating-number">
                        {stats.bullet?.rating || '-'}
                      </span>
                    </div>
                    {stats.bullet?.record && (
                      <div className="rating-record-row">
                        <span className="rec-win">{stats.bullet.record.win}M</span>
                        <span className="rec-draw">{stats.bullet.record.draw}R</span>
                        <span className="rec-loss">{stats.bullet.record.loss}K</span>
                        <span className="rec-rate">
                          Win {calcWinRate(stats.bullet.record)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer action */}
              <div className="chesscom-modal-footer">
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chesscom-action-btn primary"
                >
                  Buka Profil di Chess.com <ExternalLink size={14} />
                </a>
                <button onClick={onClose} className="chesscom-action-btn secondary">
                  Tutup
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
