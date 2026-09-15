import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useUI } from '../../context/UIContext';

export default function ExploreView() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [playlists, setPlaylists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [visiblePlaylistsCount, setVisiblePlaylistsCount] = useState(8);
  const [visibleAlbumsCount, setVisibleAlbumsCount] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  const { isAlbumLiked, isPlaylistLiked, toggleAlbumLike, togglePlaylistLike } = useLibrary();
  const { openModal } = useUI();

  const categories = [
    { label: 'All', icon: 'fa-globe' },
    { label: 'Trending', icon: 'fa-fire' },
    { label: 'Romance', icon: 'fa-heart' },
    { label: 'Punjabi', icon: 'fa-drum' },
    { label: 'Lo-Fi', icon: 'fa-moon' },
    { label: '90s & 2000s', icon: 'fa-record-vinyl' },
    { label: 'Party', icon: 'fa-bolt' },
    { label: 'Sad Hits', icon: 'fa-cloud-rain' },
    { label: 'Devotional & Sufi', icon: 'fa-om' },
  ];

  useEffect(() => {
    loadExploreData(activeCategory);
  }, [activeCategory]);

  const loadExploreData = async (cat) => {
    setIsLoading(true);
    try {
      const q = cat === 'All' ? 'Trending Hindi' : `${cat} Hindi`;
      const [plRes, albRes] = await Promise.all([
        fetch(`/api/saavn/playlist/search?q=${encodeURIComponent(q)}`),
        fetch(`/api/saavn/album/search?q=${encodeURIComponent(q)}`),
      ]);
      const [plData, albData] = await Promise.all([plRes.json(), albRes.json()]);

      setPlaylists(plData.results || []);
      setAlbums(albData.results || []);
      setVisiblePlaylistsCount(8);
      setVisibleAlbumsCount(8);
    } catch (err) {
      console.warn('Failed to load explore data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="exploreView">
      {/* Category Quick Filter Chips */}
      <div className="explore-category-bar" id="exploreCategoryBar">
        {categories.map((c) => (
          <button
            key={c.label}
            className={`explore-chip ${activeCategory === c.label ? 'active' : ''}`}
            onClick={() => setActiveCategory(c.label)}
          >
            <i className={`fas ${c.icon}`}></i> {c.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading" style={{ display: 'block', padding: '40px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '10px' }}>Loading {activeCategory} playlists & albums...</p>
        </div>
      ) : (
        <>
          {/* Featured Playlists */}
          <div className="music-section">
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-fire" style={{ color: 'var(--neon-pink)' }}></i> Featured & Trending Playlists
              </div>
            </div>
            <div className="collection-grid">
              {playlists.slice(0, visiblePlaylistsCount).map((pl, idx) => (
                <div
                  key={idx}
                  className="collection-card"
                  onClick={() => openModal('collection', { type: 'playlist', id: pl.id, title: pl.title, image: pl.image })}
                >
                  <div className="collection-cover-wrap">
                    <img
                      src={pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'}
                      alt={pl.title}
                      className="collection-cover-img"
                    />
                    <span className="collection-type-badge" style={{ color: 'var(--neon-pink)', borderColor: 'rgba(255,8,68,0.3)' }}>
                      Playlist
                    </span>
                    <div className="collection-hover-play"><i className="fas fa-play"></i></div>
                  </div>
                  <div className="collection-card-title">{pl.title}</div>
                  <div className="collection-card-subtitle">{pl.count ? `${pl.count} Songs` : 'Curated'}</div>
                  <div className="collection-card-footer">
                    <button
                      className="save-collection-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlaylistLike(pl);
                      }}
                    >
                      <i
                        className={isPlaylistLiked(pl.id, pl.title) ? 'fas fa-bookmark' : 'far fa-bookmark'}
                        style={{ color: isPlaylistLiked(pl.id, pl.title) ? 'var(--neon-cyan)' : 'inherit' }}
                      ></i>
                      <span>{isPlaylistLiked(pl.id, pl.title) ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {playlists.length > visiblePlaylistsCount && (
              <div className="load-more-wrap" style={{ display: 'flex' }}>
                <button
                  className="load-more-btn"
                  onClick={() => setVisiblePlaylistsCount((prev) => prev + 8)}
                >
                  <span>Load More Playlists</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter">Showing {visiblePlaylistsCount} of {playlists.length} playlists</span>
              </div>
            )}
          </div>

          {/* Popular Albums */}
          <div className="music-section" style={{ marginTop: '40px' }}>
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-compact-disc" style={{ color: 'var(--neon-cyan)' }}></i> Iconic & Trending Albums
              </div>
            </div>
            <div className="collection-grid">
              {albums.slice(0, visibleAlbumsCount).map((alb, idx) => (
                <div
                  key={idx}
                  className="collection-card"
                  onClick={() => openModal('collection', { type: 'album', id: alb.id, title: alb.title, artist: alb.artist, image: alb.image })}
                >
                  <div className="collection-cover-wrap">
                    <img
                      src={alb.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'}
                      alt={alb.title}
                      className="collection-cover-img"
                    />
                    <span className="collection-type-badge">Album</span>
                    <div className="collection-hover-play"><i className="fas fa-play"></i></div>
                  </div>
                  <div className="collection-card-title">{alb.title}</div>
                  <div className="collection-card-subtitle">{alb.artist || 'Artist'}</div>
                  <div className="collection-card-footer">
                    <button
                      className="save-collection-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAlbumLike(alb);
                      }}
                    >
                      <i
                        className={isAlbumLiked(alb.id, alb.title) ? 'fas fa-bookmark' : 'far fa-bookmark'}
                        style={{ color: isAlbumLiked(alb.id, alb.title) ? 'var(--neon-cyan)' : 'inherit' }}
                      ></i>
                      <span>{isAlbumLiked(alb.id, alb.title) ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {albums.length > visibleAlbumsCount && (
              <div className="load-more-wrap" style={{ display: 'flex' }}>
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleAlbumsCount((prev) => prev + 8)}
                >
                  <span>Load More Albums</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter">Showing {visibleAlbumsCount} of {albums.length} albums</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
