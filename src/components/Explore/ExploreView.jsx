import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';

export default function ExploreView() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [allPlaylists, setAllPlaylists] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [visiblePlaylistsCount, setVisiblePlaylistsCount] = useState(8);
  const [visibleAlbumsCount, setVisibleAlbumsCount] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  const { openModal } = useUI();

  const categories = [
    { label: 'All', text: 'All', icon: 'fa-globe' },
    { label: 'Trending', text: 'Trending', icon: 'fa-fire' },
    { label: 'Romance', text: 'Romance', icon: 'fa-heart' },
    { label: 'Punjabi', text: 'Punjabi', icon: 'fa-drum' },
    { label: 'Lo-Fi', text: 'Lo-Fi Chill', icon: 'fa-moon' },
    { label: '90s & 2000s', text: '90s & 2000s Hits', icon: 'fa-record-vinyl' },
    { label: 'Party', text: 'Party & Dance', icon: 'fa-bolt' },
    { label: 'Sad Hits', text: 'Sad & Soul', icon: 'fa-cloud-rain' },
    { label: 'Devotional & Sufi', text: 'Devotional & Sufi', icon: 'fa-om' },
  ];

  useEffect(() => {
    async function loadExplore() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/saavn/featured');
        const data = await res.json();
        if (data.success) {
          setAllPlaylists(data.playlists || []);
          setAllAlbums(data.albums || []);
        }
      } catch (err) {
        console.warn('Failed to load explore:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadExplore();
  }, []);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setVisiblePlaylistsCount(8);
    setVisibleAlbumsCount(8);
  };

  const filteredPlaylists =
    activeCategory === 'All'
      ? allPlaylists
      : allPlaylists.filter(
          (p) => (p.category || '').toLowerCase() === activeCategory.toLowerCase()
        );

  const filteredAlbums =
    activeCategory === 'All'
      ? allAlbums
      : allAlbums.filter(
          (a) => (a.category || '').toLowerCase() === activeCategory.toLowerCase()
        );

  const visiblePlaylists = filteredPlaylists.slice(0, visiblePlaylistsCount);
  const visibleAlbums = filteredAlbums.slice(0, visibleAlbumsCount);

  return (
    <div id="exploreView">
      {/* Category Quick Filters */}
      <div className="explore-category-bar" id="exploreCategoryBar">
        {categories.map((c) => (
          <button
            key={c.label}
            className={`explore-chip ${activeCategory === c.label ? 'active' : ''}`}
            onClick={() => handleCategoryChange(c.label)}
          >
            <i className={`fas ${c.icon}`}></i> {c.text}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="loading" style={{ display: 'block', padding: '40px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '10px' }}>Loading featured playlists & albums...</p>
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

            <div className="collection-grid" id="explorePlaylistsGrid">
              {visiblePlaylists.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <i className="fas fa-info-circle"></i> No playlists in "{activeCategory}". Try selecting "All" or another category.
                </div>
              ) : (
                visiblePlaylists.map((pl, idx) => (
                  <div
                    key={pl.id || idx}
                    className="collection-card"
                    onClick={() =>
                      openModal('collection', {
                        type: 'playlist',
                        id: pl.id,
                        title: pl.title,
                        image: pl.image,
                      })
                    }
                  >
                    <div className="collection-cover-wrap">
                      <img
                        src={pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'}
                        className="collection-cover-img"
                        alt={pl.title}
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                        }}
                      />
                      <span
                        className="collection-type-badge"
                        style={{ color: 'var(--neon-pink)', borderColor: 'rgba(255,8,68,0.3)' }}
                      >
                        {pl.category || 'Playlist'}
                      </span>
                      <div className="collection-hover-play">
                        <i className="fas fa-play"></i>
                      </div>
                    </div>
                    <div className="collection-card-title">{pl.title}</div>
                    <div className="collection-card-subtitle">{pl.count || 30} Tracks • Curated</div>
                    <div className="collection-card-footer">
                      <span>Curated Mix</span>
                      <span style={{ color: 'var(--neon-pink)' }}>
                        <i className="fas fa-play"></i> Play
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredPlaylists.length > visiblePlaylistsCount && (
              <div className="load-more-wrap" id="loadMorePlaylistsWrap" style={{ display: 'flex' }}>
                <button
                  className="load-more-btn"
                  onClick={() => setVisiblePlaylistsCount((prev) => prev + 8)}
                >
                  <span>Load More Playlists</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter" id="playlistsCounter">
                  Showing {visiblePlaylists.length} of {filteredPlaylists.length} Playlists
                </span>
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

            <div className="collection-grid" id="exploreAlbumsGrid">
              {visibleAlbums.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <i className="fas fa-info-circle"></i> No albums in "{activeCategory}". Try selecting "All" or another category.
                </div>
              ) : (
                visibleAlbums.map((alb, idx) => (
                  <div
                    key={alb.id || idx}
                    className="collection-card"
                    onClick={() =>
                      openModal('collection', {
                        type: 'album',
                        id: alb.id,
                        title: alb.title,
                        artist: alb.artist,
                        image: alb.image,
                      })
                    }
                  >
                    <div className="collection-cover-wrap">
                      <img
                        src={alb.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'}
                        className="collection-cover-img"
                        alt={alb.title}
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
                        }}
                      />
                      <span className="collection-type-badge">{alb.category || 'Album'}</span>
                      <div className="collection-hover-play">
                        <i className="fas fa-play"></i>
                      </div>
                    </div>
                    <div className="collection-card-title">{alb.title}</div>
                    <div className="collection-card-subtitle">{alb.artist}</div>
                    <div className="collection-card-footer">
                      <span>{alb.year || 'Hit Album'}</span>
                      <span style={{ color: 'var(--neon-cyan)' }}>
                        <i className="fas fa-compact-disc"></i> View
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredAlbums.length > visibleAlbumsCount && (
              <div className="load-more-wrap" id="loadMoreAlbumsWrap" style={{ display: 'flex' }}>
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleAlbumsCount((prev) => prev + 8)}
                >
                  <span>Load More Albums</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter" id="albumsCounter">
                  Showing {visibleAlbums.length} of {filteredAlbums.length} Albums
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

