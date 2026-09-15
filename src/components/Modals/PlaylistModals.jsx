import React, { useState } from 'react';
import { useUI } from '../../context/UIContext';
import { useLibrary } from '../../context/LibraryContext';

export function CreatePlaylistModal() {
  const { activeModal, closeModal, showToast } = useUI();
  const { createPlaylist } = useLibrary();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  if (activeModal !== 'createPl') return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('Please enter a playlist name', '', 'warning');
      return;
    }

    setLoading(true);
    const created = await createPlaylist(name.trim(), desc.trim());
    setLoading(false);

    if (created) {
      showToast('Playlist created!', name.trim(), 'success');
      setName('');
      setDesc('');
      closeModal();
    } else {
      showToast('Failed to create playlist', '', 'error');
    }
  };

  return (
    <div
      id="createPlaylistModal"
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal-card create-pl-card" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-plus-circle" style={{ color: 'var(--neon-cyan)' }}></i> New Playlist
          </h3>
          <i className="fas fa-times close-modal" onClick={closeModal}></i>
        </div>
        <div className="modal-body" style={{ padding: '20px', textAlign: 'left' }}>
          <div className="modal-input-group">
            <label className="modal-label">
              <i className="fas fa-music"></i> Playlist Name
            </label>
            <input
              type="text"
              id="newPlaylistName"
              className="modal-input"
              placeholder="e.g. My Favorites, Gym Energy..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">
              <i className="fas fa-align-left"></i> Description (Optional)
            </label>
            <input
              type="text"
              id="newPlaylistDesc"
              className="modal-input"
              placeholder="e.g. Best tracks for late night chill"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button
            className="modal-submit-btn"
            id="createPlaylistBtn"
            onClick={handleSubmit}
            disabled={loading}
          >
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>{' '}
            {loading ? 'Creating...' : 'Create & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddToPlaylistModal() {
  const { activeModal, modalData, closeModal, openModal, showToast } = useUI();
  const { library, addTrackToPlaylist } = useLibrary();

  if (activeModal !== 'addToPl' || !modalData) return null;

  const targetTrack = modalData;
  const playlists = library.customPlaylists || [];

  const handleSelectPlaylist = async (playlistId, playlistName) => {
    const res = await addTrackToPlaylist(playlistId, {
      track: targetTrack.track,
      artist: targetTrack.artist,
      image: targetTrack.image || '',
    });

    if (res.success) {
      showToast(`Added to "${playlistName}"`, targetTrack.track, 'success');
      closeModal();
    } else {
      showToast(res.error || 'Failed to add to playlist', '', 'error');
    }
  };

  return (
    <div
      id="addToPlaylistModal"
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal-card" style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              <i className="fas fa-folder-plus" style={{ color: 'var(--neon-cyan)' }}></i> Add to Playlist
            </h3>
            <p id="addToPlSongTitle" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Add "{targetTrack.track}" by {targetTrack.artist}
            </p>
          </div>
          <i className="fas fa-times close-modal" onClick={closeModal}></i>
        </div>
        <div className="modal-body" style={{ padding: '20px' }}>
          <button
            className="search-btn"
            onClick={() => openModal('createPl')}
            style={{ width: '100%', borderRadius: '15px', marginBottom: '15px', padding: '12px' }}
          >
            <i className="fas fa-plus"></i> Create New Playlist
          </button>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
            YOUR PLAYLISTS
          </div>
          <div
            id="userPlaylistsList"
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto', paddingRight: '5px' }}
          >
            {playlists.length === 0 ? (
              <p style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No custom playlists yet. Create one above!
              </p>
            ) : (
              playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="user-pl-item"
                  onClick={() => handleSelectPlaylist(pl.id, pl.name)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{pl.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(pl.tracks || []).length} Tracks</div>
                  </div>
                  <i className="fas fa-plus-circle" style={{ color: 'var(--neon-cyan)', fontSize: '18px' }}></i>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
