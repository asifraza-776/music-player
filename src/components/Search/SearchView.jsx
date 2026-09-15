import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { useUI } from '../../context/UIContext';

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function SearchView() {
  const [activeTab, setActiveTab] = useState('artist'); // 'artist' | 'track' | 'album' | 'playlist'
  const [artistQuery, setArtistQuery] = useState('');
  const [trackQuery, setTrackQuery] = useState('');
  const [trackArtistQuery, setTrackArtistQuery] = useState('');
  const [albumQuery, setAlbumQuery] = useState('');
  const [playlistQuery, setPlaylistQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [resultsData, setResultsData] = useState(null); // { type, data }
  const [bioCollapsed, setBioCollapsed] = useState(true);

  // Voice Search states
  const [listeningTab, setListeningTab] = useState(null);
  const [recognizingTab, setRecognizingTab] = useState(null);

  const { playMusic } = usePlayer();
  const { isTrackLiked, toggleTrackLike } = useLibrary();
  const { openModal, showToast, pendingArtistSearch, setPendingArtistSearch } = useUI();

  // Handle pending artist search from Charts
  useEffect(() => {
    if (pendingArtistSearch) {
      setActiveTab('artist');
      setArtistQuery(pendingArtistSearch);
      handleSearchArtist(pendingArtistSearch);
      if (setPendingArtistSearch) {
        setPendingArtistSearch('');
      }
    }
  }, [pendingArtistSearch]);

  // Search Artist
  const handleSearchArtist = async (query = null) => {
    const q = (query !== null ? query : artistQuery).trim() || 'Arijit Singh';
    if (!q) return;
    setIsLoading(true);
    setResultsData(null);
    setBioCollapsed(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (data.success && data.artist) {
        setResultsData({ type: 'artist', data });
      } else {
        showToast('Artist not found', data.error || 'No artist found', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Search Error', 'Failed to fetch artist. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Track
  const handleSearchTrack = async (query = null) => {
    const track = (query !== null ? query : trackQuery).trim();
    const artist = trackArtistQuery.trim();
    if (!track) {
      alert('Please enter a track name');
      return;
    }
    setIsLoading(true);
    setResultsData(null);

    try {
      let url = `/api/track/search?q=${encodeURIComponent(track)}`;
      if (artist) url += `&artist=${encodeURIComponent(artist)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success && data.results && data.results.length > 0) {
        setResultsData({ type: 'track', data: data.results });
      } else {
        showToast('No tracks found', 'Try another song or artist name', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Search Error', 'Failed to fetch tracks. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Album
  const handleSearchAlbum = async (query = null) => {
    const q = (query !== null ? query : albumQuery).trim();
    if (!q) {
      alert('Please enter an album name');
      return;
    }
    setIsLoading(true);
    setResultsData(null);

    try {
      const res = await fetch(`/api/saavn/album/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        setResultsData({ type: 'album', data: data.results });
      } else {
        showToast('No albums found', 'No albums found with that name', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Search Error', 'Failed to search albums. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Search Playlist
  const handleSearchPlaylist = async (query = null) => {
    const q = (query !== null ? query : playlistQuery).trim();
    if (!q) {
      alert('Please enter a playlist keyword');
      return;
    }
    setIsLoading(true);
    setResultsData(null);

    try {
      const res = await fetch(`/api/saavn/playlist/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        setResultsData({ type: 'playlist', data: data.results });
      } else {
        showToast('No playlists found', 'No playlists found with that keyword', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Search Error', 'Failed to search playlists. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Voice Search / Shazam Recognition
  const startVoiceSearch = async (tabType) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone access is not supported on this device/browser.');
      return;
    }

    setListeningTab(tabType);
    let speechDetected = false;
    let mediaRecorder = null;
    let stream = null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        if (speechDetected) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setListeningTab(null);
        setRecognizingTab(tabType);

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          let base64data = reader.result.split(',')[1];
          try {
            const response = await fetch('/api/recognize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioData: base64data }),
            });
            const data = await response.json();
            if (data.success && data.title) {
              setActiveTab('track');
              setTrackQuery(data.title);
              setTrackArtistQuery(data.artist || '');
              showToast('Song Identified!', `${data.title} - ${data.artist}`, 'success');

              // Fetch track search results
              let url = `/api/track/search?q=${encodeURIComponent(data.title)}`;
              if (data.artist) url += `&artist=${encodeURIComponent(data.artist)}`;
              const sRes = await fetch(url);
              const sData = await sRes.json();
              if (sData.success && sData.results) {
                setResultsData({ type: 'track', data: sData.results });
              }
            } else {
              showToast('Audio Recognition', data.error || 'Song not recognized. Please move closer to speaker.', 'error');
            }
          } catch (err) {
            showToast('Recognition Error', 'Error contacting recognition service.', 'error');
          } finally {
            setRecognizingTab(null);
            stream.getTracks().forEach((track) => track.stop());
          }
        };
      });

      if (recognition) {
        recognition.onresult = (event) => {
          speechDetected = true;
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();

          const transcript = event.results[0][0].transcript;
          setListeningTab(null);

          if (tabType === 'artist') {
            setArtistQuery(transcript);
            handleSearchArtist(transcript);
          } else if (tabType === 'track') {
            setTrackQuery(transcript);
            handleSearchTrack(transcript);
          } else if (tabType === 'album') {
            setAlbumQuery(transcript);
            handleSearchAlbum(transcript);
          } else if (tabType === 'playlist') {
            setPlaylistQuery(transcript);
            handleSearchPlaylist(transcript);
          }
        };

        try {
          recognition.start();
        } catch (e) {}
      }

      mediaRecorder.start(1000);

      setTimeout(() => {
        if (!speechDetected && mediaRecorder.state === 'recording') {
          if (recognition) {
            try {
              recognition.stop();
            } catch (e) {}
          }
          mediaRecorder.stop();
        }
      }, 6000);
    } catch (err) {
      console.error('Mic error:', err);
      setListeningTab(null);
      setRecognizingTab(null);
      alert('Could not access microphone.');
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setResultsData(null);
  };

  return (
    <div id="searchView">
      <div className="search-section">
        {/* Search Tabs */}
        <div className="search-tabs">
          <button
            className={`tab-btn ${activeTab === 'artist' ? 'active' : ''}`}
            onClick={() => switchTab('artist')}
          >
            <i className="fas fa-microphone"></i> Artist
          </button>
          <button
            className={`tab-btn ${activeTab === 'track' ? 'active' : ''}`}
            onClick={() => switchTab('track')}
          >
            <i className="fas fa-music"></i> Track
          </button>
          <button
            className={`tab-btn ${activeTab === 'album' ? 'active' : ''}`}
            onClick={() => switchTab('album')}
          >
            <i className="fas fa-compact-disc"></i> Album
          </button>
          <button
            className={`tab-btn ${activeTab === 'playlist' ? 'active' : ''}`}
            onClick={() => switchTab('playlist')}
          >
            <i className="fas fa-list-ul"></i> Playlist
          </button>
        </div>

        {/* 1. Artist Search */}
        <div id="artistSearch" style={{ display: activeTab === 'artist' ? 'block' : 'none' }}>
          <div className="search-container">
            <div className="search-box">
              <div className="search-input-wrap">
                <input
                  type="text"
                  id="artistInput"
                  placeholder="Type artist name (e.g. Arijit Singh, Atif Aslam)..."
                  value={artistQuery}
                  onChange={(e) => setArtistQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchArtist()}
                />
                <button
                  className={`mic-btn ${listeningTab === 'artist' ? 'listening' : ''}`}
                  onClick={() => startVoiceSearch('artist')}
                  title="Speak to Search"
                >
                  <i className={recognizingTab === 'artist' ? 'fas fa-spinner fa-spin' : 'fas fa-microphone'}></i>
                </button>
              </div>
              <button className="search-btn" onClick={() => handleSearchArtist()}>
                <i className="fas fa-search"></i> Search
              </button>
            </div>
          </div>
        </div>

        {/* 2. Track Search */}
        <div id="trackSearch" style={{ display: activeTab === 'track' ? 'block' : 'none' }}>
          <div className="search-container">
            <div className="search-box track-search-box">
              <div className="track-input-row">
                <input
                  type="text"
                  id="trackInput"
                  placeholder="Enter track name..."
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchTrack()}
                />
                <button
                  className={`mic-btn ${listeningTab === 'track' ? 'listening' : ''}`}
                  onClick={() => startVoiceSearch('track')}
                  title="Speak to Search"
                >
                  <i className={recognizingTab === 'track' ? 'fas fa-spinner fa-spin' : 'fas fa-microphone'}></i>
                </button>
              </div>
              <input
                type="text"
                id="trackArtistInput"
                placeholder="Artist name (optional)"
                value={trackArtistQuery}
                onChange={(e) => setTrackArtistQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchTrack()}
              />
              <button className="search-btn" onClick={handleSearchTrack}>
                <i className="fas fa-search"></i> Search Track
              </button>
            </div>
          </div>
        </div>

        {/* 3. Album Search */}
        <div id="albumSearch" style={{ display: activeTab === 'album' ? 'block' : 'none' }}>
          <div className="search-container">
            <div className="search-box">
              <div className="search-input-wrap">
                <input
                  type="text"
                  id="albumInput"
                  placeholder="Type album name (e.g. Aashiqui 2, Rockstar, Animal)..."
                  value={albumQuery}
                  onChange={(e) => setAlbumQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchAlbum()}
                />
                <button
                  className={`mic-btn ${listeningTab === 'album' ? 'listening' : ''}`}
                  onClick={() => startVoiceSearch('album')}
                  title="Speak to Search"
                >
                  <i className={recognizingTab === 'album' ? 'fas fa-spinner fa-spin' : 'fas fa-microphone'}></i>
                </button>
              </div>
              <button className="search-btn" onClick={handleSearchAlbum}>
                <i className="fas fa-search"></i> Search Album
              </button>
            </div>
          </div>
        </div>

        {/* 4. Playlist Search */}
        <div id="playlistSearch" style={{ display: activeTab === 'playlist' ? 'block' : 'none' }}>
          <div className="search-container">
            <div className="search-box">
              <div className="search-input-wrap">
                <input
                  type="text"
                  id="playlistInput"
                  placeholder="Type playlist keyword (e.g. Romantic, Lo-Fi, Party)..."
                  value={playlistQuery}
                  onChange={(e) => setPlaylistQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPlaylist()}
                />
                <button
                  className={`mic-btn ${listeningTab === 'playlist' ? 'listening' : ''}`}
                  onClick={() => startVoiceSearch('playlist')}
                  title="Speak to Search"
                >
                  <i className={recognizingTab === 'playlist' ? 'fas fa-spinner fa-spin' : 'fas fa-microphone'}></i>
                </button>
              </div>
              <button className="search-btn" onClick={handleSearchPlaylist}>
                <i className="fas fa-search"></i> Search Playlist
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="loading" style={{ display: 'block' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '20px' }}>Finding tunes for you...</p>
        </div>
      )}

      {/* Results */}
      {resultsData && (
        <div className="results" id="results" style={{ display: 'block' }}>
          {/* 1. Artist Results */}
          {resultsData.type === 'artist' && (
            <div>
              <div className="artist-card">
                <div className="artist-image">
                  {resultsData.data.artist.image ? (
                    <img
                      src={resultsData.data.artist.image}
                      alt={resultsData.data.artist.name}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300?text=Artist';
                      }}
                    />
                  ) : (
                    '🎤'
                  )}
                </div>
                <div className="artist-details">
                  <div className="artist-name">{resultsData.data.artist.name}</div>
                  <div className="artist-tags">
                    {resultsData.data.artist.tags &&
                      resultsData.data.artist.tags.map((tag, idx) => (
                        <span key={idx} className="tag">
                          #{tag}
                        </span>
                      ))}
                  </div>
                  <div className="artist-stats">
                    <div className="stat-card">
                      <div className="stat-number">{formatNumber(resultsData.data.artist.listeners)}</div>
                      <div className="stat-label">Listeners</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{formatNumber(resultsData.data.artist.playcount)}</div>
                      <div className="stat-label">Plays</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{resultsData.data.top_tracks ? resultsData.data.top_tracks.length : 0}</div>
                      <div className="stat-label">Top Tracks</div>
                    </div>
                  </div>
                  <div
                    className={`artist-bio ${bioCollapsed ? 'collapsed' : ''}`}
                    id="artistBio"
                    dangerouslySetInnerHTML={{ __html: resultsData.data.artist.bio || 'No bio available' }}
                  />
                  <span className="read-more" id="readMoreBtn" onClick={() => setBioCollapsed(!bioCollapsed)}>
                    {bioCollapsed ? 'Read More' : 'Read Less'}
                  </span>
                  {resultsData.data.artist.url && (
                    <a href={resultsData.data.artist.url} target="_blank" rel="noreferrer" className="artist-link">
                      <i className="fas fa-external-link-alt"></i> View on Last.fm
                    </a>
                  )}
                </div>
              </div>

              {/* Top Tracks */}
              {resultsData.data.top_tracks && resultsData.data.top_tracks.length > 0 && (
                <div className="music-section">
                  <div className="section-header">
                    <div className="section-title">
                      <i className="fas fa-chart-simple"></i> Top Tracks
                    </div>
                  </div>
                  <div className="tracks-grid">
                    {resultsData.data.top_tracks.map((track, index) => {
                      const artistName = resultsData.data.artist.name;
                      const query = `${track.name} ${artistName}`;
                      const liked = isTrackLiked(track.name, artistName);
                      const trackQueue = resultsData.data.top_tracks.map((t) => ({
                        track: t.name,
                        artist: artistName,
                        image: '',
                      }));

                      return (
                        <div key={index} className="track-item">
                          <div
                            className="track-info"
                            onClick={() => playMusic(track.name, artistName, '', trackQueue, index)}
                          >
                            <div className="track-name">
                              {index + 1}. {track.name}
                            </div>
                            <div className="track-stats">
                              <i className="fas fa-users"></i> {formatNumber(track.listeners)} listeners |{' '}
                              <i className="fas fa-play"></i> {formatNumber(track.playcount)} plays
                            </div>
                          </div>
                          <div className="track-actions">
                            <i
                              className={`${liked ? 'fas' : 'far'} fa-heart`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTrackLike(track.name, artistName, '');
                              }}
                              style={{
                                color: liked ? 'var(--neon-pink)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '17px',
                              }}
                              title="Like Track"
                            ></i>
                            <i
                              className="fas fa-plus"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModal('addToPl', { track: track.name, artist: artistName, image: '' });
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
                              onClick={() => playMusic(track.name, artistName, '', trackQueue, index)}
                            >
                              <i className="fas fa-play"></i>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Albums */}
              {resultsData.data.top_albums && resultsData.data.top_albums.length > 0 && (
                <div className="music-section">
                  <div className="section-header">
                    <div className="section-title">
                      <i className="fas fa-compact-disc"></i> Top Albums
                    </div>
                  </div>
                  <div className="albums-grid">
                    {resultsData.data.top_albums.map((album, idx) => {
                      const albumImg =
                        album.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
                      return (
                        <div
                          key={idx}
                          className="album-card"
                          onClick={() =>
                            openModal('collection', {
                              type: 'album',
                              title: album.name,
                              artist: resultsData.data.artist.name,
                              image: albumImg,
                            })
                          }
                        >
                          <div className="album-cover">
                            <img
                              src={albumImg}
                              alt={album.name}
                              onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/300?text=Album';
                              }}
                            />
                          </div>
                          <div className="album-name">{album.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--neon-cyan)', marginTop: '4px' }}>
                            <i className="fas fa-play"></i> Open Album
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Track Results */}
          {resultsData.type === 'track' && (
            <div className="music-section">
              <div className="section-header">
                <div className="section-title">
                  <i className="fas fa-music"></i> Track Results ({resultsData.data.length} found)
                </div>
              </div>
              <div className="track-results-grid">
                {resultsData.data.map((track, index) => {
                  const trackName = track.name;
                  const artistName = track.artist || 'Unknown Artist';
                  const query = `${trackName} ${artistName}`;
                  const liked = isTrackLiked(trackName, artistName);
                  const trackImg =
                    track.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                  const trackQueue = resultsData.data.map((t) => ({
                    track: t.name,
                    artist: t.artist || 'Unknown Artist',
                    image: t.image || '',
                    id: t.id || '',
                  }));

                  return (
                    <div key={index} className="track-item">
                      <div
                        className="track-thumbnail-wrap"
                        onClick={() => playMusic(trackName, artistName, trackImg, trackQueue, index)}
                      >
                        <img
                          src={trackImg}
                          className="track-thumbnail-img"
                          alt={trackName}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                          }}
                        />
                      </div>
                      <div
                        className="track-info"
                        onClick={() => playMusic(trackName, artistName, trackImg, trackQueue, index)}
                      >
                        <div className="track-name">
                          {index + 1}. {trackName}
                        </div>
                        <div className="track-stats">
                          <i className="fas fa-microphone"></i> {artistName}{' '}
                          {track.album && (
                            <>
                              {' '}• <i className="fas fa-compact-disc"></i> {track.album}
                            </>
                          )}{' '}
                          {track.year && `(${track.year})`}
                        </div>
                      </div>
                      <div className="track-actions">
                        <i
                          className={`${liked ? 'fas' : 'far'} fa-heart`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrackLike(trackName, artistName, trackImg);
                          }}
                          style={{
                            color: liked ? 'var(--neon-pink)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '17px',
                          }}
                          title="Like Track"
                        ></i>
                        <i
                          className="fas fa-plus"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('addToPl', { track: trackName, artist: artistName, image: trackImg });
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
                          onClick={() => playMusic(trackName, artistName, trackImg, trackQueue, index)}
                        >
                          <i className="fas fa-play"></i>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Album Results */}
          {resultsData.type === 'album' && (
            <div className="music-section">
              <div className="section-header">
                <div className="section-title">
                  <i className="fas fa-compact-disc"></i> Albums Found ({resultsData.data.length})
                </div>
              </div>
              <div className="collection-grid">
                {resultsData.data.map((alb, idx) => {
                  const img =
                    alb.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
                  return (
                    <div
                      key={alb.id || idx}
                      className="collection-card"
                      onClick={() =>
                        openModal('collection', {
                          type: 'album',
                          id: alb.id,
                          title: alb.title,
                          artist: alb.artist,
                          image: img,
                        })
                      }
                    >
                      <div className="collection-cover-wrap">
                        <img
                          src={img}
                          className="collection-cover-img"
                          alt={alb.title}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300?text=Album';
                          }}
                        />
                        <span className="collection-type-badge">Album</span>
                        <div className="collection-hover-play">
                          <i className="fas fa-play"></i>
                        </div>
                      </div>
                      <div className="collection-card-title">{alb.title}</div>
                      <div className="collection-card-subtitle">{alb.artist}</div>
                      <div className="collection-card-footer">
                        <span>{alb.year ? alb.year : 'Album'}</span>
                        <span style={{ color: 'var(--neon-cyan)' }}>
                          <i className="fas fa-arrow-right"></i>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Playlist Results */}
          {resultsData.type === 'playlist' && (
            <div className="music-section">
              <div className="section-header">
                <div className="section-title">
                  <i className="fas fa-list"></i> Playlists Found ({resultsData.data.length})
                </div>
              </div>
              <div className="collection-grid">
                {resultsData.data.map((pl, idx) => {
                  const img =
                    pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                  return (
                    <div
                      key={pl.id || idx}
                      className="collection-card"
                      onClick={() =>
                        openModal('collection', {
                          type: 'playlist',
                          id: pl.id,
                          title: pl.title,
                          image: img,
                        })
                      }
                    >
                      <div className="collection-cover-wrap">
                        <img
                          src={img}
                          className="collection-cover-img"
                          alt={pl.title}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300?text=Playlist';
                          }}
                        />
                        <span
                          className="collection-type-badge"
                          style={{ color: 'var(--neon-pink)', borderColor: 'rgba(255,8,68,0.3)' }}
                        >
                          Playlist
                        </span>
                        <div className="collection-hover-play">
                          <i className="fas fa-play"></i>
                        </div>
                      </div>
                      <div className="collection-card-title">{pl.title}</div>
                      <div className="collection-card-subtitle">{pl.artist || 'Curated Playlist'}</div>
                      <div className="collection-card-footer">
                        <span>{pl.count ? `${pl.count} Songs` : 'Playlist'}</span>
                        <span style={{ color: 'var(--neon-pink)' }}>
                          <i className="fas fa-arrow-right"></i>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

