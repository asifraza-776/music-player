import React from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';

export default function ExitAppModal() {
  const { showExitPrompt, closeExitPrompt, confirmExit } = useUI();
  const { currentTrack, isPlaying } = usePlayer();

  if (!showExitPrompt) return null;

  return (
    <div
      id="exitAppModal"
      className="modal-overlay"
      style={{ display: 'flex', zIndex: 10002 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeExitPrompt();
      }}
    >
      <div
        className="modal-card exit-modal-card"
        style={{
          maxWidth: '400px',
          textAlign: 'center',
          border: '1px solid rgba(255, 8, 68, 0.4)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 30px rgba(255, 8, 68, 0.2)',
        }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 8, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--neon-pink)',
              }}
            >
              <i className="fas fa-sign-out-alt"></i>
            </span>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>Quit MelodySphere?</h3>
          </div>
          <i className="fas fa-times close-modal" onClick={closeExitPrompt}></i>
        </div>

        <div className="modal-body" style={{ padding: '24px 20px 28px', textAlign: 'center' }}>
          {isPlaying && currentTrack ? (
            <div
              style={{
                background: 'rgba(0, 242, 254, 0.08)',
                border: '1px solid rgba(0, 242, 254, 0.25)',
                borderRadius: '14px',
                padding: '12px 14px',
                marginBottom: '18px',
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
              />
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--neon-cyan)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Currently Playing
                </div>
                <div style={{ fontSize: '13.5px', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.track}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentTrack.artist}
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
              Are you sure you want to exit the application?
            </p>
          )}

          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13.5px', marginBottom: '22px' }}>
            Do you want to close the app or continue listening?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              className="search-btn"
              onClick={closeExitPrompt}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '25px',
                fontSize: '14.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-play"></i> Continue Listening
            </button>
            <button
              onClick={confirmExit}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '25px',
                background: 'rgba(255, 8, 68, 0.12)',
                border: '1px solid rgba(255, 8, 68, 0.35)',
                color: '#ff6b8b',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <i className="fas fa-door-open"></i> Quit App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
