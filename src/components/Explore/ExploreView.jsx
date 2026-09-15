import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';

export default function ExploreView() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [popularSongs, setPopularSongs] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [allPlaylists, setAllPlaylists] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);

  const [visiblePopularCount, setVisiblePopularCount] = useState(8);
  const [visibleRecentCount, setVisibleRecentCount] = useState(8);
  const [visiblePlaylistsCount, setVisiblePlaylistsCount] = useState(8);
  const [visibleAlbumsCount, setVisibleAlbumsCount] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  const { openModal } = useUI();
  const { playMusic, currentTrack, isPlaying, pauseMusic, resumeMusic } = usePlayer();
  const { isTrackLiked, toggleTrackLike } = useLibrary();

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
          setPopularSongs(data.popularSongs || []);
          setRecentSongs(data.recentSongs || []);
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
    setVisiblePopularCount(8);
    setVisibleRecentCount(8);
    setVisiblePlaylistsCount(8);
    setVisibleAlbumsCount(8);
  };

  const filterSongs = (songs) => {
    if (activeCategory === 'All') return songs;
    const cat = activeCategory.toLowerCase();
    const matched = songs.filter((s) => {
      const str = `${s.title} ${s.artist}`.toLowerCase();
      if (cat === 'trending') return true;
      if (cat === 'romance' && /love|ishq|pyaar|dil|arijit|mithoon|sachet|jaan|romantic/i.test(str)) return true;
      if (cat === 'punjabi' && /punjabi|sidhu|karan|diljit|ap dhillon|shubh|jass/i.test(str)) return true;
      if (cat === 'lo-fi' && /lofi|lo-fi|chill|acoustic|unplugged|midnight/i.test(str)) return true;
      if (cat === '90s & 2000s' && /90s|2000s|retro|kumar|udit|alka|sonu/i.test(str)) return true;
      if (cat === 'party' && /party|dance|badshah|honey|tauba|aayi nai|jhoome|stree/i.test(str)) return true;
      if (cat === 'sad hits' && /sad|dard|juda|bewafa|tujhe/i.test(str)) return true;
      if (cat === 'devotional & sufi' && /sufi|bhakti|shiva|ram|krishna|ali/i.test(str)) return true;
      return str.includes(cat);
    });
    return matched.length > 0 ? matched : songs;
  };

  const filteredPopular = filterSongs(popularSongs);
  const filteredRecent = filterSongs(recentSongs);

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

  const visiblePopularSongs = filteredPopular.slice(0, visiblePopularCount);
  const visibleRecentSongs = filteredRecent.slice(0, visibleRecentCount);
  const visiblePlaylists = filteredPlaylists.slice(0, visiblePlaylistsCount);
  const visibleAlbums = filteredAlbums.slice(0, visibleAlbumsCount);

  const popularQueue = filteredPopular.map((s) => ({
    track: s.title,
    artist: s.artist,
    image: s.image || '',
    id: s.id || '',
  }));

  const recentQueue = filteredRecent.map((s) => ({
    track: s.title,
    artist: s.artist,
    image: s.image || '',
    id: s.id || '',
  }));

  const handlePlaySong = (song, queue, idx) => {
    const isCurrent = currentTrack?.track?.toLowerCase() === (song.title || song.track)?.toLowerCase();
    if (isCurrent) {
      if (isPlaying) {
        pauseMusic();
      } else {
        resumeMusic();
      }
    } else {
      playMusic(song.title, song.artist, song.image, queue, idx);
    }
  };

  const formatDuration = (d) => {
    if (!d) return '';
    const sec = parseInt(d, 10);
    if (isNaN(sec)) return d;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderSongItem = (song, idx, queue) => {
    const isThis = currentTrack?.track?.toLowerCase() === song.title?.toLowerCase();
    const liked = isTrackLiked(song.title, song.artist);
    const songImg =
      song.image ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';

    return (
      <div
        key={song.id || `${song.title}-${idx}`}
        className={`track-item ${isThis && isPlaying ? 'track-item-playing' : ''}`}
      >
        <div
          className="track-thumbnail-wrap"
          onClick={() => handlePlaySong(song, queue, idx)}
        >
          <img
            src={songImg}
            className="track-thumbnail-img"
            alt={song.title}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src =
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
            }}
          />
        </div>
        <div
          className="track-info"
          onClick={() => handlePlaySong(song, queue, idx)}
        >
          <div className="track-name">
            <span>
              {idx + 1}. {song.title}
            </span>
            {isThis && isPlaying && (
              <div
                className="equalizer-waves"
                style={{ display: 'inline-flex', marginLeft: '6px', height: '13px' }}
              >
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
          </div>
          <div className="track-stats">
            <i className="fas fa-microphone"></i> {song.artist}
            {song.duration && (
              <>
                {' '}• <i className="fas fa-clock"></i> {formatDuration(song.duration)}
              </>
            )}
          </div>
        </div>
        <div className="track-actions">
          <i
            className={`${liked ? 'fas' : 'far'} fa-heart`}
            onClick={(e) => {
              e.stopPropagation();
              toggleTrackLike(song.title, song.artist, songImg);
            }}
            style={{
              color: liked ? 'var(--neon-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '17px',
            }}
            title={liked ? 'Unlike' : 'Like Song'}
          ></i>
          <i
            className="fas fa-plus"
            onClick={(e) => {
              e.stopPropagation();
              openModal('addToPl', { track: song.title, artist: song.artist, image: songImg });
            }}
            style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
            title="Add to Playlist"
          ></i>
          <div
            className="track-play"
            onClick={() => handlePlaySong(song, queue, idx)}
            title={isThis && isPlaying ? 'Pause' : 'Play'}
          >
            <i className={isThis && isPlaying ? 'fas fa-pause' : 'fas fa-play'}></i>
          </div>
        </div>
      </div>
    );
  };

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
          <p style={{ marginTop: '10px' }}>Loading explore music, playlists & albums...</p>
        </div>
      ) : (
        <>
          {/* 1. Popular Songs Section */}
          <div className="music-section" id="explorePopularSection">
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-fire" style={{ color: 'var(--neon-pink)' }}></i> Popular Songs
              </div>
            </div>

            <div className="track-results-grid" id="explorePopularGrid">
              {visiblePopularSongs.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '30px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                  }}
                >
                  <i className="fas fa-info-circle"></i> No popular songs found for "{activeCategory}".
                </div>
              ) : (
                visiblePopularSongs.map((song, idx) => renderSongItem(song, idx, popularQueue))
              )}
            </div>

            {filteredPopular.length > visiblePopularCount && (
              <div
                className="load-more-wrap"
                id="loadMorePopularWrap"
                style={{ display: 'flex', marginTop: '20px' }}
              >
                <button
                  className="load-more-btn"
                  onClick={() => setVisiblePopularCount((prev) => prev + 8)}
                >
                  <span>Load More Popular Songs</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter" id="popularCounter">
                  Showing {visiblePopularSongs.length} of {filteredPopular.length} Songs
                </span>
              </div>
            )}
          </div>

          {/* 2. Recent Songs Section */}
          <div className="music-section" id="exploreRecentSection" style={{ marginTop: '40px' }}>
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-bolt" style={{ color: 'var(--neon-cyan)' }}></i> Recent Songs
              </div>
            </div>

            <div className="track-results-grid" id="exploreRecentGrid">
              {visibleRecentSongs.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '30px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                  }}
                >
                  <i className="fas fa-info-circle"></i> No recent songs found for "{activeCategory}".
                </div>
              ) : (
                visibleRecentSongs.map((song, idx) => renderSongItem(song, idx, recentQueue))
              )}
            </div>

            {filteredRecent.length > visibleRecentCount && (
              <div
                className="load-more-wrap"
                id="loadMoreRecentWrap"
                style={{ display: 'flex', marginTop: '20px' }}
              >
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleRecentCount((prev) => prev + 8)}
                >
                  <span>Load More Recent Songs</span>
                  <i className="fas fa-chevron-down"></i>
                </button>
                <span className="load-more-counter" id="recentCounter">
                  Showing {visibleRecentSongs.length} of {filteredRecent.length} Songs
                </span>
              </div>
            )}
          </div>

          {/* 3. Featured Playlists Section */}
          <div className="music-section" id="explorePlaylistsSection" style={{ marginTop: '40px' }}>
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-compact-disc" style={{ color: 'var(--neon-pink)' }}></i> Featured & Trending Playlists
              </div>
            </div>

            <div className="collection-grid" id="explorePlaylistsGrid">
              {visiblePlaylists.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '30px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                  }}
                >
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
                        src={
                          pl.image ||
                          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'
                        }
                        className="collection-cover-img"
                        alt={pl.title}
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
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

          {/* 4. Iconic & Trending Albums Section */}
          <div className="music-section" id="exploreAlbumsSection" style={{ marginTop: '40px' }}>
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-music" style={{ color: 'var(--neon-cyan)' }}></i> Iconic & Trending Albums
              </div>
            </div>

            <div className="collection-grid" id="exploreAlbumsGrid">
              {visibleAlbums.length === 0 ? (
                <div
                  style={{
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '30px',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                  }}
                >
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
                        src={
                          alb.image ||
                          'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'
                        }
                        className="collection-cover-img"
                        alt={alb.title}
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
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

