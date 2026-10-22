'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calendar, Layers, MapPin, Play, Trophy, Users } from 'lucide-react';
import type { Tournament } from '../types/chess';

interface TournamentDirectoryProps {
  tournaments: Tournament[];
  activeId: string | null;
  isAdmin?: boolean;
  onAdminOpen?: (tournamentId: string) => void;
}

function localDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')]
    .join('-');
}

function formatTournamentDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10));
  if (!match) return 'Jadwal belum ditentukan';

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getTournamentStatus(tournament: Tournament, today: string) {
  const games = tournament.matches.filter(
    (match) => !match.isBye && match.blackPlayerId !== '__bye__'
  );
  const finalRoundGames = games.filter((match) => match.round === tournament.totalRounds);
  const isComplete =
    games.length > 0 &&
    finalRoundGames.length > 0 &&
    games.every((match) => match.result != null);

  if (isComplete) return { label: 'Selesai', className: 'is-completed' };
  if (games.some((match) => match.result != null)) {
    return { label: 'Sedang berlangsung', className: 'is-in-progress' };
  }

  const eventDate = tournament.date?.slice(0, 10);
  if (!eventDate) return { label: 'Jadwal belum ditentukan', className: 'is-unscheduled' };
  if (eventDate <= today) return { label: 'Sedang berlangsung', className: 'is-in-progress' };
  return { label: 'Akan datang', className: 'is-upcoming' };
}

export function TournamentDirectory({
  tournaments,
  activeId,
  isAdmin = false,
  onAdminOpen,
}: TournamentDirectoryProps) {
  const today = localDateKey(new Date());

  return (
    <section className="section-card-panel tournament-directory" aria-labelledby="tournament-directory-title">
      <div className="section-panel-header">
        <div className="section-title-wrap">
          <Trophy size={20} aria-hidden="true" style={{ color: 'var(--gold)' }} />
          <div>
            <h1 id="tournament-directory-title" className="section-title-text">Turnamen terdaftar</h1>
            <p className="tournament-directory-description">
              Pilih turnamen untuk melihat daftar pertandingan dan klasemen.
            </p>
          </div>
        </div>
        <span className="tournament-directory-count">{tournaments.length} turnamen</span>
      </div>

      {tournaments.length === 0 ? (
        <div className="tournament-directory-empty" role="status">
          <Trophy size={34} aria-hidden="true" />
          <strong>Belum ada turnamen terdaftar</strong>
          <span>Turnamen akan muncul di sini setelah didaftarkan oleh admin.</span>
        </div>
      ) : (
        <div className="tournament-list">
          {tournaments.map((tournament) => {
            const status = getTournamentStatus(tournament, today);
            const isSelected = tournament.id === activeId;

            return (
              <article
                key={tournament.id}
                className={`tournament-card ${isSelected ? 'is-active' : ''}`}
              >
                <div className="tournament-card-main">
                  <div className="tournament-header-row">
                    <h2 className="tournament-name">{tournament.name}</h2>
                    <span className={`tournament-status-chip ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="tournament-meta-row">
                    <span className="meta-item">
                      <Calendar size={14} aria-hidden="true" />
                      <span>{formatTournamentDate(tournament.date || '')}</span>
                    </span>
                    {tournament.location && (
                      <span className="meta-item">
                        <MapPin size={14} aria-hidden="true" />
                        <span>{tournament.location}</span>
                      </span>
                    )}
                    <span className="meta-item">
                      <Users size={14} aria-hidden="true" />
                      <span>{tournament.playerIds.length} peserta</span>
                    </span>
                    <span className="meta-item">
                      <Layers size={14} aria-hidden="true" />
                      <span>{tournament.totalRounds} babak</span>
                    </span>
                    {tournament.slug && (
                      <span className="meta-item tournament-slug">
                        <span aria-hidden="true">#</span>
                        <code>{tournament.slug}</code>
                      </span>
                    )}
                  </div>
                </div>

                <div className="tournament-actions">
                  {isAdmin && onAdminOpen ? (
                    <button
                      type="button"
                      onClick={() => onAdminOpen(tournament.id)}
                      className="btn-gold-action btn-sm tournament-directory-open"
                      aria-label={`Buka dashboard admin ${tournament.name}`}
                    >
                      <Play size={14} aria-hidden="true" />
                      <span>Buka</span>
                    </button>
                  ) : tournament.slug ? (
                    <Link
                      href={`/${tournament.slug}`}
                      prefetch={true}
                      className="btn-gold-action btn-sm tournament-directory-open"
                      aria-label={`Buka turnamen ${tournament.name}`}
                    >
                      <Play size={14} aria-hidden="true" />
                      <span>Buka</span>
                    </Link>
                  ) : (
                    <span className="current-badge">
                      <ArrowUpRight size={14} aria-hidden="true" />
                      Link belum tersedia
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
