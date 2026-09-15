import React, { useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useUI } from '../../context/UIContext';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isPlayerVisible,
    ambientGlow,
    sleepTimer,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    changeVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    closePlayer,
  } = usePlayer();

  const { isTrackLiked, toggleTrackLike } = useLibrary();
  const { openModal } = useUI();

  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const liked = currentTrack?.track ? isTrackLiked(currentTrack.track, currentTrack.artist || '') : false;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayProgress = isDragging ? dragProgress : progressPercent;

  const downloadUrl = currentTrack?.track
    ? `/api/saavn/download?title=${encodeURIComponent(currentTrack.track)}&artist=${encodeURIComponent(currentTrack.artist || '')}`
    : '#';

  return (
    <div
      id="playerContainer"
      style={{
        display: isPlayerVisible ? 'block' : 'none',
        boxShadow: isPlayerVisible
          ? (ambientGlow ? `0 -10px 45px ${ambientGlow}` : '0 -8px 40px rgba(0, 0, 0, 0.8), 0 -1px 0 rgba(0, 242, 254, 0.06)')
          : 'none',
      }}
    >
      <div className="player-content">
        {/* Full Width Progress Bar Row */}
        <div className="player-progress-wrap" id="mobileProgressRow">
          <span id="currentTime">
            {formatTime(isDragging ? (dragProgress / 100) * (duration || 0) : currentTime)}
          </span>
          <input
            type="range"
            id="progressBar"
            className="custom-slider"
            value={displayProgress || 0}
            min="0"
            max="100"
            step="0.1"
            style={{
              background: `linear-gradient(to right, var(--neon-cyan) 0%, var(--neon-cyan) ${displayProgress}%, rgba(255, 255, 255, 0.2) ${displayProgress}%, rgba(255, 255, 255, 0.2) 100%)`,
            }}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onChange={(e) => {
              seek(parseFloat(e.target.value));
              setIsDragging(false);
            }}
            onInput={(e) => {
              setDragProgress(parseFloat(e.target.value));
            }}
          />
          <span id="totalTime">{formatTime(duration)}</span>
        </div>

        {/* Single Line Controls Row */}
        <div className="player-main-row">
          <div className="now-playing">
            <div className="now-playing-icon" id="nowPlayingIconWrap">
              <img
                id="playerThumbnail"
                src={currentTrack?.image || ''}
                alt={currentTrack?.track || 'Now Playing'}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  display: currentTrack?.image ? 'block' : 'none',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  const defIcon = document.getElementById('playerDefaultIcon');
                  if (defIcon) defIcon.style.display = 'block';
                }}
              />
              <i
                className="fas fa-music"
                id="playerDefaultIcon"
                style={{ display: currentTrack?.image ? 'none' : 'block' }}
              ></i>
            </div>
            <div className="now-playing-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div id="playerTitle" className="now-playing-title" title={currentTrack?.track || 'Song Title'}>
                  {currentTrack?.track || 'Song Title'}
                </div>
                <div className={`equalizer-waves ${isPlaying ? '' : 'paused'}`} id="equalizerWave">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div id="playerArtist" className="now-playing-artist" title={currentTrack?.artist || 'Artist Name'}>
                {currentTrack?.artist || 'Artist Name'}
              </div>
            </div>
            <div className="player-quick-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px', flexShrink: 0 }}>
              <i
                className={liked ? 'fas fa-heart' : 'far fa-heart'}
                id="playerLikeBtn"
                onClick={() => currentTrack && toggleTrackLike(currentTrack.track, currentTrack.artist, currentTrack.image)}
                style={{
                  cursor: 'pointer',
                  color: liked ? 'var(--neon-pink)' : 'var(--text-muted)',
                  fontSize: '16px',
                  transition: 'all 0.2s',
                }}
                title={liked ? 'Unlike Song' : 'Like Song'}
              ></i>
              <i
                className="fas fa-plus"
                id="playerAddToPlBtn"
                onClick={() => currentTrack && openModal('addToPl', currentTrack)}
                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', transition: 'all 0.2s' }}
                title="Add to Playlist"
              ></i>
              <i
                className="fas fa-times close-player close-player-mobile"
                id="closePlayerMobile"
                onClick={closePlayer}
                title="Close Player"
              ></i>
            </div>
          </div>

          <div className="player-actions-cluster">
            <div className="player-left-tools">
              <button
                className={`player-action-btn sleep-glow-btn ${sleepTimer ? 'active' : ''}`}
                id="sleepTimerBtn"
                onClick={() => openModal('sleep')}
                title="Sleep Timer"
              >
                <i className="fas fa-moon"></i>
                <span className="sleep-active-dot" id="sleepActiveDot" style={{ display: sleepTimer ? 'block' : 'none' }}></span>
              </button>
            </div>

            <div className="player-buttons">
              <i
                className={`fas fa-random ctrl-sub-btn ${isShuffle ? 'active' : ''}`}
                id="shuffleBtn"
                onClick={toggleShuffle}
                style={{ color: isShuffle ? 'var(--neon-cyan)' : 'inherit' }}
                title="Shuffle (S)"
              ></i>
              <i
                className="fas fa-step-backward ctrl-btn"
                id="prevBtn"
                onClick={playPrevious}
                title="Previous (Shift+Left)"
              ></i>
              <i
                className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} main-play-btn`}
                id="playPauseBtn"
                onClick={togglePlay}
                title="Play/Pause (Space)"
              ></i>
              <i
                className="fas fa-step-forward ctrl-btn"
                id="nextBtn"
                onClick={playNext}
                title="Next (Shift+Right)"
              ></i>
              <div
                className="repeat-wrapper"
                id="repeatWrap"
                onClick={toggleRepeat}
                title="Repeat (R)"
                style={{ color: repeatMode !== 'off' ? 'var(--neon-cyan)' : 'inherit' }}
              >
                <i className="fas fa-redo ctrl-sub-btn" id="repeatBtn"></i>
                <span className="repeat-badge" id="repeatBadge" style={{ display: repeatMode === 'one' ? 'flex' : 'none' }}>
                  1
                </span>
              </div>
            </div>

            <div className="player-right">
              <button
                className="player-action-btn lyrics-glow-btn"
                id="lyricsBtn"
                onClick={() => currentTrack && openModal('lyrics', currentTrack)}
                title="View Lyrics"
              >
                <i className="fas fa-quote-right"></i>
              </button>
              <a
                id="downloadBtn"
                href={downloadUrl}
                download={currentTrack?.track ? `${currentTrack.track}.mp3` : ''}
                target="_blank"
                rel="noreferrer"
                className="player-action-btn download-glow-btn"
                title="Download Song"
                style={{ display: currentTrack ? 'inline-flex' : 'none' }}
              >
                <i className="fas fa-arrow-down"></i>
              </a>
              <div className="volume-control-wrap">
                <i
                  className={`fas ${isMuted || volume === 0 ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up'}`}
                  id="volumeIcon"
                  onClick={toggleMute}
                  title="Mute/Unmute (M)"
                ></i>
                <input
                  type="range"
                  id="volumeBar"
                  className="custom-slider"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, var(--neon-cyan) 0%, var(--neon-cyan) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.2) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.2) 100%)`,
                  }}
                />
              </div>
              <div
                className="close-player close-player-desktop"
                id="closePlayerDesktop"
                onClick={closePlayer}
                title="Close Player"
              >
                <i className="fas fa-times"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Invisible YouTube Player iframe container */}
        <div id="yt-player-wrapper" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
          <div id="youtubePlayer"></div>
        </div>
      </div>
    </div>
  );
}
