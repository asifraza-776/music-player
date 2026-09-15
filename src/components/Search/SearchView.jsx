import React, { useState, useRef } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useUI } from '../../context/UIContext';

export default function SearchView() {
  const [activeSearchTab, setActiveSearchTab] = useState('artist'); // 'artist' | 'track' | 'album' | 'playlist'
  const [artistQuery, setArtistQuery] = useState('');
  const [trackQuery, setTrackQuery] = useState('');
  const [trackArtistQuery, setTrackArtistQuery] = useState('');
  const [albumQuery, setAlbumQuery] = useState('');
  const [playlistQuery, setPlaylistQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [resultsData, setResultsData] = useState(null); // { type, data }

  const { playMusic, playTrackByIndex } = usePlayer();
  const { isTrackLiked, isAlbumLiked, isPlaylistLiked, toggleTrackLike, toggleAlbumLike, togglePlaylistLike } = useLibrary();
  const { openModal, showToast } = useUI();

  // Search Artist
  const handleSearchArtist = async (query = null) => {
    const q = (query || artistQuery).trim();
    if (!q) return;
    setIsLoading(true);
    setResultsData(null);

    try {
      const res = await fetch(`/api/artist?name=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error) {
        showToast('Artist not found', data.error, 'error');
      } else {
        setResultsData({ type: 'artist', data });
      }
    } catch (err) {
      showToast('Search Error', 'Failed to fetch artist details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Track
  const handleSearchTrack = async () => {
    const track = trackQuery.trim();
    const artist = trackArtistQuery.trim();
    if (!track) return;
    setIsLoading(true);
    setResultsData(null);

    try {
      const url = artist
        ? `/api/track?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}`
        : `/api/track?track=${encodeURIComponent(track)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) {
        showToast('Track not found', data.error, 'error');
      } else {
        setResultsData({ type: 'track', data: data.track ? [data.track] : data });
      }
    } catch (err) {
      showToast('Search Error', 'Failed to search song', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Album
  const handleSearchAlbum = async () => {
    const q = albumQuery.trim();
    if (!q) return;
    setIsLoading(true);
    setResultsData(null);

    try {
      const res = await fetch(`/api/saavn/album/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultsData({ type: 'album', data: data.results || [] });
    } catch (err) {
      showToast('Search Error', 'Failed to search albums', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Playlist
  const handleSearchPlaylist = async () => {
    const q = playlistQuery.trim();
    if (!q) return;
    setIsLoading(true);
    setResultsData(null);

    try {
      const res = await fetch(`/api/saavn/playlist/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResultsData({ type: 'playlist', data: data.results || [] });
    } catch (err) {
      showToast('Search Error', 'Failed to search playlists', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Voice / Shazam Audio Recognition
  const handleAudioRecognize = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone access is not supported on this device/browser.');
      return;
    }
    setIsRecognizing(true);
    showToast('Listening...', 'Please play the song near your microphone', 'info');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          try {
            const res = await fetch('/api/recognize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Audio }),
            });
            const data = await res.json();
            if (data.success && data.title) {
              showToast('Song Identified!', `${data.title} - ${data.artist}`, 'success');
              setActiveSearchTab('track');
              setTrackQuery(data.title);
              setTrackArtistQuery(data.artist || '');
              // Trigger track search
              const searchRes = await fetch(`/api/track?track=${encodeURIComponent(data.title)}&artist=${encodeURIComponent(data.artist || '')}`);
              const searchData = await searchRes.json();
              if (searchData.track) setResultsData({ type: 'track', data: [searchData.track] });
            } else {
              showToast('Recognition Failed', data.error || 'Could not recognize audio', 'error');
            }
          } catch (e) {
            showToast('Error', 'Recognition service unreachable', 'error');
          } finally {
            setIsRecognizing(false);
          }
        };
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          stream.getTracks().forEach((track) => track.stop());
        }
      }, 5000);
    } catch (err) {
      setIsRecognizing(false);
      showToast('Microphone Error', 'Microphone permission denied', 'error');
    }
  };

  return (
    <div id="searchView">
      <div className="hero">
        <h1>Discover Your Next Musical Obsession</h1>
        <p>Explore millions of songs, albums, and artists with instant, ad-free streaming.</p>
      </div>

      <div className="search-section">
        {/* Search Mode Pill Tabs */}
        <div className="search-tabs">
          <button
            className={`tab-btn ${activeSearchTab === 'artist' ? 'active' : ''}`}
            onClick={() => { setActiveSearchTab('artist'); setResultsData(null); }}
          >
            <i className="fas fa-user-astronaut"></i> Artist
          </button>
          <button
            className={`tab-btn ${activeSearchTab === 'track' ? 'active' : ''}`}
            onClick={() => { setActiveSearchTab('track'); setResultsData(null); }}
          >
            <i className="fas fa-music"></i> Song / Track
          </button>
          <button
            className={`tab-btn ${activeSearchTab === 'album' ? 'active' : ''}`}
            onClick={() => { setActiveSearchTab('album'); setResultsData(null); }}
          >
            <i className="fas fa-compact-disc"></i> Album
          </button>
          <button
            className={`tab-btn ${activeSearchTab === 'playlist' ? 'active' : ''}`}
            onClick={() => { setActiveSearchTab('playlist'); setResultsData(null); }}
          >
            <i className="fas fa-list"></i> Playlist
          </button>
        </div>

        {/* 1. Artist Search */}
        {activeSearchTab === 'artist' && (
          <div className="search-box">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter artist name (e.g. Arijit Singh, Diljit Dosanjh, The Weeknd)..."
                value={artistQuery}
                onChange={(e) => setArtistQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchArtist()}
              />
              <button className="search-btn" onClick={() => handleSearchArtist()}>
                <i className="fas fa-search"></i> Search
              </button>
            </div>
            <div className="quick-suggestions">
              <span>Trending:</span>
              {['Arijit Singh', 'Shreya Ghoshal', 'Atif Aslam', 'Diljit Dosanjh', 'Taylor Swift'].map((name) => (
                <button
                  key={name}
                  className="suggestion-chip"
                  onClick={() => {
                    setArtistQuery(name);
                    handleSearchArtist(name);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. Track Search */}
        {activeSearchTab === 'track' && (
          <div className="search-box">
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter song name (e.g. Tum Hi Ho, Kesariya)..."
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTrack()}
              />
              <input
                type="text"
                placeholder="Artist name (optional)..."
                value={trackArtistQuery}
                onChange={(e) => setTrackArtistQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTrack()}
                style={{ maxWidth: '240px' }}
              />
              <button className="search-btn" onClick={handleSearchTrack}>
                <i className="fas fa-search"></i> Find Song
              </button>
              <button
                className={`search-btn ${isRecognizing ? 'pulse-btn' : ''}`}
                style={{ background: isRecognizing ? 'var(--neon-pink)' : 'rgba(255,255,255,0.08)' }}
                onClick={handleAudioRecognize}
                title="Identify music playing near you"
              >
                <i className={`fas ${isRecognizing ? 'fa-spinner fa-spin' : 'fa-microphone'}`}></i>
              </button>
            </div>
          </div>
        )}

        {/* 3. Album Search */}
        {activeSearchTab === 'album' && (
          <div className="search-box">
            <div className="input-group">
              <input
                type="text"
                placeholder="Search JioSaavn albums (e.g. Aashiqui 2, Kabir Singh, Rockstar)..."
                value={albumQuery}
                onChange={(e) => setAlbumQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchAlbum()}
              />
              <button className="search-btn" onClick={handleSearchAlbum}>
                <i className="fas fa-compact-disc"></i> Search Album
              </button>
            </div>
          </div>
        )}

        {/* 4. Playlist Search */}
        {activeSearchTab === 'playlist' && (
          <div className="search-box">
            <div className="input-group">
              <input
                type="text"
                placeholder="Search playlists (e.g. 90s Romance, Lo-Fi Chill, Punjabi Party)..."
                value={playlistQuery}
                onChange={(e) => setPlaylistQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchPlaylist()}
              />
              <button className="search-btn" onClick={handleSearchPlaylist}>
                <i className="fas fa-list"></i> Search Playlist
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="loading" style={{ display: 'block' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '10px' }}>Loading results...</p>
        </div>
      )}

      {/* Results Container */}
      {resultsData && (
        <div id="results" style={{ display: 'block' }}>
          {/* Artist View */}
          {resultsData.type === 'artist' && (
            <div>
              <div className="artist-profile-hero">
                <img
                  src={resultsData.data.artist?.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'}
                  alt={resultsData.data.artist?.name}
                  className="artist-profile-img"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'; }}
                />
                <div className="artist-profile-info">
                  <h2>{resultsData.data.artist?.name}</h2>
                  <div className="artist-meta-chips">
                    <span><i className="fas fa-users"></i> {resultsData.data.artist?.listeners || '1M+'} Listeners</span>
                    <span><i className="fas fa-play"></i> {resultsData.data.artist?.playcount || '5M+'} Plays</span>
                  </div>
                  {resultsData.data.artist?.bio && (
                    <p className="artist-bio-text">{resultsData.data.artist.bio.summary}</p>
                  )}
                </div>
              </div>

              {/* Top Tracks */}
              {resultsData.data.topTracks && resultsData.data.topTracks.length > 0 && (
                <div className="music-section">
                  <div className="section-title"><i className="fas fa-fire" style={{ color: 'var(--neon-pink)' }}></i> Top Popular Tracks</div>
                  <div className="track-results-grid">
                    {resultsData.data.topTracks.map((item, idx) => (
                      <TrackItem
                        key={idx}
                        item={item}
                        index={idx}
                        queue={resultsData.data.topTracks}
                        isTrackLiked={isTrackLiked}
                        toggleTrackLike={toggleTrackLike}
                        playMusic={playMusic}
                        openModal={openModal}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Track Results */}
          {resultsData.type === 'track' && (
            <div className="music-section">
              <div className="section-title"><i className="fas fa-music" style={{ color: 'var(--neon-cyan)' }}></i> Track Results</div>
              <div className="track-results-grid">
                {resultsData.data.map((item, idx) => (
                  <TrackItem
                    key={idx}
                    item={item}
                    index={idx}
                    queue={resultsData.data}
                    isTrackLiked={isTrackLiked}
                    toggleTrackLike={toggleTrackLike}
                    playMusic={playMusic}
                    openModal={openModal}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Album Results */}
          {resultsData.type === 'album' && (
            <div className="music-section">
              <div className="section-title"><i className="fas fa-compact-disc" style={{ color: 'var(--neon-cyan)' }}></i> Albums Found</div>
              <div className="collection-grid">
                {resultsData.data.map((alb, idx) => (
                  <div
                    key={idx}
                    className="collection-card"
                    onClick={() => openModal('collection', { type: 'album', id: alb.id, title: alb.title, artist: alb.artist, image: alb.image })}
                  >
                    <div className="collection-cover-wrap">
                      <img src={alb.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'} alt={alb.title} className="collection-cover-img" />
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
                        <i className={isAlbumLiked(alb.id, alb.title) ? 'fas fa-bookmark' : 'far fa-bookmark'} style={{ color: isAlbumLiked(alb.id, alb.title) ? 'var(--neon-cyan)' : 'inherit' }}></i>
                        <span>{isAlbumLiked(alb.id, alb.title) ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlist Results */}
          {resultsData.type === 'playlist' && (
            <div className="music-section">
              <div className="section-title"><i className="fas fa-list" style={{ color: 'var(--neon-pink)' }}></i> Playlists Found</div>
              <div className="collection-grid">
                {resultsData.data.map((pl, idx) => (
                  <div
                    key={idx}
                    className="collection-card"
                    onClick={() => openModal('collection', { type: 'playlist', id: pl.id, title: pl.title, image: pl.image })}
                  >
                    <div className="collection-cover-wrap">
                      <img src={pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'} alt={pl.title} className="collection-cover-img" />
                      <span className="collection-type-badge" style={{ color: 'var(--neon-pink)', borderColor: 'rgba(255,8,68,0.3)' }}>Playlist</span>
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
                        <i className={isPlaylistLiked(pl.id, pl.title) ? 'fas fa-bookmark' : 'far fa-bookmark'} style={{ color: isPlaylistLiked(pl.id, pl.title) ? 'var(--neon-cyan)' : 'inherit' }}></i>
                        <span>{isPlaylistLiked(pl.id, pl.title) ? 'Saved' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for rendering a track item row
function TrackItem({ item, index, queue, isTrackLiked, toggleTrackLike, playMusic, openModal }) {
  const trackName = item.track || item.name;
  const artistName = item.artist?.name || item.artist || 'Unknown';
  const imgUrl = item.image || item.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
  const liked = isTrackLiked(trackName, artistName);
  const ytQuery = `${trackName} ${artistName}`;

  return (
    <div className="track-item">
      <div
        className="track-thumbnail-wrap"
        onClick={() => playMusic(trackName, artistName, imgUrl, queue, index)}
      >
        <img
          src={imgUrl}
          className="track-thumbnail-img"
          alt={trackName}
          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'; }}
        />
      </div>
      <div
        className="track-info"
        onClick={() => playMusic(trackName, artistName, imgUrl, queue, index)}
      >
        <div className="track-name">{index + 1}. {trackName}</div>
        <div className="track-stats">
          <i className="fas fa-microphone"></i> {artistName}
        </div>
      </div>
      <div className="track-actions">
        <i
          className={liked ? 'fas fa-heart' : 'far fa-heart'}
          style={{ color: liked ? 'var(--neon-pink)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '17px' }}
          onClick={(e) => {
            e.stopPropagation();
            toggleTrackLike(trackName, artistName, imgUrl);
          }}
          title={liked ? 'Unlike' : 'Like'}
        ></i>
        <i
          className="fas fa-plus"
          style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }}
          onClick={(e) => {
            e.stopPropagation();
            openModal('addToPl', { track: trackName, artist: artistName, image: imgUrl });
          }}
          title="Add to Playlist"
        ></i>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="yt-link"
          title="Watch on YouTube"
          onClick={(e) => e.stopPropagation()}
        >
          <i className="fab fa-youtube"></i>
        </a>
        <div
          className="track-play"
          onClick={() => playMusic(trackName, artistName, imgUrl, queue, index)}
        >
          <i className="fas fa-play"></i>
        </div>
      </div>
    </div>
  );
}
