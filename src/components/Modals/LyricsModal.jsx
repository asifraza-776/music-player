import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';

export default function LyricsModal() {
  const { activeModal, modalData, closeModal } = useUI();
  const { currentTrack } = usePlayer();

  const [loading, setLoading] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [songMeta, setSongMeta] = useState({ title: '', artist: '' });

  useEffect(() => {
    if (activeModal !== 'lyrics') return;

    const track = modalData?.track || currentTrack?.track || '';
    const artist = modalData?.artist || currentTrack?.artist || '';

    setSongMeta({ title: track, artist });

    if (!track) {
      setLyrics('No song selected.');
      return;
    }

    setLoading(true);
    setLyrics('');

    fetch(`/api/lyrics?title=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) {
          setLyrics(data.lyrics);
        } else {
          setLyrics('Lyrics not available for this track.');
        }
      })
      .catch(() => {
        setLyrics('Unable to load lyrics at this time.');
      })
      .finally(() => setLoading(false));
  }, [activeModal, modalData, currentTrack]);

  if (activeModal !== 'lyrics') return null;

  return (
    <div
      id="lyricsModal"
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3 id="lyricsTitle" style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              {songMeta.title ? `${songMeta.title} Lyrics` : 'Song Lyrics'}
            </h3>
            <p id="lyricsArtist" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {songMeta.artist}
            </p>
          </div>
          <i className="fas fa-times close-modal" onClick={closeModal}></i>
        </div>
        <div className="modal-body" id="lyricsBody">
          {loading ? (
            <div className="loading" style={{ display: 'block', padding: '30px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
              <p style={{ marginTop: '10px' }}>Fetching lyrics...</p>
            </div>
          ) : (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: '1.8',
                fontSize: '15px',
                color: 'var(--text-light)',
                padding: '10px 0',
                maxHeight: '60vh',
                overflowY: 'auto',
              }}
            >
              {lyrics}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
