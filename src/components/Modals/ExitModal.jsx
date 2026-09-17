import React from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';

export default function ExitModal() {
  const { activeModal, closeModal } = useUI();
  const { currentTrack, isPlaying, closePlayer } = usePlayer();

  if (activeModal !== 'exit') return null;

  const handleQuit = () => {
    if (closePlayer) {
      closePlayer();
    }
    closeModal();
    try {
      window.close();
    } catch (e) {}

    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 150);
  };

  return (
    <div
      id="exitModal"
      className="modal-overlay"
      style={{ display: 'flex', zIndex: 10005 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '420px',
          textAlign: 'center',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 242, 254, 0.15)',
          position: 'relative',
          zIndex: 10006,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ justifyContent: 'center', position: 'relative', padding: '22px 20px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(255, 8, 68, 0.15)',
                border: '1px solid rgba(255, 8, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                color: 'var(--neon-pink)',
                boxShadow: '0 0 20px rgba(255, 8, 68, 0.3)',
              }}
            >
              <i className="fas fa-sign-out-alt"></i>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
              Quit MelodySphere?
            </h3>
          </div>
          <i
            className="fas fa-times close-modal"
            style={{
              position: 'absolute',
              right: '18px',
              top: '18px',
              cursor: 'pointer',
              zIndex: 20,
              padding: '8px',
              fontSize: '20px',
            }}
            onClick={(e) => {
              e.stopPropagation();
              closeModal();
            }}
            title="Close"
          ></i>
        </div>

        <div className="modal-body" style={{ padding: '16px 24px 26px', textAlign: 'center' }}>
          {currentTrack && isPlaying ? (
            <div
              style={{
                background: 'rgba(0, 242, 254, 0.08)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                borderRadius: '14px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
              }}
            >
              <img
                src={currentTrack.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'}
                alt={currentTrack.track}
                style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                }}
              />
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', color: 'var(--neon-cyan)', fontWeight: 600, textTransform: 'uppercase' }}>
                  <i className="fas fa-play" style={{ fontSize: '9px', marginRight: '4px' }}></i> Now Playing
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentTrack.track}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {currentTrack.artist}
                </div>
              </div>
            </div>
          ) : null}

          <p style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '14px', lineHeight: '1.6', marginBottom: '22px' }}>
            {currentTrack && isPlaying
              ? 'Music is currently playing. Do you want to quit the app or keep listening in the background?'
              : 'Are you sure you want to close the app or continue listening to music?'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="search-btn"
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '25px',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <i className="fas fa-play"></i> Keep Playing
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleQuit();
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '25px',
                fontWeight: 600,
                fontSize: '13.5px',
                background: 'rgba(255, 8, 68, 0.18)',
                color: '#ff6b8b',
                border: '1px solid rgba(255, 8, 68, 0.45)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <i className="fas fa-power-off"></i> Quit App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
