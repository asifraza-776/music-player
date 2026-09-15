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

    const track = modalData?.track || modalData?.title || currentTrack?.track || '';
    const artist = modalData?.artist || currentTrack?.artist || '';
    const id = modalData?.id || currentTrack?.id || '';

    setSongMeta({ title: track, artist });

    if (!track) {
      setLyrics('Please play a song first to view lyrics!');
      return;
    }

    setLoading(true);
    setLyrics('');

    const queryParams = new URLSearchParams({
      id: id || '',
      track: track || '',
      artist: artist || '',
    });

    fetch(`/api/saavn/lyrics?${queryParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.lyrics) {
          setLyrics(data.lyrics);
        } else if (data.lyrics) {
          setLyrics(data.lyrics);
        } else {
          setLyrics('Lyrics not available for this song.');
        }
      })
      .catch(() => {
        setLyrics('Could not load lyrics. Please try again.');
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
        <div
          className="modal-body"
          id="lyricsBody"
          style={{ maxHeight: '65vh', overflowY: 'auto', padding: '15px 20px' }}
        >
          {loading ? (
            <div className="loading" style={{ display: 'block', padding: '30px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
              <p style={{ marginTop: '10px' }}>Fetching lyrics...</p>
            </div>
          ) : (
            <div
              style={{
                fontSize: '16px',
                lineHeight: '2.2',
                color: '#fff',
                textAlign: 'center',
                padding: '10px 0',
              }}
              dangerouslySetInnerHTML={{
                __html: lyrics ? lyrics.replace(/\n/g, '<br>') : 'Lyrics not available for this song.',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
