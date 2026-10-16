'use client';

import React, { useState, useMemo } from 'react';
import { Player, Tournament, TournamentFormData } from '../types/chess';
import {
  Trophy,
  Users,
  Plus,
  Trash2,
  Edit3,
  Search,
  Check,
  Calendar,
  MapPin,
  X,
  Database,
  Play,
  AlertCircle,
  Award,
  Layers,
} from 'lucide-react';

interface TournamentManagerProps {
  roster: Player[];
  tournaments: Tournament[];
  activeId: string | null;
  initialTab?: 'tournaments' | 'roster';
  initialCreate?: boolean;
  initialEditId?: string | null;
  dbStatus?: 'connected' | 'unconfigured' | 'offline' | 'checking';
  onClose: () => void;
  onSetActive: (tournamentId: string) => void;
  onSaveTournament: (data: TournamentFormData, editId?: string) => void;
  onDeleteTournament: (tournamentId: string) => void;
  onAddRosterPlayer: (player: Omit<Player, 'id' | 'seed'> & { id?: string }, addToActiveTournament?: boolean) => void;
  onUpdateRosterPlayer: (id: string, updates: Partial<Player>) => void;
  onDeleteRosterPlayer: (id: string) => void;
  onSyncDb?: () => Promise<void> | void;
  onResetToRookieTour?: () => Promise<void> | void;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

export const TournamentManager: React.FC<TournamentManagerProps> = ({
  roster,
  tournaments,
  activeId,
  initialTab = 'tournaments',
  initialCreate = false,
  initialEditId = null,
  dbStatus = 'checking',
  onClose,
  onSetActive,
  onSaveTournament,
  onDeleteTournament,
  onAddRosterPlayer,
  onUpdateRosterPlayer,
  onDeleteRosterPlayer,
  onSyncDb,
  onResetToRookieTour,
}) => {
  const [activeTab, setActiveTab] = useState<'tournaments' | 'roster'>(initialTab);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(initialCreate || Boolean(initialEditId));
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(initialEditId);

  // Quick add inside tournament form
  const [quickPlayerName, setQuickPlayerName] = useState<string>('');
  const [autoEnrollToActive, setAutoEnrollToActive] = useState<boolean>(true);

  // Tournament form state
  const [formName, setFormName] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formTotalRounds, setFormTotalRounds] = useState<number>(5);
  const [formPlayerIds, setFormPlayerIds] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState<string>('');

  // Roster add form state
  const [rosterName, setRosterName] = useState<string>('');
  const [rosterRating, setRosterRating] = useState<string>('1800');
  const [rosterClub, setRosterClub] = useState<string>('');
  const [rosterTitle, setRosterTitle] = useState<string>('');
  const [rosterSearch, setRosterSearch] = useState<string>('');

  // Roster editing inline state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState<string>('');
  const [editPlayerRating, setEditPlayerRating] = useState<string>('1800');
  const [editPlayerClub, setEditPlayerClub] = useState<string>('');
  const [editPlayerTitle, setEditPlayerTitle] = useState<string>('');

  // Helper to open create form
  const handleOpenCreateForm = () => {
    setEditingTournamentId(null);
    setFormName('');
    const today = new Date().toISOString().split('T')[0];
    setFormDate(today);
    setFormLocation('Kampus Politeknik Sorowako');
    setFormTotalRounds(5);
    // By default select all roster players if available
    setFormPlayerIds(roster.map((p) => p.id));
    setPickerSearch('');
    setIsFormOpen(true);
  };

  // Helper to open edit form
  const handleOpenEditForm = (t: Tournament) => {
    setEditingTournamentId(t.id);
    setFormName(t.name);
    setFormDate(t.date || '');
    setFormLocation(t.location || '');
    setFormTotalRounds(t.totalRounds || 5);
    setFormPlayerIds(t.playerIds);
    setPickerSearch('');
    setIsFormOpen(true);
  };

  // Toggle player selection in picker
  const togglePlayerSelection = (id: string) => {
    setFormPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllPlayers = () => {
    setFormPlayerIds(roster.map((p) => p.id));
  };

  const handleDeselectAllPlayers = () => {
    setFormPlayerIds([]);
  };

  const handleQuickAddPlayer = () => {
    if (!quickPlayerName.trim()) return;
    const name = quickPlayerName.trim();
    const newId = `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    onAddRosterPlayer(
      {
        id: newId,
        name,
        rating: 1500,
        club: 'Politeknik Sorowako',
      },
      true
    );
    setFormPlayerIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
    setQuickPlayerName('');
  };

  const handleSaveTournamentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Silakan masukkan nama turnamen.');
      return;
    }
    if (formPlayerIds.length < 4) {
      alert('Sistem Swiss memerlukan minimal 4 peserta.');
      return;
    }

    onSaveTournament(
      {
        name: formName.trim(),
        date: formDate,
        location: formLocation.trim(),
        totalRounds: formTotalRounds,
        playerIds: formPlayerIds,
      },
      editingTournamentId || undefined
    );
    setIsFormOpen(false);
  };

  // Roster addition
  const handleAddRosterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterName.trim()) {
      alert('Silakan masukkan nama peserta.');
      return;
    }
    const name = rosterName.trim();
    onAddRosterPlayer(
      {
        name,
        rating: parseInt(rosterRating, 10) || 1800,
        club: rosterClub.trim() || undefined,
        title: (rosterTitle as Player['title']) || undefined,
      },
      autoEnrollToActive
    );
    setRosterName('');
    setRosterRating('1800');
    setRosterClub('');
    setRosterTitle('');
  };

  // Roster edit helpers
  const handleStartEditPlayer = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditPlayerName(p.name);
    setEditPlayerRating(String(p.rating || 1800));
    setEditPlayerClub(p.club || '');
    setEditPlayerTitle(p.title || '');
  };

  const handleSaveEditPlayer = () => {
    if (!editingPlayerId || !editPlayerName.trim()) return;
    onUpdateRosterPlayer(editingPlayerId, {
      name: editPlayerName.trim(),
      rating: parseInt(editPlayerRating, 10) || 1800,
      club: editPlayerClub.trim() || undefined,
      title: (editPlayerTitle as Player['title']) || undefined,
    });
    setEditingPlayerId(null);
  };

  // Player usage count in tournaments
  const getPlayerTournamentCount = (playerId: string) => {
    return tournaments.filter((t) => t.playerIds.includes(playerId)).length;
  };

  const handleDeletePlayerSafely = (p: Player) => {
    const usedIn = tournaments.filter((t) => t.playerIds.includes(p.id));
    if (usedIn.length > 0) {
      const names = usedIn.map((t) => `"${t.name}"`).join(', ');
      alert(
        `Peserta "${p.name}" tidak dapat dihapus karena sedang terdaftar di turnamen: ${names}. Hapus peserta dari turnamen terkait terlebih dahulu.`
      );
      return;
    }
    if (confirm(`Hapus peserta "${p.name}" dari database peserta?`)) {
      onDeleteRosterPlayer(p.id);
    }
  };

  // Filtered views
  const filteredPickerRoster = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    if (!q) return roster;
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.club && p.club.toLowerCase().includes(q)) ||
        (p.title && p.title.toLowerCase().includes(q))
    );
  }, [roster, pickerSearch]);

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.toLowerCase().trim();
    if (!q) return roster;
    return roster.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.club && p.club.toLowerCase().includes(q)) ||
        (p.title && p.title.toLowerCase().includes(q))
    );
  }, [roster, rosterSearch]);

  return (
    <div className="modal-overlay">
      <div className="modal-box manager-box">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Trophy className="modal-title-icon" size={22} />
            <span>Kelola turnamen & peserta</span>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Database Status Ribbon */}
        <div className="db-status-bar">
          <div className="db-status-left">
            <span
              className={`db-status-dot ${
                dbStatus === 'connected' ? 'connected' : dbStatus === 'unconfigured' ? 'unconfigured' : 'offline'
              }`}
            />
            <span className="db-status-label">
              {dbStatus === 'connected'
                ? 'PostgreSQL Vercel: Terhubung & Tersinkron'
                : dbStatus === 'unconfigured'
                ? 'Penyimpanan Lokal Aktif (Tambahkan POSTGRES_URL di Vercel untuk sinkronisasi cloud)'
                : dbStatus === 'checking'
                ? 'Memeriksa status PostgreSQL...'
                : 'Mode Offline (LocalStorage)'}
            </span>
          </div>
          <div className="db-status-actions">
            {onSyncDb && dbStatus === 'connected' && (
              <button
                type="button"
                onClick={() => onSyncDb()}
                className="db-sync-btn"
                title="Tarik pembaruan dari PostgreSQL"
              >
                <Database size={13} />
                <span>Sync DB</span>
              </button>
            )}
            {onResetToRookieTour && (
              <button
                type="button"
                onClick={() => onResetToRookieTour()}
                className="db-sync-btn reset"
                title="Reset dan isi data turnamen ke ROOKIE TOUR CHESS & 4 peserta"
              >
                <Database size={13} />
                <span>Seed ROOKIE TOUR</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="manager-tabs">
          <button
            type="button"
            className={`manager-tab ${activeTab === 'tournaments' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tournaments');
              setIsFormOpen(false);
            }}
          >
            <Layers size={16} />
            <span>Daftar turnamen ({tournaments.length})</span>
          </button>
          <button
            type="button"
            className={`manager-tab ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('roster');
              setIsFormOpen(false);
            }}
          >
            <Database size={16} />
            <span>Database peserta ({roster.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body manager-body">
          {/* TAB 1: TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <div>
              {/* Form Create/Edit Tournament */}
              {isFormOpen ? (
                <div className="form-card">
                  <div className="form-card-header">
                    <h3 className="form-card-title">
                      {editingTournamentId ? 'Ubah informasi turnamen' : 'Buat turnamen baru'}
                    </h3>
                    <p className="form-card-subtitle">
                      Tentukan nama turnamen, tanggal, lokasi, jumlah babak Swiss, dan pilih peserta dari database.
                    </p>
                  </div>

                  <form onSubmit={handleSaveTournamentSubmit} className="tournament-form">
                    <div className="form-grid">
                      <div className="form-field full-col">
                        <label className="form-label">
                          Nama turnamen <span className="req">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="Contoh: Turnamen Dies Natalis Poltek Sorowako 2026"
                          className="form-input-text"
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label">Tanggal pelaksanaan</label>
                        <input
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="form-input-text"
                        />
                      </div>

                      <div className="form-field">
                        <label className="form-label">Lokasi turnamen</label>
                        <input
                          type="text"
                          value={formLocation}
                          onChange={(e) => setFormLocation(e.target.value)}
                          placeholder="Contoh: Kampus Politeknik Sorowako"
                          className="form-input-text"
                        />
                      </div>

                      <div className="form-field full-col">
                        <label className="form-label">Jumlah babak (sistem Swiss)</label>
                        <select
                          value={formTotalRounds}
                          onChange={(e) => setFormTotalRounds(parseInt(e.target.value, 10))}
                          className="form-input-text"
                        >
                          {[3, 4, 5, 6, 7, 8, 9].map((r) => (
                            <option key={r} value={r}>
                              {r} babak resmi
                            </option>
                          ))}
                        </select>
                        <span className="field-hint">
                          Disarankan 5 babak untuk 8-16 pemain, atau 7 babak untuk 16-32 pemain.
                        </span>
                      </div>
                    </div>

                    {/* Participant Picker */}
                    <div className="picker-section">
                      <div className="picker-header">
                        <div>
                          <label className="form-label" style={{ marginBottom: '0.2rem' }}>
                            Pilih peserta ({formPlayerIds.length} dari {roster.length} terpilih)
                          </label>
                          <p className="picker-subtext">Minimal 4 peserta untuk sistem pairing Swiss.</p>
                        </div>
                        <div className="picker-actions">
                          <button
                            type="button"
                            onClick={handleSelectAllPlayers}
                            className="btn-compact"
                          >
                            Pilih semua
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllPlayers}
                            className="btn-compact"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>

                      <div className="search-box">
                        <Search size={15} style={{ color: 'var(--text-sub)' }} />
                        <input
                          type="text"
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Cari peserta dalam database..."
                          className="search-input"
                        />
                        {pickerSearch && (
                          <button
                            type="button"
                            onClick={() => setPickerSearch('')}
                            className="search-clear-btn"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="picker-quick-add">
                        <input
                          type="text"
                          value={quickPlayerName}
                          onChange={(e) => setQuickPlayerName(e.target.value)}
                          placeholder="+ Tambah nama peserta baru langsung..."
                          className="quick-add-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddPlayer();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleQuickAddPlayer}
                          disabled={!quickPlayerName.trim()}
                          className="btn-quick-add"
                        >
                          <Plus size={14} />
                          <span>Tambah</span>
                        </button>
                      </div>

                      <div className="picker-list">
                        {filteredPickerRoster.length === 0 ? (
                          <div className="picker-empty">
                            Tidak ada peserta yang cocok dengan pencarian.
                          </div>
                        ) : (
                          filteredPickerRoster.map((p) => {
                            const isSelected = formPlayerIds.includes(p.id);
                            return (
                              <div
                                key={p.id}
                                onClick={() => togglePlayerSelection(p.id)}
                                className={`picker-row ${isSelected ? 'selected' : ''}`}
                              >
                                <div className="picker-checkbox">
                                  {isSelected && <Check size={14} color="#ffffff" />}
                                </div>
                                <span className="mini-avatar">{getInitials(p.name)}</span>
                                <div className="picker-info">
                                  <div className="picker-name-row">
                                    <span className="picker-name">{p.name}</span>
                                    {p.title && <span className="title-tag">{p.title}</span>}
                                  </div>
                                  <div className="picker-meta">
                                    {p.club || 'Politeknik Sorowako'} • {p.rating || 1800} Elo
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {formPlayerIds.length < 4 && (
                        <div className="alert-box-warning">
                          <AlertCircle size={15} />
                          <span>Pilih minimal 4 peserta agar babak turnamen Swiss dapat dipasangkan.</span>
                        </div>
                      )}
                    </div>

                    {/* Form Buttons */}
                    <div className="form-actions">
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="btn-glass-secondary"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={formPlayerIds.length < 4 || !formName.trim()}
                        className="btn-gold-action"
                      >
                        <Check size={16} />
                        <span>{editingTournamentId ? 'Simpan perubahan' : 'Buat & buka turnamen'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Tournament List View */
                <div>
                  <div className="manager-toolbar">
                    <p className="toolbar-hint">
                      Pilih turnamen untuk ditampilkan di dashboard, atau buat turnamen baru.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenCreateForm}
                      className="btn-gold-action"
                    >
                      <Plus size={16} />
                      <span>Buat turnamen baru</span>
                    </button>
                  </div>

                  <div className="tournament-list">
                    {tournaments.length === 0 ? (
                      <div className="empty-state">
                        <Trophy size={40} style={{ color: 'var(--gold)', margin: '0 auto 1rem' }} />
                        <h4 className="empty-title">Belum ada turnamen</h4>
                        <p className="empty-desc">
                          Klik tombol &quot;Buat turnamen baru&quot; di atas untuk memulai turnamen catur sistem Swiss pertama Anda.
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenCreateForm}
                          className="btn-gold-action"
                          style={{ margin: '1rem auto 0' }}
                        >
                          <Plus size={15} />
                          <span>Buat turnamen sekarang</span>
                        </button>
                      </div>
                    ) : (
                      tournaments.map((t) => {
                        const isActive = t.id === activeId;
                        const formattedDate = t.date
                          ? new Date(t.date).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Jadwal belum ditentukan';

                        return (
                          <div
                            key={t.id}
                            className={`tournament-card ${isActive ? 'is-active' : ''}`}
                          >
                            <div className="tournament-card-main">
                              <div className="tournament-header-row">
                                <h4 className="tournament-name">{t.name}</h4>
                                {isActive && <span className="active-chip">Sedang aktif</span>}
                              </div>

                              <div className="tournament-meta-row">
                                <span className="meta-item">
                                  <Calendar size={14} />
                                  <span>{formattedDate}</span>
                                </span>
                                {t.location && (
                                  <span className="meta-item">
                                    <MapPin size={14} />
                                    <span>{t.location}</span>
                                  </span>
                                )}
                                <span className="meta-item">
                                  <Users size={14} />
                                  <span>{t.playerIds.length} peserta</span>
                                </span>
                                <span className="meta-item">
                                  <Layers size={14} />
                                  <span>{t.totalRounds} babak</span>
                                </span>
                              </div>
                            </div>

                            <div className="tournament-actions">
                              {!isActive ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSetActive(t.id);
                                    onClose();
                                  }}
                                  className="btn-gold-action btn-sm"
                                  title="Buka turnamen ini di dashboard"
                                >
                                  <Play size={14} />
                                  <span>Buka</span>
                                </button>
                              ) : (
                                <span className="current-badge">Dibuka</span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(t)}
                                className="btn-glass-secondary btn-sm"
                                title="Ubah informasi turnamen"
                              >
                                <Edit3 size={14} />
                                <span>Ubah</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Apakah Anda yakin ingin menghapus turnamen "${t.name}"? Data hasil pertandingan akan dihapus permanen.`
                                    )
                                  ) {
                                    onDeleteTournament(t.id);
                                  }
                                }}
                                className="danger-icon-btn"
                                title="Hapus turnamen"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ROSTER (DATABASE PESERTA) */}
          {activeTab === 'roster' && (
            <div className="roster-view">
              {/* Add participant form */}
              <div className="form-card roster-add-card">
                <div className="form-card-header">
                  <h3 className="form-card-title">Tambah peserta ke database</h3>
                  <p className="form-card-subtitle">
                    Peserta yang didaftarkan di sini akan tersimpan di database dan dapat dipilih untuk turnamen apa pun.
                  </p>
                </div>

                <form onSubmit={handleAddRosterSubmit} className="roster-add-form">
                  <div className="roster-form-grid">
                    <div className="form-field flex-2">
                      <label className="form-label">
                        Nama lengkap peserta <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={rosterName}
                        onChange={(e) => setRosterName(e.target.value)}
                        placeholder="Contoh: Muhammad Reza"
                        className="form-input-text"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Rating Elo</label>
                      <input
                        type="number"
                        value={rosterRating}
                        onChange={(e) => setRosterRating(e.target.value)}
                        placeholder="1800"
                        className="form-input-text"
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-label">Gelar catur</label>
                      <select
                        value={rosterTitle}
                        onChange={(e) => setRosterTitle(e.target.value)}
                        className="form-input-text"
                      >
                        <option value="">Non-Gelar</option>
                        <option value="NM">NM (Master Nasional)</option>
                        <option value="CM">CM (Candidate Master)</option>
                        <option value="FM">FM (FIDE Master)</option>
                        <option value="IM">IM (International Master)</option>
                        <option value="GM">GM (Grandmaster)</option>
                        <option value="WNM">WNM (Wanita MN)</option>
                        <option value="WFM">WFM (Wanita FM)</option>
                        <option value="WIM">WIM (Wanita IM)</option>
                        <option value="WGM">WGM (Wanita GM)</option>
                      </select>
                    </div>

                    <div className="form-field flex-2">
                      <label className="form-label">Klub / Jurusan / Instansi</label>
                      <input
                        type="text"
                        value={rosterClub}
                        onChange={(e) => setRosterClub(e.target.value)}
                        placeholder="Contoh: Politeknik Sorowako"
                        className="form-input-text"
                      />
                    </div>
                  </div>

                  <div className="roster-add-actions">
                    <label className="checkbox-auto-enroll">
                      <input
                        type="checkbox"
                        checked={autoEnrollToActive}
                        onChange={(e) => setAutoEnrollToActive(e.target.checked)}
                      />
                      <span>Daftarkan langsung ke turnamen aktif saat ini</span>
                    </label>

                    <button
                      type="submit"
                      disabled={!rosterName.trim()}
                      className="btn-gold-action"
                    >
                      <Plus size={16} />
                      <span>Tambah ke database</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Roster list toolbar & search */}
              <div className="roster-toolbar">
                <div className="search-box grow">
                  <Search size={15} style={{ color: 'var(--text-sub)' }} />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Cari nama peserta, klub, atau gelar..."
                    className="search-input"
                  />
                  {rosterSearch && (
                    <button
                      type="button"
                      onClick={() => setRosterSearch('')}
                      className="search-clear-btn"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <span className="roster-count-chip">
                  Total {filteredRoster.length} peserta
                </span>
              </div>

              {/* Roster participants list */}
              <div className="roster-list">
                {filteredRoster.length === 0 ? (
                  <div className="empty-state">
                    <Users size={36} style={{ color: 'var(--text-sub)', margin: '0 auto 0.5rem' }} />
                    <p className="empty-desc">Tidak ada peserta yang ditemukan.</p>
                  </div>
                ) : (
                  filteredRoster.map((p) => {
                    const isEditing = editingPlayerId === p.id;
                    const usedCount = getPlayerTournamentCount(p.id);

                    if (isEditing) {
                      return (
                        <div key={p.id} className="roster-row editing">
                          <div className="roster-edit-grid">
                            <input
                              type="text"
                              value={editPlayerName}
                              onChange={(e) => setEditPlayerName(e.target.value)}
                              placeholder="Nama peserta"
                              className="form-input-text"
                            />
                            <input
                              type="number"
                              value={editPlayerRating}
                              onChange={(e) => setEditPlayerRating(e.target.value)}
                              placeholder="Elo"
                              className="form-input-text"
                            />
                            <select
                              value={editPlayerTitle}
                              onChange={(e) => setEditPlayerTitle(e.target.value)}
                              className="form-input-text"
                            >
                              <option value="">Non-Gelar</option>
                              <option value="NM">NM</option>
                              <option value="CM">CM</option>
                              <option value="FM">FM</option>
                              <option value="IM">IM</option>
                              <option value="GM">GM</option>
                              <option value="WNM">WNM</option>
                              <option value="WFM">WFM</option>
                              <option value="WIM">WIM</option>
                              <option value="WGM">WGM</option>
                            </select>
                            <input
                              type="text"
                              value={editPlayerClub}
                              onChange={(e) => setEditPlayerClub(e.target.value)}
                              placeholder="Klub / Instansi"
                              className="form-input-text"
                            />
                          </div>
                          <div className="roster-edit-actions">
                            <button
                              type="button"
                              onClick={handleSaveEditPlayer}
                              className="btn-gold-action btn-sm"
                            >
                              <Check size={14} />
                              <span>Simpan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPlayerId(null)}
                              className="btn-glass-secondary btn-sm"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={p.id} className="roster-row">
                        <div className="roster-row-main">
                          <span className="mini-avatar">{getInitials(p.name)}</span>
                          <div className="roster-player-info">
                            <div className="roster-name-line">
                              <span className="roster-name">{p.name}</span>
                              {p.title && <span className="title-tag">{p.title}</span>}
                              <span className="roster-elo-chip">{p.rating || 1800} Elo</span>
                            </div>
                            <div className="roster-meta-line">
                              <span>{p.club || 'Politeknik Sorowako'}</span>
                              <span className="dot-sep">•</span>
                              <span className="usage-info">
                                Terdaftar di {usedCount} turnamen
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="roster-actions">
                          <button
                            type="button"
                            onClick={() => handleStartEditPlayer(p)}
                            className="btn-glass-secondary btn-sm"
                            title="Edit data peserta"
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlayerSafely(p)}
                            className="danger-icon-btn"
                            title="Hapus peserta dari database"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-glass-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
