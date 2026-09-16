import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { useUI } from '../../context/UIContext';

export default function LibraryView() {
  const [activeTab, setActiveTab] = useState('songs');
  const { library, toggleTrackLike, toggleAlbumLike, togglePlaylistLike, deletePlaylist } = useLibrary();
  const { playMusic, pauseMusic, resumeMusic, currentTrack, isPlaying } = usePlayer();
  const { openModal } = useUI();

  const likedTracks = library.likedTracks || [];
  const likedAlbums = library.likedAlbums || [];
  const likedPlaylists = library.likedPlaylists || [];
  const customPlaylists = library.customPlaylists || [];

  const defaultImg = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
  const defaultAlbumImg = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';

  return (
    <div id="libraryView">
      <div className="music-section library-music-section">
        <div className="library-header-row">
          <div className="section-title">
            <i className="fas fa-heart" style={{ color: 'var(--neon-pink)' }}></i> Your Music Library
          </div>
          <button className="search-btn create-playlist-btn" onClick={() => openModal('createPl')}>
            <i className="fas fa-plus"></i> Create Playlist
          </button>
        </div>

        {/* Library Tabs */}
        <div className="search-tabs library-tabs">
          <button
            className={`tab-btn ${activeTab === 'songs' ? 'active' : ''}`}
            onClick={() => setActiveTab('songs')}
          >
            <i className="fas fa-heart"></i> Liked Songs (<span>{likedTracks.length}</span>)
          </button>
          <button
            className={`tab-btn ${activeTab === 'albums' ? 'active' : ''}`}
            onClick={() => setActiveTab('albums')}
          >
            <i className="fas fa-compact-disc"></i> Saved Albums (<span>{likedAlbums.length}</span>)
          </button>
          <button
            className={`tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => setActiveTab('playlists')}
          >
            <i className="fas fa-bookmark"></i> Saved Playlists (<span>{likedPlaylists.length}</span>)
          </button>
          <button
            className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <i className="fas fa-folder-plus"></i> My Playlists (<span>{customPlaylists.length}</span>)
          </button>
        </div>

        {/* Liked Songs Tab */}
        {activeTab === 'songs' && (
          <div className="track-results-grid">
            {likedTracks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', width: '100%', color: 'var(--text-muted)' }}>
                <i className="fas fa-heart-broken" style={{ fontSize: '45px', marginBottom: '15px', opacity: 0.5, color: 'var(--neon-pink)' }}></i>
                <p>No liked songs yet! Click the heart icon on any song to save it here.</p>
              </div>
            ) : (
              likedTracks.map((item, index) => {
                const query = `${item.track} ${item.artist}`;
                const songImg = item.image || defaultImg;
                const isThis = currentTrack && currentTrack.track?.toLowerCase().trim() === (item.track || '').toLowerCase().trim();

                const handleTrackClick = () => {
                  if (isThis) {
                    if (isPlaying) {
                      pauseMusic();
                    } else {
                      resumeMusic();
                    }
                  } else {
                    playMusic(item.track, item.artist, songImg, likedTracks, index);
                  }
                };

                return (
                  <div key={`${item.track}-${item.artist}-${index}`} className={`track-item ${isThis ? 'track-item-playing' : ''}`}>
                    <div
                      className="track-thumbnail-wrap"
                      onClick={handleTrackClick}
                    >
                      <img
                        src={songImg}
                        className="track-thumbnail-img"
                        alt={item.track}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultImg; }}
                      />
                    </div>
                    <div
                      className="track-info"
                      onClick={handleTrackClick}
                    >
                      <div className="track-name" style={{ color: isThis ? 'var(--neon-cyan)' : 'inherit', fontWeight: isThis ? 700 : 'normal' }}>
                        {index + 1}. {item.track}
                        {isThis && isPlaying && (
                          <div className="equalizer-waves" style={{ display: 'inline-flex', marginLeft: '6px', height: '13px' }}>
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        )}
                      </div>
                      <div className="track-stats">
                        <i className="fas fa-microphone"></i> {item.artist}
                      </div>
                    </div>
                    <div className="track-actions">
                      <i
                        className="fas fa-heart"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTrackLike(item.track, item.artist, item.image);
                        }}
                        style={{ color: 'var(--neon-pink)', cursor: 'pointer', fontSize: '18px' }}
                        title="Remove from Liked"
                      ></i>
                      <i
                        className="fas fa-plus"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal('addToPl', { track: item.track, artist: item.artist, image: item.image });
                        }}
                        style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
                        title="Add to Playlist"
                      ></i>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="yt-link"
                        title="Watch on YouTube"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <i className="fab fa-youtube"></i>
                      </a>
                      <div
                        className="track-play"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrackClick();
                        }}
                        style={isThis && isPlaying ? { background: 'var(--neon-cyan)', color: '#000' } : {}}
                        title={isThis && isPlaying ? 'Pause' : 'Play'}
                      >
                        <i className={`fas ${isThis && isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Saved Albums Tab */}
        {activeTab === 'albums' && (
          <div className="collection-grid">
            {likedAlbums.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', gridColumn: '1/-1', color: 'var(--text-muted)' }}>
                <i className="fas fa-compact-disc" style={{ fontSize: '45px', marginBottom: '15px', opacity: 0.5, color: 'var(--neon-cyan)' }}></i>
                <p>No saved albums yet! Explore or search albums and click "Save Album" to keep them here.</p>
              </div>
            ) : (
              likedAlbums.map((alb, index) => {
                const img = alb.image || defaultAlbumImg;
                return (
                  <div
                    key={alb.id || index}
                    className="collection-card"
                    onClick={() => openModal('collection', { type: 'album', id: alb.id, title: alb.title, artist: alb.artist, image: img })}
                  >
                    <div className="collection-cover-wrap">
                      <img
                        src={img}
                        className="collection-cover-img"
                        alt={alb.title}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultAlbumImg; }}
                      />
                      <span className="collection-type-badge">Album</span>
                      <div className="collection-hover-play">
                        <i className="fas fa-play"></i>
                      </div>
                    </div>
                    <div className="collection-card-title">{alb.title}</div>
                    <div className="collection-card-subtitle">{alb.artist || 'Artist'}</div>
                    <div className="collection-card-footer">
                      <span style={{ color: 'var(--neon-cyan)' }}>
                        <i className="fas fa-bookmark"></i> Saved
                      </span>
                      <i
                        className="fas fa-trash"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAlbumLike({ id: alb.id, title: alb.title });
                        }}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Remove"
                      ></i>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Saved Playlists Tab */}
        {activeTab === 'playlists' && (
          <div className="collection-grid">
            {likedPlaylists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', gridColumn: '1/-1', color: 'var(--text-muted)' }}>
                <i className="fas fa-list" style={{ fontSize: '45px', marginBottom: '15px', opacity: 0.5, color: 'var(--neon-pink)' }}></i>
                <p>No saved playlists yet! Save curated playlists from Explore to find them here.</p>
              </div>
            ) : (
              likedPlaylists.map((pl, index) => {
                const img = pl.image || defaultImg;
                return (
                  <div
                    key={pl.id || index}
                    className="collection-card"
                    onClick={() => openModal('collection', { type: 'playlist', id: pl.id, title: pl.title, image: img })}
                  >
                    <div className="collection-cover-wrap">
                      <img
                        src={img}
                        className="collection-cover-img"
                        alt={pl.title}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultImg; }}
                      />
                      <span className="collection-type-badge" style={{ color: 'var(--neon-pink)', borderColor: 'rgba(255,8,68,0.3)' }}>
                        Playlist
                      </span>
                      <div className="collection-hover-play">
                        <i className="fas fa-play"></i>
                      </div>
                    </div>
                    <div className="collection-card-title">{pl.title}</div>
                    <div className="collection-card-subtitle">{pl.count ? `${pl.count} Songs` : 'Curated'}</div>
                    <div className="collection-card-footer">
                      <span style={{ color: 'var(--neon-cyan)' }}>
                        <i className="fas fa-bookmark"></i> Saved
                      </span>
                      <i
                        className="fas fa-trash"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlaylistLike({ id: pl.id, title: pl.title });
                        }}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Remove"
                      ></i>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* My Playlists (Custom) Tab */}
        {activeTab === 'custom' && (
          <div className="collection-grid">
            {customPlaylists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', gridColumn: '1/-1', color: 'var(--text-muted)' }}>
                <i className="fas fa-folder-plus" style={{ fontSize: '45px', marginBottom: '15px', opacity: 0.5, color: 'var(--neon-cyan)' }}></i>
                <p>You haven't created any playlists yet.</p>
                <button
                  className="search-btn"
                  onClick={() => openModal('createPl')}
                  style={{ marginTop: '15px', borderRadius: '20px', padding: '10px 24px' }}
                >
                  <i className="fas fa-plus"></i> Create Your First Playlist
                </button>
              </div>
            ) : (
              customPlaylists.map((pl) => {
                const count = (pl.tracks || []).length;
                const img = pl.image || defaultImg;
                return (
                  <div
                    key={pl.id}
                    className="collection-card"
                    onClick={() => openModal('collection', { type: 'custom', id: pl.id, title: pl.name, description: pl.description, image: img, tracks: pl.tracks })}
                  >
                    <div className="collection-cover-wrap">
                      <img
                        src={img}
                        className="collection-cover-img"
                        alt={pl.name}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultImg; }}
                      />
                      <span className="collection-type-badge">Personal</span>
                      <div className="collection-hover-play">
                        <i className="fas fa-play"></i>
                      </div>
                    </div>
                    <div className="collection-card-title">{pl.name}</div>
                    <div className="collection-card-subtitle">{count} Tracks</div>
                    <div className="collection-card-footer">
                      <span>{pl.description || 'Custom Playlist'}</span>
                      <i
                        className="fas fa-trash"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePlaylist(pl.id);
                        }}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Delete Playlist"
                      ></i>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
