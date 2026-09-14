/**
 * MelodySphere - Complete Music Player Engine & Discovery Logic
 * Features: JioSaavn Ad-Free Streaming, Albums, Playlists, Custom Playlists,
 * Library, Database Sync, Real-time Lyrics, and Voice Search.
 */

let currentView = 'search';
let currentPlaylist = [];
let currentTrackIndex = -1;
let currentSongMeta = { track: '', artist: '', image: '', id: '', hasLyrics: false, streamUrl: '' };

// Playback Modes: Shuffle & Repeat
let isShuffle = false;
let repeatMode = 'off'; // 'off' | 'all' | 'one'
let unplayedShuffleIndices = [];
let playbackHistory = [];

// Sleep Timer State
let sleepTimerInterval = null;
let sleepTimerEndTime = null;
let sleepTimerMode = null; // null | 'minutes' | 'end-of-song'
let sleepOriginalVolume = null;
let isSleepFading = false;

// User Library State (Synced with Backend DB & LocalStorage)
let userLibrary = {
    likedTracks: [],
    likedAlbums: [],
    likedPlaylists: [],
    customPlaylists: []
};

let currentLibraryTab = 'songs';
let activeCollection = null; // { type: 'album'|'playlist'|'custom', id, title, subtitle, image, meta, songs: [] }
let targetTrackForPlaylist = null;
let creatingPlaylistFromAddModal = false;

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    // Load cached library
    loadLocalLibrary();

    // Sync with backend database
    await syncLibraryWithBackend();

    // Enter key support for all search boxes
    const bindEnter = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter') fn(); });
    };
    bindEnter('artistInput', searchArtist);
    bindEnter('trackInput', searchTrack);
    bindEnter('trackArtistInput', searchTrack);
    bindEnter('albumInput', searchAlbums);
    bindEnter('playlistInput', searchPlaylists);
    bindEnter('newPlaylistName', submitCreatePlaylist);

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        if (isTyping) return;

        if (e.code === 'Space') {
            e.preventDefault();
            togglePlay();
        } else if (e.code === 'ArrowRight' && e.shiftKey) {
            e.preventDefault();
            playNext();
        } else if (e.code === 'ArrowLeft' && e.shiftKey) {
            e.preventDefault();
            playPrevious();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            const bar = document.getElementById('progressBar');
            if (bar && bar.max > 0) {
                bar.value = Math.min(parseFloat(bar.max), parseFloat(bar.value) + 5);
                seekVideo(false);
            }
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            const bar = document.getElementById('progressBar');
            if (bar && bar.max > 0) {
                bar.value = Math.max(0, parseFloat(bar.value) - 5);
                seekVideo(false);
            }
        } else if (e.key === 'm' || e.key === 'M') {
            toggleMute();
        } else if (e.key === 's' || e.key === 'S') {
            toggleShuffle();
        } else if (e.key === 'r' || e.key === 'R') {
            toggleRepeat();
        }
    });

    // Auto-search default artist on page load
    setTimeout(() => {
        if (currentView === 'search') searchArtist();
    }, 400);

    // Initialize Voice Search
    initVoiceSearch();

    // Initialize Slider Fills
    updateSliderFill(document.getElementById('volumeBar'), '#00f2fe');
    updateSliderFill(document.getElementById('progressBar'), '#00f2fe');
});

// ==========================================
// 💾 DATABASE & LOCALSTORAGE SYNC
// ==========================================

function loadLocalLibrary() {
    try {
        const local = localStorage.getItem('melodysphere_library');
        if (local) {
            userLibrary = JSON.parse(local);
        } else {
            // Migrate legacy favorites if available
            const oldFavs = localStorage.getItem('melodysphere_favorites');
            if (oldFavs) {
                userLibrary.likedTracks = JSON.parse(oldFavs);
            }
        }
    } catch (e) {
        console.warn("Could not load local library cache:", e);
    }
    updateLibraryCounters();
}

function saveLocalLibrary() {
    try {
        localStorage.setItem('melodysphere_library', JSON.stringify(userLibrary));
        // Keep legacy key synced
        localStorage.setItem('melodysphere_favorites', JSON.stringify(userLibrary.likedTracks));
    } catch (e) {}
    updateLibraryCounters();
}

async function syncLibraryWithBackend() {
    try {
        const res = await fetch('/api/user/library');
        const data = await res.json();
        if (data.success) {
            userLibrary.likedTracks = data.likedTracks || [];
            userLibrary.likedAlbums = data.likedAlbums || [];
            userLibrary.likedPlaylists = data.likedPlaylists || [];
            userLibrary.customPlaylists = data.customPlaylists || [];
            saveLocalLibrary();
            if (currentView === 'library') renderLibrary();
        }
    } catch (err) {
        console.warn("Backend sync failed, using offline cache:", err.message);
    }
}

function updateLibraryCounters() {
    const sEl = document.getElementById('countLikedSongs');
    const aEl = document.getElementById('countLikedAlbums');
    const pEl = document.getElementById('countLikedPlaylists');
    const cEl = document.getElementById('countCustomPlaylists');
    if (sEl) sEl.innerText = (userLibrary.likedTracks || []).length;
    if (aEl) aEl.innerText = (userLibrary.likedAlbums || []).length;
    if (pEl) pEl.innerText = (userLibrary.likedPlaylists || []).length;
    if (cEl) cEl.innerText = (userLibrary.customPlaylists || []).length;
}

// ==========================================
// 🧭 NAVIGATION & VIEWS
// ==========================================

function setActiveNav(viewName) {
    document.querySelectorAll('.nav-links .nav-btn').forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else if (btn.dataset.view) {
            btn.classList.remove('active');
        }
    });
}

function hideAllViews() {
    document.getElementById('searchView').style.display = 'none';
    document.getElementById('exploreView').style.display = 'none';
    document.getElementById('chartsView').style.display = 'none';
    document.getElementById('libraryView').style.display = 'none';
}

function showSearch() {
    currentView = 'search';
    hideAllViews();
    document.getElementById('searchView').style.display = 'block';
    setActiveNav('search');
}

async function showExplore() {
    currentView = 'explore';
    hideAllViews();
    document.getElementById('exploreView').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    setActiveNav('explore');
    await loadExplore();
}

async function showCharts() {
    currentView = 'charts';
    hideAllViews();
    document.getElementById('chartsView').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    setActiveNav('charts');
    await loadCharts();
}

function showLibrary() {
    currentView = 'library';
    hideAllViews();
    document.getElementById('libraryView').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    setActiveNav('library');
    renderLibrary();
}


// Legacy alias for compatibility
function showFavorites() {
    showLibrary();
}

// ==========================================
// 🔍 SEARCH SYSTEM (Artist, Track, Album, Playlist)
// ==========================================

function switchTab(tab) {
    const tabs = ['artist', 'track', 'album', 'playlist'];
    tabs.forEach(t => {
        const view = document.getElementById(`${t}Search`);
        if (view) view.style.display = (t === tab) ? 'block' : 'none';
    });

    const tabBtns = document.querySelectorAll('.search-tabs .tab-btn');
    tabBtns.forEach((btn, idx) => {
        if (tabs[idx] === tab) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.getElementById('results').style.display = 'none';
}

async function searchArtist() {
    const query = document.getElementById('artistInput').value.trim() || "Arijit Singh";
    if (!query) return;
    showLoading(true);
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.success) {
            displayArtistResults(data);
        } else {
            displayError(data.error || 'No artist found');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to fetch artist. Please try again.');
    }
    showLoading(false);
}

async function searchTrack() {
    const track = document.getElementById('trackInput').value.trim();
    const artist = document.getElementById('trackArtistInput').value.trim();
    if (!track) {
        alert('Please enter a track name');
        return;
    }
    showLoading(true);
    try {
        let url = `/api/track/search?q=${encodeURIComponent(track)}`;
        if (artist) url += `&artist=${encodeURIComponent(artist)}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && data.results && data.results.length > 0) {
            displayTrackResults(data.results);
        } else {
            displayError('No tracks found');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to fetch tracks. Please try again.');
    }
    showLoading(false);
}

async function searchAlbums() {
    const query = document.getElementById('albumInput').value.trim();
    if (!query) {
        alert('Please enter an album name');
        return;
    }
    showLoading(true);
    try {
        const res = await fetch(`/api/saavn/album/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
            displayAlbumResults(data.results);
        } else {
            displayError('No albums found with that name');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to search albums. Please try again.');
    }
    showLoading(false);
}

async function searchPlaylists() {
    const query = document.getElementById('playlistInput').value.trim();
    if (!query) {
        alert('Please enter a playlist keyword');
        return;
    }
    showLoading(true);
    try {
        const res = await fetch(`/api/saavn/playlist/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
            displayPlaylistResults(data.results);
        } else {
            displayError('No playlists found');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to search playlists. Please try again.');
    }
    showLoading(false);
}

// ==========================================
// 🎨 RESULT DISPLAY RENDERERS
// ==========================================

function displayArtistResults(data) {
    const resultsDiv = document.getElementById('results');
    const artist = data.artist;
    const tracks = data.top_tracks;
    const albums = data.top_albums;
    
    let html = `
        <div class="artist-card">
            <div class="artist-image">
                ${artist.image ? `<img src="${artist.image}" alt="${artist.name}" onerror="this.src='https://via.placeholder.com/300?text=Artist'">` : '🎤'}
            </div>
            <div class="artist-details">
                <div class="artist-name">${escapeHtml(artist.name)}</div>
                <div class="artist-tags">
                    ${artist.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
                </div>
                <div class="artist-stats">
                    <div class="stat-card">
                        <div class="stat-number">${formatNumber(artist.listeners)}</div>
                        <div class="stat-label">Listeners</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${formatNumber(artist.playcount)}</div>
                        <div class="stat-label">Plays</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${tracks.length}</div>
                        <div class="stat-label">Top Tracks</div>
                    </div>
                </div>
                <div class="artist-bio collapsed" id="artistBio">
                    ${artist.bio}
                </div>
                <span class="read-more" id="readMoreBtn" onclick="toggleBio()">Read More</span>
                <a href="${artist.url}" target="_blank" class="artist-link"><i class="fas fa-external-link-alt"></i> View on Last.fm</a>
            </div>
        </div>
    `;
    
    // Top Tracks Section
    if (tracks.length > 0) {
        currentPlaylist = tracks.map(t => ({ track: t.name, artist: artist.name }));
        
        html += `
            <div class="music-section">
                <div class="section-header">
                    <div class="section-title"><i class="fas fa-chart-simple"></i> Top Tracks</div>
                </div>
                <div class="tracks-grid">
        `;
        
        tracks.forEach((track, index) => {
            const artistName = artist.name;
            const query = `${track.name} ${artistName}`;
            const liked = isTrackLiked(track.name, artistName);
            html += `
                <div class="track-item">
                    <div class="track-info" onclick="playTrackByIndex(${index})">
                        <div class="track-name">${index + 1}. ${escapeHtml(track.name)}</div>
                        <div class="track-stats">
                            <i class="fas fa-users"></i> ${formatNumber(track.listeners)} listeners | 
                            <i class="fas fa-play"></i> ${formatNumber(track.playcount)} plays
                        </div>
                    </div>
                    <div class="track-actions">
                        <i class="${liked ? 'fas' : 'far'} fa-heart" onclick="toggleTrackLike('${escapeHtml(track.name)}', '${escapeHtml(artistName)}'); event.stopPropagation();" style="color:${liked ? 'var(--neon-pink)' : 'var(--text-muted)'}; cursor:pointer; font-size:17px;" title="Like Track"></i>
                        <i class="fas fa-plus" onclick="openAddToPlaylistModal('${escapeHtml(track.name)}', '${escapeHtml(artistName)}'); event.stopPropagation();" style="color:var(--text-muted); cursor:pointer; font-size:15px;" title="Add to Playlist"></i>
                        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="yt-link" title="Watch on YouTube">
                            <i class="fab fa-youtube"></i>
                        </a>
                        <div class="track-play" onclick="playTrackByIndex(${index})">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Top Albums Section (Click opens interactive album modal!)
    if (albums && albums.length > 0) {
        html += `
            <div class="music-section">
                <div class="section-header">
                    <div class="section-title"><i class="fas fa-compact-disc"></i> Top Albums</div>
                </div>
                <div class="albums-grid">
        `;
        
        albums.forEach(album => {
            const albumImg = album.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
            html += `
                <div class="album-card" onclick="openAlbumByName('${escapeHtml(album.name)}', '${escapeHtml(artist.name)}', '${albumImg}')">
                    <div class="album-cover">
                        <img src="${albumImg}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/300?text=Album'">
                    </div>
                    <div class="album-name">${escapeHtml(album.name)}</div>
                    <div style="font-size: 12px; color: var(--neon-cyan); margin-top:4px;"><i class="fas fa-play"></i> Open Album</div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayTrackResults(tracks) {
    const resultsDiv = document.getElementById('results');
    currentPlaylist = tracks.slice(0, 30).map(t => ({ 
        track: t.name, 
        artist: t.artist,
        image: t.image || ''
    }));
    
    let html = `
        <div class="music-section">
            <div class="section-header">
                <div class="section-title"><i class="fas fa-music"></i> Track Results (${tracks.length} found)</div>
            </div>
            <div class="track-results-grid">
    `;
    
    tracks.slice(0, 30).forEach((track, index) => {
        const query = `${track.name} ${track.artist}`;
        const liked = isTrackLiked(track.name, track.artist);
        const trackImg = track.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
        html += `
            <div class="track-item">
                <div class="track-thumbnail-wrap" onclick="playTrackByIndex(${index})">
                    <img src="${trackImg}" class="track-thumbnail-img" alt="${escapeHtml(track.name)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';">
                </div>
                <div class="track-info" onclick="playTrackByIndex(${index})">
                    <div class="track-name">${index + 1}. ${escapeHtml(track.name)}</div>
                    <div class="track-stats">
                        <i class="fas fa-microphone"></i> ${escapeHtml(track.artist)} ${track.album ? ` • <i class="fas fa-compact-disc"></i> ${escapeHtml(track.album)}` : ''} ${track.year ? `(${track.year})` : ''}
                    </div>
                </div>
                <div class="track-actions">
                    <i class="${liked ? 'fas' : 'far'} fa-heart" onclick="toggleTrackLike('${escapeHtml(track.name)}', '${escapeHtml(track.artist)}', '${escapeHtml(track.image || '')}', this); event.stopPropagation();" style="color:${liked ? 'var(--neon-pink)' : 'var(--text-muted)'}; cursor:pointer; font-size:17px;" title="Like Track"></i>
                    <i class="fas fa-plus" onclick="openAddToPlaylistModal('${escapeHtml(track.name)}', '${escapeHtml(track.artist)}', '${escapeHtml(track.image || '')}'); event.stopPropagation();" style="color:var(--text-muted); cursor:pointer; font-size:15px;" title="Add to Playlist"></i>
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="yt-link" title="Watch on YouTube">
                        <i class="fab fa-youtube"></i>
                    </a>
                    <div class="track-play" onclick="playTrackByIndex(${index})">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayAlbumResults(albums) {
    const resultsDiv = document.getElementById('results');
    let html = `
        <div class="music-section">
            <div class="section-header">
                <div class="section-title"><i class="fas fa-compact-disc"></i> Albums Found (${albums.length})</div>
            </div>
            <div class="collection-grid">
    `;

    albums.forEach(alb => {
        const img = alb.image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';
        html += `
            <div class="collection-card" onclick="openAlbum('${alb.id}', '${escapeHtml(alb.title)}', '${escapeHtml(alb.artist)}', '${img}')">
                <div class="collection-cover-wrap">
                    <img src="${img}" class="collection-cover-img" alt="${alb.title}" onerror="this.src='https://via.placeholder.com/300?text=Album'">
                    <span class="collection-type-badge">Album</span>
                    <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                </div>
                <div class="collection-card-title">${escapeHtml(alb.title)}</div>
                <div class="collection-card-subtitle">${escapeHtml(alb.artist)}</div>
                <div class="collection-card-footer">
                    <span>${alb.year ? alb.year : 'Album'}</span>
                    <span style="color:var(--neon-cyan)"><i class="fas fa-arrow-right"></i></span>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayPlaylistResults(playlists) {
    const resultsDiv = document.getElementById('results');
    let html = `
        <div class="music-section">
            <div class="section-header">
                <div class="section-title"><i class="fas fa-list"></i> Playlists Found (${playlists.length})</div>
            </div>
            <div class="collection-grid">
    `;

    playlists.forEach(pl => {
        const img = pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
        html += `
            <div class="collection-card" onclick="openPlaylist('${pl.id}', '${escapeHtml(pl.title)}', '${img}')">
                <div class="collection-cover-wrap">
                    <img src="${img}" class="collection-cover-img" alt="${pl.title}" onerror="this.src='https://via.placeholder.com/300?text=Playlist'">
                    <span class="collection-type-badge" style="color:var(--neon-pink); border-color:rgba(255,8,68,0.3)">Playlist</span>
                    <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                </div>
                <div class="collection-card-title">${escapeHtml(pl.title)}</div>
                <div class="collection-card-subtitle">${escapeHtml(pl.artist || 'Curated Playlist')}</div>
                <div class="collection-card-footer">
                    <span>${pl.count ? `${pl.count} Songs` : 'Playlist'}</span>
                    <span style="color:var(--neon-pink)"><i class="fas fa-arrow-right"></i></span>
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// 🌟 EXPLORE & CHARTS
// ==========================================

let exploreData = { playlists: [], albums: [] };
let exploreCategory = 'All';
let explorePlaylistLimit = 8;
let exploreAlbumLimit = 8;

async function loadExplore() {
    const plGrid = document.getElementById('explorePlaylistsGrid');
    const albGrid = document.getElementById('exploreAlbumsGrid');

    if (exploreData.playlists.length > 0 && exploreData.albums.length > 0) {
        renderExplore();
        return;
    }

    try {
        if (plGrid) plGrid.innerHTML = '<div class="loading" style="display:block">Loading featured playlists...</div>';
        if (albGrid) albGrid.innerHTML = '<div class="loading" style="display:block">Loading popular albums...</div>';

        const res = await fetch('/api/saavn/featured');
        const data = await res.json();

        if (data.success) {
            exploreData.playlists = data.playlists || [];
            exploreData.albums = data.albums || [];
            renderExplore();
        }
    } catch (err) {
        console.error("Explore load error:", err);
        if (plGrid) plGrid.innerHTML = '<div class="error-message">Failed to load playlists</div>';
        if (albGrid) albGrid.innerHTML = '<div class="error-message">Failed to load albums</div>';
    }
}

function filterExploreCategory(cat, el) {
    exploreCategory = cat;
    explorePlaylistLimit = 8;
    exploreAlbumLimit = 8;

    // Update active class on chips
    document.querySelectorAll('.explore-chip').forEach(chip => chip.classList.remove('active'));
    if (el) el.classList.add('active');

    renderExplore();
}

function renderExplore() {
    const plGrid = document.getElementById('explorePlaylistsGrid');
    const albGrid = document.getElementById('exploreAlbumsGrid');
    const plWrap = document.getElementById('loadMorePlaylistsWrap');
    const albWrap = document.getElementById('loadMoreAlbumsWrap');
    const plCounter = document.getElementById('playlistsCounter');
    const albCounter = document.getElementById('albumsCounter');

    // Filter Playlists
    const filteredPlaylists = exploreCategory === 'All' 
        ? exploreData.playlists 
        : exploreData.playlists.filter(p => (p.category || '').toLowerCase() === exploreCategory.toLowerCase());

    const visiblePlaylists = filteredPlaylists.slice(0, explorePlaylistLimit);

    if (plGrid) {
        if (visiblePlaylists.length === 0) {
            plGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:14px;"><i class="fas fa-info-circle"></i> No playlists in "${escapeHtml(exploreCategory)}". Try selecting "All" or another category.</div>`;
        } else {
            let plHtml = '';
            visiblePlaylists.forEach(pl => {
                plHtml += `
                    <div class="collection-card" onclick="openPlaylist('${pl.id}', '${escapeHtml(pl.title)}', '${pl.image}')">
                        <div class="collection-cover-wrap">
                            <img src="${pl.image}" class="collection-cover-img" alt="${pl.title}" onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'">
                            <span class="collection-type-badge" style="color:var(--neon-pink); border-color:rgba(255,8,68,0.3)">${escapeHtml(pl.category || 'Playlist')}</span>
                            <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                        </div>
                        <div class="collection-card-title">${escapeHtml(pl.title)}</div>
                        <div class="collection-card-subtitle">${pl.count || 30} Tracks • Curated</div>
                        <div class="collection-card-footer">
                            <span>Curated Mix</span>
                            <span style="color:var(--neon-pink)"><i class="fas fa-play"></i> Play</span>
                        </div>
                    </div>
                `;
            });
            plGrid.innerHTML = plHtml;
        }
    }

    // Playlists Load More controls
    if (plWrap) {
        if (filteredPlaylists.length > explorePlaylistLimit) {
            plWrap.style.display = 'flex';
            if (plCounter) plCounter.innerText = `Showing ${visiblePlaylists.length} of ${filteredPlaylists.length} Playlists`;
        } else {
            plWrap.style.display = 'none';
        }
    }

    // Filter Albums
    const filteredAlbums = exploreCategory === 'All' 
        ? exploreData.albums 
        : exploreData.albums.filter(a => (a.category || '').toLowerCase() === exploreCategory.toLowerCase());

    const visibleAlbums = filteredAlbums.slice(0, exploreAlbumLimit);

    if (albGrid) {
        if (visibleAlbums.length === 0) {
            albGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:14px;"><i class="fas fa-info-circle"></i> No albums in "${escapeHtml(exploreCategory)}". Try selecting "All" or another category.</div>`;
        } else {
            let albHtml = '';
            visibleAlbums.forEach(alb => {
                albHtml += `
                    <div class="collection-card" onclick="openAlbum('${alb.id}', '${escapeHtml(alb.title)}', '${escapeHtml(alb.artist)}', '${alb.image}')">
                        <div class="collection-cover-wrap">
                            <img src="${alb.image}" class="collection-cover-img" alt="${alb.title}" onerror="this.src='https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60'">
                            <span class="collection-type-badge">${escapeHtml(alb.category || 'Album')}</span>
                            <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                        </div>
                        <div class="collection-card-title">${escapeHtml(alb.title)}</div>
                        <div class="collection-card-subtitle">${escapeHtml(alb.artist)}</div>
                        <div class="collection-card-footer">
                            <span>${alb.year || 'Hit Album'}</span>
                            <span style="color:var(--neon-cyan)"><i class="fas fa-compact-disc"></i> View</span>
                        </div>
                    </div>
                `;
            });
            albGrid.innerHTML = albHtml;
        }
    }

    // Albums Load More controls
    if (albWrap) {
        if (filteredAlbums.length > exploreAlbumLimit) {
            albWrap.style.display = 'flex';
            if (albCounter) albCounter.innerText = `Showing ${visibleAlbums.length} of ${filteredAlbums.length} Albums`;
        } else {
            albWrap.style.display = 'none';
        }
    }
}

function loadMoreExplorePlaylists() {
    explorePlaylistLimit += 8;
    renderExplore();
}

function loadMoreExploreAlbums() {
    exploreAlbumLimit += 8;
    renderExplore();
}

async function loadCharts() {
    const chartsGrid = document.getElementById('chartsGrid');
    chartsGrid.innerHTML = '<div class="loading" style="display:block">Loading top artists...</div>';
    
    try {
        const response = await fetch('/api/charts');
        const data = await response.json();
        
        if (data.artists?.artist) {
            let html = '';
            data.artists.artist.slice(0, 16).forEach((artist, index) => {
                const imgUrl = artist.image || 'https://via.placeholder.com/150?text=Artist';
                html += `
                    <div class="chart-item" onclick="searchArtistByName('${escapeHtml(artist.name)}')">
                        <div class="chart-rank">#${index + 1}</div>
                        <img src="${imgUrl}" class="chart-img" alt="${artist.name}" onerror="this.src='https://via.placeholder.com/150?text=Artist'">
                        <div class="chart-name">${escapeHtml(artist.name)}</div>
                        <div style="font-size: 12px; color: #666;">${formatNumber(artist.listeners || artist.playcount)} listeners</div>
                    </div>
                `;
            });
            chartsGrid.innerHTML = html;
        }
    } catch (error) {
        console.error('Chart Error:', error);
        chartsGrid.innerHTML = '<div class="error-message">Failed to load charts</div>';
    }
}

function searchArtistByName(name) {
    document.getElementById('artistInput').value = name;
    showSearch();
    switchTab('artist');
    searchArtist();
}

// ==========================================
// 📀 COLLECTION (ALBUM / PLAYLIST) MODAL & PLAYBACK
// ==========================================

async function openAlbum(albumId, title, artist = '', image = '') {
    const modal = document.getElementById('collectionModal');
    const badge = document.getElementById('collectionBadge');
    const headTitle = document.getElementById('collectionModalHeading');
    const imgEl = document.getElementById('collectionImg');
    const titleEl = document.getElementById('collectionTitle');
    const subEl = document.getElementById('collectionSubtitle');
    const metaEl = document.getElementById('collectionMeta');
    const listEl = document.getElementById('collectionTracklist');

    badge.innerText = "ALBUM";
    badge.style.color = "var(--neon-cyan)";
    badge.style.borderColor = "var(--neon-cyan)";
    badge.style.background = "rgba(0, 242, 254, 0.15)";
    headTitle.innerText = "Album Details";

    imgEl.src = image || 'https://via.placeholder.com/300?text=Album';
    titleEl.innerText = title;
    subEl.innerText = artist || "Various Artists";
    metaEl.innerText = "Fetching album tracks...";
    listEl.innerHTML = `<div class="loading" style="display:block; padding:30px;"><div class="spinner" style="width:40px; height:40px;"></div><p style="margin-top:10px;">Loading tracks...</p></div>`;

    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/saavn/album?id=${encodeURIComponent(albumId)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
        const data = await res.json();

        if (data.success && data.songs && data.songs.length > 0) {
            activeCollection = {
                type: 'album',
                id: data.id || albumId,
                title: data.title || title,
                subtitle: data.artist || artist,
                image: data.image || image,
                meta: `${data.songs.length} Tracks • ${data.year || ''}`,
                songs: data.songs
            };

            if (data.image) imgEl.src = data.image;
            titleEl.innerText = activeCollection.title;
            subEl.innerText = activeCollection.subtitle;
            metaEl.innerText = activeCollection.meta;

            updateCollectionLikeBtn();
            renderCollectionTracklist(data.songs);
        } else {
            listEl.innerHTML = `<p style="padding:20px; color:var(--text-muted);">No tracks found in this album.</p>`;
        }
    } catch (err) {
        listEl.innerHTML = `<p style="padding:20px; color:var(--text-muted);">Failed to load album tracks.</p>`;
    }
}

async function openAlbumByName(albumName, artistName, image = '') {
    showLoading(true);
    try {
        const res = await fetch(`/api/saavn/album/search?q=${encodeURIComponent(albumName + ' ' + artistName)}`);
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
            const alb = data.results[0];
            openAlbum(alb.id, alb.title, alb.artist, alb.image || image);
        } else {
            // Fallback search
            const fRes = await fetch(`/api/saavn/album/search?q=${encodeURIComponent(albumName)}`);
            const fData = await fRes.json();
            if (fData.success && fData.results && fData.results.length > 0) {
                const alb = fData.results[0];
                openAlbum(alb.id, alb.title, alb.artist, alb.image || image);
            } else {
                alert("Album details not found on stream server.");
            }
        }
    } catch (e) {
        alert("Failed to fetch album.");
    }
    showLoading(false);
}

async function openPlaylist(playlistId, title, image = '') {
    const modal = document.getElementById('collectionModal');
    const badge = document.getElementById('collectionBadge');
    const headTitle = document.getElementById('collectionModalHeading');
    const imgEl = document.getElementById('collectionImg');
    const titleEl = document.getElementById('collectionTitle');
    const subEl = document.getElementById('collectionSubtitle');
    const metaEl = document.getElementById('collectionMeta');
    const listEl = document.getElementById('collectionTracklist');

    badge.innerText = "PLAYLIST";
    badge.style.color = "var(--neon-pink)";
    badge.style.borderColor = "var(--neon-pink)";
    badge.style.background = "rgba(255, 8, 68, 0.15)";
    headTitle.innerText = "Playlist Details";

    imgEl.src = image || 'https://via.placeholder.com/300?text=Playlist';
    titleEl.innerText = title;
    subEl.innerText = "Curated Playlist";
    metaEl.innerText = "Fetching playlist tracks...";
    listEl.innerHTML = `<div class="loading" style="display:block; padding:30px;"><div class="spinner" style="width:40px; height:40px;"></div><p style="margin-top:10px;">Loading tracks...</p></div>`;

    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/saavn/playlist?id=${encodeURIComponent(playlistId)}&title=${encodeURIComponent(title)}`);
        const data = await res.json();

        if (data.success && data.songs && data.songs.length > 0) {
            activeCollection = {
                type: 'playlist',
                id: data.id || playlistId,
                title: data.title || title,
                subtitle: "Curated Playlist",
                image: data.image || image,
                meta: `${data.songs.length} Tracks`,
                songs: data.songs
            };

            if (data.image) imgEl.src = data.image;
            titleEl.innerText = activeCollection.title;
            metaEl.innerText = activeCollection.meta;

            updateCollectionLikeBtn();
            renderCollectionTracklist(data.songs);
        } else {
            listEl.innerHTML = `<p style="padding:20px; color:var(--text-muted);">No tracks found in this playlist.</p>`;
        }
    } catch (err) {
        listEl.innerHTML = `<p style="padding:20px; color:var(--text-muted);">Failed to load playlist tracks.</p>`;
    }
}

function openCustomPlaylist(playlistId) {
    const pl = (userLibrary.customPlaylists || []).find(p => p.id === playlistId);
    if (!pl) return;

    const modal = document.getElementById('collectionModal');
    const badge = document.getElementById('collectionBadge');
    const headTitle = document.getElementById('collectionModalHeading');
    const imgEl = document.getElementById('collectionImg');
    const titleEl = document.getElementById('collectionTitle');
    const subEl = document.getElementById('collectionSubtitle');
    const metaEl = document.getElementById('collectionMeta');

    badge.innerText = "MY PLAYLIST";
    badge.style.color = "var(--neon-cyan)";
    badge.style.borderColor = "var(--neon-cyan)";
    badge.style.background = "rgba(0, 242, 254, 0.15)";
    headTitle.innerText = "My Playlist";

    imgEl.src = pl.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
    titleEl.innerText = pl.name;
    subEl.innerText = pl.description || "Created by You";
    metaEl.innerText = `${(pl.tracks || []).length} Songs`;

    activeCollection = {
        type: 'custom',
        id: pl.id,
        title: pl.name,
        subtitle: pl.description || "Personal Playlist",
        image: pl.image,
        meta: `${(pl.tracks || []).length} Songs`,
        songs: (pl.tracks || []).map(t => ({ title: t.track, artist: t.artist, image: t.image }))
    };

    updateCollectionLikeBtn();
    renderCollectionTracklist(activeCollection.songs, true, pl.id);
    modal.style.display = 'flex';
}

function renderCollectionTracklist(songs, isCustom = false, customPlId = '') {
    const listEl = document.getElementById('collectionTracklist');
    if (!songs || songs.length === 0) {
        listEl.innerHTML = `<p style="padding:20px; color:var(--text-muted); text-align:center;">This collection has no songs yet.</p>`;
        return;
    }

    let html = '';
    songs.forEach((s, idx) => {
        const title = s.title || s.song;
        const artist = s.artist || s.singers || '';
        const dur = s.duration ? formatTime(parseInt(s.duration)) : '';
        const liked = isTrackLiked(title, artist);
        const songImg = s.image || (activeCollection ? activeCollection.image : '') || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';

        html += `
            <div class="track-item" style="padding:10px 15px;">
                <div class="track-thumbnail-wrap" onclick="playCollectionTrackByIndex(${idx})">
                    <img src="${songImg}" class="track-thumbnail-img" alt="${escapeHtml(title)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';">
                </div>
                <div class="track-info" onclick="playCollectionTrackByIndex(${idx})">
                    <div class="track-name" style="font-size:14px;">${idx + 1}. ${escapeHtml(title)}</div>
                    <div class="track-stats" style="font-size:12px;">
                        <i class="fas fa-microphone"></i> ${escapeHtml(artist)} ${dur ? `• ${dur}` : ''}
                    </div>
                </div>
                <div class="track-actions" style="gap:10px;">
                    <i class="${liked ? 'fas' : 'far'} fa-heart" onclick="toggleTrackLike('${escapeHtml(title)}', '${escapeHtml(artist)}', '${escapeHtml(songImg)}', this); event.stopPropagation();" style="color:${liked ? 'var(--neon-pink)' : 'var(--text-muted)'}; cursor:pointer; font-size:16px;" title="${liked ? 'Unlike Song' : 'Like Song'}"></i>
                    ${isCustom ? `
                        <i class="fas fa-trash" onclick="removeTrackFromCustomPlaylist('${customPlId}', ${idx}); event.stopPropagation();" style="color:var(--text-muted); cursor:pointer; font-size:14px;" title="Remove from Playlist" onmouseover="this.style.color='#ff0844'" onmouseout="this.style.color='var(--text-muted)'"></i>
                    ` : `
                        <i class="fas fa-plus" onclick="openAddToPlaylistModal('${escapeHtml(title)}', '${escapeHtml(artist)}', '${escapeHtml(songImg)}'); event.stopPropagation();" style="color:var(--text-muted); cursor:pointer; font-size:14px;" title="Add to Playlist"></i>
                    `}
                    <div class="track-play" onclick="playCollectionTrackByIndex(${idx})" style="width:36px; height:36px; font-size:13px;">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

function playCollectionTrackByIndex(index) {
    if (!activeCollection || !activeCollection.songs || !activeCollection.songs[index]) return;
    
    // Set active queue to collection songs with preserved HD images
    currentPlaylist = activeCollection.songs.map(s => ({
        track: s.title || s.song,
        artist: s.artist || s.singers || '',
        image: s.image || (activeCollection ? activeCollection.image : '') || ''
    }));

    closeCollectionModal();
    playTrackByIndex(index);
}

function playCurrentCollection(shuffleMode = false) {
    if (!activeCollection || !activeCollection.songs || activeCollection.songs.length === 0) {
        showToast('Playlist tracks loading, please wait...', 'fa-spinner');
        return;
    }

    let songs = [...activeCollection.songs];
    if (shuffleMode) {
        for (let i = songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songs[i], songs[j]] = [songs[j], songs[i]];
        }
        isShuffle = true;
        const btn = document.getElementById('shuffleBtn');
        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('title', 'Shuffle On (S)');
        }
        showToast('Shuffle ON: Playing random tracks', 'fa-random');
    } else {
        isShuffle = false;
        const btn = document.getElementById('shuffleBtn');
        if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('title', 'Shuffle Off (S)');
        }
        showToast('Playing playlist from start', 'fa-play');
    }

    currentPlaylist = songs.map(s => ({
        track: s.title || s.song,
        artist: s.artist || s.singers || '',
        image: s.image || (activeCollection ? activeCollection.image : '') || ''
    }));

    if (shuffleMode && currentPlaylist.length > 1) {
        unplayedShuffleIndices = currentPlaylist.map((_, i) => i).filter(i => i !== 0);
    } else {
        unplayedShuffleIndices = [];
    }

    closeCollectionModal();
    playTrackByIndex(0);
}

function closeCollectionModal() {
    document.getElementById('collectionModal').style.display = 'none';
}

function updateCollectionLikeBtn() {
    const btn = document.getElementById('collectionLikeBtn');
    if (!btn || !activeCollection) return;

    if (activeCollection.type === 'custom') {
        btn.style.display = 'none';
        return;
    }
    btn.style.display = 'inline-flex';

    let saved = false;
    const isAlb = activeCollection.type === 'album';
    if (isAlb) {
        saved = isAlbumLiked(activeCollection.id, activeCollection.title);
    } else if (activeCollection.type === 'playlist') {
        saved = isPlaylistLiked(activeCollection.id, activeCollection.title);
    }

    const typeLabel = isAlb ? 'Album' : 'Playlist';

    if (saved) {
        btn.innerHTML = `<i class="fas fa-bookmark" style="color:var(--neon-cyan)"></i> Saved ${typeLabel}`;
        btn.style.borderColor = "var(--neon-cyan)";
        btn.style.color = "var(--neon-cyan)";
    } else {
        btn.innerHTML = `<i class="far fa-bookmark"></i> Save ${typeLabel}`;
        btn.style.borderColor = "var(--glass-border)";
        btn.style.color = "var(--text-main)";
    }
}

async function toggleCurrentCollectionLike() {
    if (!activeCollection) return;

    if (activeCollection.type === 'album') {
        await toggleAlbumLike({
            id: activeCollection.id,
            title: activeCollection.title,
            artist: activeCollection.subtitle,
            image: activeCollection.image,
            songCount: activeCollection.songs.length
        });
    } else if (activeCollection.type === 'playlist') {
        await togglePlaylistLike({
            id: activeCollection.id,
            title: activeCollection.title,
            image: activeCollection.image,
            count: activeCollection.songs.length
        });
    }

    updateCollectionLikeBtn();
}

// ==========================================
// ❤️ LIKE & FAVORITE HANDLERS (Tracks, Albums, Playlists)
// ==========================================

function isTrackLiked(track, artist) {
    return (userLibrary.likedTracks || []).some(t =>
        t.track.toLowerCase() === track.toLowerCase() &&
        t.artist.toLowerCase() === (artist || '').toLowerCase()
    );
}

function isAlbumLiked(id, title) {
    return (userLibrary.likedAlbums || []).some(a =>
        (id && a.id && a.id === id) ||
        (a.title && title && a.title.toLowerCase() === title.toLowerCase())
    );
}

function isPlaylistLiked(id, title) {
    return (userLibrary.likedPlaylists || []).some(p =>
        (id && p.id && p.id === id) ||
        (p.title && title && p.title.toLowerCase() === title.toLowerCase())
    );
}

async function toggleTrackLike(track, artist, image = '', el = null) {
    const idx = (userLibrary.likedTracks || []).findIndex(t =>
        t.track.toLowerCase() === track.toLowerCase() &&
        t.artist.toLowerCase() === (artist || '').toLowerCase()
    );

    let isLikedNow = false;
    if (idx > -1) {
        userLibrary.likedTracks.splice(idx, 1);
        isLikedNow = false;
    } else {
        userLibrary.likedTracks.unshift({ track, artist, image });
        isLikedNow = true;
    }

    if (el) {
        el.className = isLikedNow ? 'fas fa-heart' : 'far fa-heart';
        el.style.color = isLikedNow ? 'var(--neon-pink)' : 'var(--text-muted)';
        el.title = isLikedNow ? 'Unlike Song' : 'Like Song';
    }

    saveLocalLibrary();
    updatePlayerLikeBtn();

    if (currentView === 'library' && currentLibraryTab === 'songs') renderLibrary();

    // Sync with backend API
    try {
        await fetch('/api/user/library/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'track', item: { track, artist, image } })
        });
    } catch (e) {}
}

async function toggleAlbumLike(album) {
    const idx = (userLibrary.likedAlbums || []).findIndex(a =>
        (album.id && a.id && a.id === album.id) ||
        (a.title && album.title && a.title.toLowerCase() === album.title.toLowerCase())
    );

    if (idx > -1) {
        userLibrary.likedAlbums.splice(idx, 1);
    } else {
        userLibrary.likedAlbums.unshift(album);
    }

    saveLocalLibrary();
    if (currentView === 'library') renderLibrary();

    try {
        await fetch('/api/user/library/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'album', item: album })
        });
    } catch (e) {}
}

async function togglePlaylistLike(playlist) {
    const idx = (userLibrary.likedPlaylists || []).findIndex(p =>
        (playlist.id && p.id && p.id === playlist.id) ||
        (p.title && playlist.title && p.title.toLowerCase() === playlist.title.toLowerCase())
    );

    if (idx > -1) {
        userLibrary.likedPlaylists.splice(idx, 1);
    } else {
        userLibrary.likedPlaylists.unshift(playlist);
    }

    saveLocalLibrary();
    if (currentView === 'library') renderLibrary();

    try {
        await fetch('/api/user/library/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'playlist', item: playlist })
        });
    } catch (e) {}
}

function toggleCurrentFavorite() {
    if (!currentSongMeta.track) return;
    toggleTrackLike(currentSongMeta.track, currentSongMeta.artist, currentSongMeta.image);
}

function updatePlayerLikeBtn() {
    const btn = document.getElementById('playerLikeBtn');
    if (!btn || !currentSongMeta.track) return;
    const liked = isTrackLiked(currentSongMeta.track, currentSongMeta.artist);
    if (liked) {
        btn.className = 'fas fa-heart';
        btn.style.color = 'var(--neon-pink)';
    } else {
        btn.className = 'far fa-heart';
        btn.style.color = 'var(--text-muted)';
    }
}

// ==========================================
// 📂 CUSTOM PLAYLISTS MANAGER
// ==========================================

function openCreatePlaylistModal(fromAddModal = false) {
    creatingPlaylistFromAddModal = fromAddModal;
    document.getElementById('newPlaylistName').value = '';
    document.getElementById('newPlaylistDesc').value = '';
    document.getElementById('createPlaylistModal').style.display = 'flex';
}

function closeCreatePlaylistModal() {
    document.getElementById('createPlaylistModal').style.display = 'none';
}

let isCreatingPlaylist = false;

async function submitCreatePlaylist() {
    if (isCreatingPlaylist) return;
    const nameInput = document.getElementById('newPlaylistName');
    const descInput = document.getElementById('newPlaylistDesc');
    const btn = document.getElementById('createPlaylistBtn');
    const name = nameInput ? nameInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';

    if (!name) {
        alert("Please enter a playlist name");
        return;
    }

    isCreatingPlaylist = true;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Creating...`;
    }

    try {
        const res = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc })
        });
        const data = await res.json();

        if (data.success && data.playlist) {
            userLibrary.customPlaylists = data.playlists || userLibrary.customPlaylists;
            saveLocalLibrary();
            closeCreatePlaylistModal();

            if (creatingPlaylistFromAddModal && targetTrackForPlaylist) {
                await addTrackToPlaylist(data.playlist.id);
            } else if (currentView === 'library') {
                switchLibraryTab('custom');
            }
        } else {
            alert(data.error || "Failed to create playlist.");
        }
    } catch (err) {
        alert("Failed to create playlist.");
    } finally {
        isCreatingPlaylist = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-check"></i> Create & Save`;
        }
    }
}

function openAddToPlaylistModal(track, artist, image = '') {
    targetTrackForPlaylist = { track, artist, image };
    document.getElementById('addToPlSongTitle').innerText = `Add "${track}" by ${artist}`;
    
    const listEl = document.getElementById('userPlaylistsList');
    const playlists = userLibrary.customPlaylists || [];

    if (playlists.length === 0) {
        listEl.innerHTML = `<p style="padding:15px; color:var(--text-muted); font-size:13px; text-align:center;">No custom playlists yet. Create one above!</p>`;
    } else {
        let html = '';
        playlists.forEach(pl => {
            const count = (pl.tracks || []).length;
            html += `
                <div class="user-pl-item" onclick="addTrackToPlaylist('${pl.id}')">
                    <div>
                        <div style="font-weight:600; font-size:14px; color:#fff;">${escapeHtml(pl.name)}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${count} Tracks</div>
                    </div>
                    <i class="fas fa-plus-circle" style="color:var(--neon-cyan); font-size:18px;"></i>
                </div>
            `;
        });
        listEl.innerHTML = html;
    }

    document.getElementById('addToPlaylistModal').style.display = 'flex';
}

function openAddToPlaylistFromPlayer() {
    if (!currentSongMeta.track) {
        alert("Play a song first to add it to a playlist!");
        return;
    }
    openAddToPlaylistModal(currentSongMeta.track, currentSongMeta.artist, currentSongMeta.image);
}

function closeAddToPlaylistModal() {
    document.getElementById('addToPlaylistModal').style.display = 'none';
    targetTrackForPlaylist = null;
}

async function addTrackToPlaylist(playlistId) {
    if (!targetTrackForPlaylist) return;

    try {
        const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetTrackForPlaylist)
        });
        const data = await res.json();

        if (data.success) {
            const idx = (userLibrary.customPlaylists || []).findIndex(p => p.id === playlistId);
            if (idx > -1) userLibrary.customPlaylists[idx] = data.playlist;
            saveLocalLibrary();
            closeAddToPlaylistModal();
            alert(`Added to playlist!`);
            if (currentView === 'library' && currentLibraryTab === 'custom') renderLibrary();
        } else {
            alert(data.error || "Could not add track.");
        }
    } catch (e) {
        alert("Error adding track to playlist.");
    }
}

async function deleteCustomPlaylist(playlistId) {
    if (!confirm("Are you sure you want to delete this playlist?")) return;

    try {
        const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            userLibrary.customPlaylists = data.playlists;
            saveLocalLibrary();
            renderLibrary();
        }
    } catch (e) {
        alert("Failed to delete playlist.");
    }
}

async function removeTrackFromCustomPlaylist(playlistId, trackIndex) {
    try {
        const res = await fetch(`/api/playlists/${playlistId}/tracks/${trackIndex}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            const idx = userLibrary.customPlaylists.findIndex(p => p.id === playlistId);
            if (idx > -1) userLibrary.customPlaylists[idx] = data.playlist;
            saveLocalLibrary();
            openCustomPlaylist(playlistId);
        }
    } catch (e) {}
}

// ==========================================
// 📚 LIBRARY RENDERING (Songs, Albums, Playlists, Custom)
// ==========================================

function switchLibraryTab(tab) {
    currentLibraryTab = tab;
    ['songs', 'albums', 'playlists', 'custom'].forEach(t => {
        const btn = document.getElementById(`libTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const container = document.getElementById(`lib${t.charAt(0).toUpperCase() + t.slice(1)}Container`);
        if (btn) {
            if (t === tab) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (container) {
            container.style.display = (t === tab) ? (t === 'songs' ? 'flex' : 'grid') : 'none';
        }
    });
    renderLibrary();
}

function renderLibrary() {
    updateLibraryCounters();
    if (currentLibraryTab === 'songs') renderLikedSongs();
    else if (currentLibraryTab === 'albums') renderLikedAlbums();
    else if (currentLibraryTab === 'playlists') renderLikedPlaylists();
    else if (currentLibraryTab === 'custom') renderCustomPlaylists();
}

function renderLikedSongs() {
    const container = document.getElementById('libSongsContainer');
    const tracks = userLibrary.likedTracks || [];

    if (tracks.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; width:100%; color:var(--text-muted);">
                <i class="fas fa-heart-broken" style="font-size:45px; margin-bottom:15px; opacity:0.5; color:var(--neon-pink)"></i>
                <p>No liked songs yet! Click the heart icon on any song to save it here.</p>
            </div>
        `;
        return;
    }

    currentPlaylist = tracks.map(t => ({ track: t.track, artist: t.artist, image: t.image || '' }));

    let html = '';
    tracks.forEach((item, index) => {
        const query = `${item.track} ${item.artist}`;
        const songImg = item.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
        html += `
            <div class="track-item">
                <div class="track-thumbnail-wrap" onclick="playTrackByIndex(${index})">
                    <img src="${songImg}" class="track-thumbnail-img" alt="${escapeHtml(item.track)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';">
                </div>
                <div class="track-info" onclick="playTrackByIndex(${index})">
                    <div class="track-name">${index + 1}. ${escapeHtml(item.track)}</div>
                    <div class="track-stats">
                        <i class="fas fa-microphone"></i> ${escapeHtml(item.artist)}
                    </div>
                </div>
                <div class="track-actions">
                    <i class="fas fa-heart" onclick="toggleTrackLike('${escapeHtml(item.track)}', '${escapeHtml(item.artist)}', '${escapeHtml(item.image || '')}'); event.stopPropagation();" style="color:var(--neon-pink); cursor:pointer; font-size:18px;" title="Remove from Liked"></i>
                    <i class="fas fa-plus" onclick="openAddToPlaylistModal('${escapeHtml(item.track)}', '${escapeHtml(item.artist)}', '${escapeHtml(item.image || '')}'); event.stopPropagation();" style="color:var(--text-muted); cursor:pointer; font-size:15px;" title="Add to Playlist"></i>
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="yt-link" title="Watch on YouTube">
                        <i class="fab fa-youtube"></i>
                    </a>
                    <div class="track-play" onclick="playTrackByIndex(${index})">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderLikedAlbums() {
    const container = document.getElementById('libAlbumsContainer');
    const albums = userLibrary.likedAlbums || [];
    const defaultImg = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60';

    if (albums.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; grid-column:1/-1; color:var(--text-muted);">
                <i class="fas fa-compact-disc" style="font-size:45px; margin-bottom:15px; opacity:0.5; color:var(--neon-cyan)"></i>
                <p>No saved albums yet! Explore or search albums and click "Save Album" to keep them here.</p>
            </div>
        `;
        return;
    }

    let html = '';
    albums.forEach(alb => {
        const img = alb.image || defaultImg;
        html += `
            <div class="collection-card" onclick="openAlbum('${alb.id}', '${escapeHtml(alb.title)}', '${escapeHtml(alb.artist)}', '${img}')">
                <div class="collection-cover-wrap">
                    <img src="${img}" class="collection-cover-img" alt="${escapeHtml(alb.title)}" onerror="this.onerror=null; this.src='${defaultImg}';">
                    <span class="collection-type-badge">Album</span>
                    <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                </div>
                <div class="collection-card-title">${escapeHtml(alb.title)}</div>
                <div class="collection-card-subtitle">${escapeHtml(alb.artist || 'Artist')}</div>
                <div class="collection-card-footer">
                    <span style="color:var(--neon-cyan)"><i class="fas fa-bookmark"></i> Saved</span>
                    <i class="fas fa-trash" onclick="toggleAlbumLike({id:'${alb.id}', title:'${escapeHtml(alb.title)}'}); event.stopPropagation();" style="cursor:pointer; color:var(--text-muted);" title="Remove"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderLikedPlaylists() {
    const container = document.getElementById('libPlaylistsContainer');
    const playlists = userLibrary.likedPlaylists || [];
    const defaultImg = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';

    if (playlists.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; grid-column:1/-1; color:var(--text-muted);">
                <i class="fas fa-list" style="font-size:45px; margin-bottom:15px; opacity:0.5; color:var(--neon-pink)"></i>
                <p>No saved playlists yet! Save curated playlists from Explore to find them here.</p>
            </div>
        `;
        return;
    }

    let html = '';
    playlists.forEach(pl => {
        const img = pl.image || defaultImg;
        html += `
            <div class="collection-card" onclick="openPlaylist('${pl.id}', '${escapeHtml(pl.title)}', '${img}')">
                <div class="collection-cover-wrap">
                    <img src="${img}" class="collection-cover-img" alt="${escapeHtml(pl.title)}" onerror="this.onerror=null; this.src='${defaultImg}';">
                    <span class="collection-type-badge" style="color:var(--neon-pink); border-color:rgba(255,8,68,0.3)">Playlist</span>
                    <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                </div>
                <div class="collection-card-title">${escapeHtml(pl.title)}</div>
                <div class="collection-card-subtitle">${pl.count ? `${pl.count} Songs` : 'Curated'}</div>
                <div class="collection-card-footer">
                    <span style="color:var(--neon-cyan)"><i class="fas fa-bookmark"></i> Saved</span>
                    <i class="fas fa-trash" onclick="togglePlaylistLike({id:'${pl.id}', title:'${escapeHtml(pl.title)}'}); event.stopPropagation();" style="cursor:pointer; color:var(--text-muted);" title="Remove"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderCustomPlaylists() {
    const container = document.getElementById('libCustomContainer');
    const playlists = userLibrary.customPlaylists || [];
    const defaultImg = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';

    if (playlists.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px; grid-column:1/-1; color:var(--text-muted);">
                <i class="fas fa-folder-plus" style="font-size:45px; margin-bottom:15px; opacity:0.5; color:var(--neon-cyan)"></i>
                <p>You haven't created any playlists yet.</p>
                <button class="search-btn" onclick="openCreatePlaylistModal()" style="margin-top:15px; border-radius:20px; padding:10px 24px;">
                    <i class="fas fa-plus"></i> Create Your First Playlist
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    playlists.forEach(pl => {
        const count = (pl.tracks || []).length;
        const img = pl.image || defaultImg;
        html += `
            <div class="collection-card" onclick="openCustomPlaylist('${pl.id}')">
                <div class="collection-cover-wrap">
                    <img src="${img}" class="collection-cover-img" alt="${escapeHtml(pl.name)}" onerror="this.onerror=null; this.src='${defaultImg}';">
                    <span class="collection-type-badge">Personal</span>
                    <div class="collection-hover-play"><i class="fas fa-play"></i></div>
                </div>
                <div class="collection-card-title">${escapeHtml(pl.name)}</div>
                <div class="collection-card-subtitle">${count} Tracks</div>
                <div class="collection-card-footer">
                    <span>${escapeHtml(pl.description || 'Custom Playlist')}</span>
                    <i class="fas fa-trash" onclick="deleteCustomPlaylist('${pl.id}'); event.stopPropagation();" style="cursor:pointer; color:var(--text-muted);" title="Delete Playlist"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ==========================================
// 🎵 AUDIO PLAYBACK ENGINE (JioSaavn + YouTube Fallback)
// ==========================================

let ytPlayer = null;
let ytPlayerReady = false;
let progressInterval = null;
let isDragging = false;
let currentPendingVideoId = null;
let activePlayerType = 'saavn';
let isChangingSong = false; // Guard: prevents ended/error events from firing during song transitions
const audioPlayer = new Audio();

function updateMediaSession(title, artist, artworkUrl) {
    if (title) {
        document.title = `▶ ${title} - ${artist || 'MelodySphere'}`;
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'MelodySphere',
            artist: artist || 'Ad-Free Music',
            album: 'MelodySphere Stream',
            artwork: artworkUrl ? [
                { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
                { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
                { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
                { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
                { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
            ] : []
        });

        navigator.mediaSession.playbackState = 'playing';

        try {
            navigator.mediaSession.setActionHandler('play', () => togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => togglePlay());
            navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
            navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    if (activePlayerType === 'saavn') {
                        audioPlayer.currentTime = details.seekTime;
                    } else if (activePlayerType === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
                        try { ytPlayer.seekTo(details.seekTime, true); } catch (e) {}
                    }
                }
            });
        } catch (e) {}
    }
}

audioPlayer.addEventListener('play', () => {
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.className = 'fas fa-pause';
    const eq = document.getElementById('equalizerWave');
    if (eq) eq.classList.remove('paused');
    if (currentSongMeta.track) document.title = `▶ ${currentSongMeta.track} - ${currentSongMeta.artist || 'MelodySphere'}`;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});

audioPlayer.addEventListener('pause', () => {
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.className = 'fas fa-play';
    const eq = document.getElementById('equalizerWave');
    if (eq) eq.classList.add('paused');
    if (currentSongMeta.track) document.title = `⏸ ${currentSongMeta.track} - ${currentSongMeta.artist || 'MelodySphere'}`;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

audioPlayer.addEventListener('ended', () => {
    if (isChangingSong) return; // Ignore during transitions
    if (sleepTimerMode === 'end-of-song') {
        finishSleepTimer();
        return;
    }
    playNext(true);
});

audioPlayer.addEventListener('error', async (e) => {
    if (isChangingSong) return; // Ignore spurious errors during song transitions
    const errCode = audioPlayer.error ? audioPlayer.error.code : 0;
    console.warn("Audio playback error (code " + errCode + "), retrying current song...", e);
    const titleElem = document.getElementById('playerTitle');
    const playBtn = document.getElementById('playPauseBtn');
    const eq = document.getElementById('equalizerWave');

    // Only retry if a song meta is available
    if (!currentSongMeta.track) return;

    titleElem.innerText = "Reconnecting...";

    // Try re-fetching the same song fresh (JioSaavn URL expires)
    try {
        const searchQuery = `${currentSongMeta.track} ${currentSongMeta.artist || ''}`.trim();
        const saavnRes = await fetch(`/api/saavn/search?q=${encodeURIComponent(searchQuery)}`);
        const saavnData = await saavnRes.json();
        if (saavnData.success && saavnData.streamUrl) {
            activePlayerType = 'saavn';
            audioPlayer.src = saavnData.streamUrl;
            currentSongMeta.streamUrl = saavnData.streamUrl;
            audioPlayer.play().catch(() => {});
            titleElem.innerText = currentSongMeta.track;
            return;
        }
    } catch (retryErr) {
        console.warn("Retry fetch failed:", retryErr);
    }

    // Retry failed → skip to next only if there are more songs
    titleElem.innerText = "Skipping...";
    if (playBtn) playBtn.className = 'fas fa-play';
    if (eq) eq.classList.add('paused');
    setTimeout(() => {
        if (!isChangingSong && currentTrackIndex >= 0 && currentPlaylist.length > 1) playNext();
    }, 800);
});


audioPlayer.addEventListener('timeupdate', () => {
    if (activePlayerType !== 'saavn' || isDragging) return;
    const current = audioPlayer.currentTime || 0;
    const duration = audioPlayer.duration || 0;
    
    document.getElementById('currentTime').innerText = formatTime(current);
    document.getElementById('totalTime').innerText = formatTime(duration);
    
    const bar = document.getElementById('progressBar');
    if (bar && duration > 0) {
        bar.max = duration;
        bar.value = current;
        updateSliderFill(bar, '#00f2fe');
    }
});

// Load YouTube API
if (!window.YT) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        document.head.appendChild(tag);
    }
}

window.onYouTubeIframeAPIReady = function() {
    ytPlayerReady = true;
    if (currentPendingVideoId) initOrLoadPlayer(currentPendingVideoId);
};

function initOrLoadPlayer(videoId) {
    if (!window.YT || !window.YT.Player) {
        currentPendingVideoId = videoId;
        return;
    }
    
    if (!ytPlayer) {
        ytPlayer = new YT.Player('youtubePlayer', {
            height: '200',
            width: '300',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'controls': 0,
                'disablekb': 1,
                'playsinline': 1,
                'enablejsapi': 1
            },
            events: {
                'onReady': (event) => {
                    ytPlayerReady = true;
                    try {
                        event.target.playVideo();
                        event.target.setVolume(parseInt(document.getElementById('volumeBar').value || 100));
                    } catch (e) {}
                },
                'onStateChange': onPlayerStateChange
            }
        });
    } else {
        if (typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
            try { ytPlayer.playVideo(); } catch (e) {}
        }
    }
}

function onPlayerStateChange(event) {
    if (activePlayerType !== 'youtube') return;
    const btn = document.getElementById('playPauseBtn');
    const eq = document.getElementById('equalizerWave');
    if (event.data === 1) {
        btn.className = 'fas fa-pause';
        if (eq) eq.classList.remove('paused');
        startProgressBar();
    } else if (event.data === 2) {
        btn.className = 'fas fa-play';
        if (eq) eq.classList.add('paused');
        stopProgressBar();
    } else if (event.data === 0) {
        btn.className = 'fas fa-play';
        if (eq) eq.classList.add('paused');
        stopProgressBar();
        if (sleepTimerMode === 'end-of-song') {
            finishSleepTimer();
            return;
        }
        playNext(true);
    } else if (event.data === 3) {
        btn.className = 'fas fa-pause';
    }
}

function togglePlay() {
    const eq = document.getElementById('equalizerWave');
    if (activePlayerType === 'saavn') {
        if (audioPlayer.paused) {
            audioPlayer.play().catch(e => console.error(e));
            document.getElementById('playPauseBtn').className = 'fas fa-pause';
            if (eq) eq.classList.remove('paused');
        } else {
            audioPlayer.pause();
            document.getElementById('playPauseBtn').className = 'fas fa-play';
            if (eq) eq.classList.add('paused');
        }
        return;
    }

    if (!ytPlayer) return;
    try {
        const state = typeof ytPlayer.getPlayerState === 'function' ? ytPlayer.getPlayerState() : -1;
        if (state === 1 || state === 3) {
            if (typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
            document.getElementById('playPauseBtn').className = 'fas fa-play';
            if (eq) eq.classList.add('paused');
        } else {
            if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
            document.getElementById('playPauseBtn').className = 'fas fa-pause';
            if (eq) eq.classList.remove('paused');
        }
    } catch (e) {}
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function updateSliderFill(slider, color = '#00f2fe') {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const percentage = max > min ? Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100)) : 0;
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, rgba(255, 255, 255, 0.2) ${percentage}%, rgba(255, 255, 255, 0.2) 100%)`;
}

function startProgressBar() {
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        if (activePlayerType !== 'youtube') return;
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function' || isDragging) return;
        try {
            const current = ytPlayer.getCurrentTime() || 0;
            const duration = ytPlayer.getDuration() || 0;
            document.getElementById('currentTime').innerText = formatTime(current);
            document.getElementById('totalTime').innerText = formatTime(duration);
            const bar = document.getElementById('progressBar');
            if (duration > 0) {
                bar.max = duration;
                bar.value = current;
                updateSliderFill(bar, '#00f2fe');
            }
        } catch (e) {}
    }, 500);
}

function stopProgressBar() {
    if (progressInterval) clearInterval(progressInterval);
}

function seekVideo(isInput = false) {
    const bar = document.getElementById('progressBar');
    if (!bar) return;
    updateSliderFill(bar, '#00f2fe');
    const targetTime = parseFloat(bar.value);
    
    if (bar.max > 0) {
        document.getElementById('currentTime').innerText = formatTime(targetTime);
    }

    if (activePlayerType === 'saavn') {
        if (!isInput && !isNaN(targetTime)) {
            audioPlayer.currentTime = targetTime;
        }
    } else if (activePlayerType === 'youtube') {
        if (!isInput && ytPlayer && typeof ytPlayer.seekTo === 'function') {
            try { ytPlayer.seekTo(targetTime, true); } catch (e) {}
        }
    }
}

let isMuted = false;
let previousVolume = 100;

function changeVolume() {
    const bar = document.getElementById('volumeBar');
    const icon = document.getElementById('volumeIcon');
    const vol = parseInt(bar.value);
    
    updateSliderFill(bar, '#00f2fe');
    audioPlayer.volume = vol / 100;
    if (isMuted && vol > 0) {
        audioPlayer.muted = false;
        isMuted = false;
    }
    
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
        try {
            ytPlayer.setVolume(vol);
            if (isMuted && vol > 0 && typeof ytPlayer.unMute === 'function') {
                ytPlayer.unMute();
                isMuted = false;
            }
        } catch (e) {}
    }
    
    if (vol === 0) icon.className = 'fas fa-volume-mute';
    else if (vol < 50) icon.className = 'fas fa-volume-down';
    else icon.className = 'fas fa-volume-up';
}

function toggleMute() {
    const bar = document.getElementById('volumeBar');
    const icon = document.getElementById('volumeIcon');
    
    if (isMuted) {
        audioPlayer.muted = false;
        audioPlayer.volume = (previousVolume > 0 ? previousVolume : 100) / 100;
        if (ytPlayer && typeof ytPlayer.unMute === 'function') {
            try {
                ytPlayer.unMute();
                ytPlayer.setVolume(previousVolume > 0 ? previousVolume : 100);
            } catch (e) {}
        }
        isMuted = false;
        bar.value = previousVolume > 0 ? previousVolume : 100;
        icon.className = bar.value < 50 ? 'fas fa-volume-down' : 'fas fa-volume-up';
    } else {
        previousVolume = parseInt(bar.value);
        audioPlayer.muted = true;
        if (ytPlayer && typeof ytPlayer.mute === 'function') {
            try { ytPlayer.mute(); } catch (e) {}
        }
        isMuted = true;
        bar.value = 0;
        icon.className = 'fas fa-volume-mute';
    }
    updateSliderFill(bar, '#00f2fe');
}

function playTrackByIndex(index) {
    if (index >= 0 && index < currentPlaylist.length) {
        const item = currentPlaylist[index];
        playMusic(item.track, item.artist, index, item.image || '');
    }
}

function playNext(autoEnded = false) {
    if (currentPlaylist.length === 0 || currentTrackIndex === -1) return;

    // 1. Repeat One Mode (loop current track if finished automatically)
    if (autoEnded && repeatMode === 'one') {
        if (activePlayerType === 'saavn') {
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(() => {});
            return;
        } else if (activePlayerType === 'youtube' && ytPlayer && typeof ytPlayer.seekTo === 'function') {
            try {
                ytPlayer.seekTo(0);
                ytPlayer.playVideo();
                return;
            } catch (e) {}
        }
    }

    // Record history for Previous button
    if (currentTrackIndex >= 0) {
        playbackHistory.push(currentTrackIndex);
        if (playbackHistory.length > 50) playbackHistory.shift();
    }

    // 2. Shuffle Mode
    if (isShuffle && currentPlaylist.length > 1) {
        if (unplayedShuffleIndices.length === 0) {
            unplayedShuffleIndices = currentPlaylist.map((_, i) => i).filter(i => i !== currentTrackIndex);
        }
        if (unplayedShuffleIndices.length === 0) {
            playTrackByIndex(currentTrackIndex);
            return;
        }
        const randomPick = Math.floor(Math.random() * unplayedShuffleIndices.length);
        const nextIndex = unplayedShuffleIndices.splice(randomPick, 1)[0];
        playTrackByIndex(nextIndex);
        return;
    }

    // 3. Normal Sequential Mode
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= currentPlaylist.length) {
        if (autoEnded && repeatMode === 'off') {
            // End of playlist reached and repeat is off: stop playback
            if (activePlayerType === 'saavn') audioPlayer.pause();
            const btn = document.getElementById('playPauseBtn');
            if (btn) btn.className = 'fas fa-play';
            const eq = document.getElementById('equalizerWave');
            if (eq) eq.classList.add('paused');
            return;
        }
        nextIndex = 0; // Wrap back to first track on Repeat All or manual next
    }
    playTrackByIndex(nextIndex);
}

function playPrevious() {
    if (currentPlaylist.length === 0 || currentTrackIndex === -1) return;

    // Standard player behavior: If track has played > 3 seconds, restart current track
    let currentSec = 0;
    if (activePlayerType === 'saavn') {
        currentSec = audioPlayer.currentTime || 0;
    } else if (activePlayerType === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        try { currentSec = ytPlayer.getCurrentTime() || 0; } catch (e) {}
    }
    if (currentSec > 3) {
        if (activePlayerType === 'saavn') {
            audioPlayer.currentTime = 0;
        } else if (activePlayerType === 'youtube' && ytPlayer) {
            try { ytPlayer.seekTo(0); } catch (e) {}
        }
        return;
    }

    // Pop from playback history if available
    if (playbackHistory.length > 0) {
        const prevIndex = playbackHistory.pop();
        playTrackByIndex(prevIndex);
        return;
    }

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = currentPlaylist.length - 1;
    playTrackByIndex(prevIndex);
}

async function playMusic(track, artist, index = -1, preloadedImage = '') {
    currentTrackIndex = index;
    const player = document.getElementById('playerContainer');
    const titleElem = document.getElementById('playerTitle');
    const artistElem = document.getElementById('playerArtist');
    const thumbElem = document.getElementById('playerThumbnail');
    const iconElem = document.getElementById('playerDefaultIcon');
    const playBtn = document.getElementById('playPauseBtn');
    const eq = document.getElementById('equalizerWave');
    const downloadBtn = document.getElementById('downloadBtn');
    
    currentSongMeta = { track, artist, image: preloadedImage || '', id: '', hasLyrics: false, streamUrl: '' };
    updatePlayerLikeBtn();
    
    titleElem.innerText = track || "Finding Song...";
    artistElem.innerText = artist || "";
    player.style.display = 'block';
    
    if (preloadedImage) {
        thumbElem.src = preloadedImage;
        thumbElem.style.display = 'block';
        iconElem.style.display = 'none';
        applyDynamicAmbientGlow(preloadedImage, track, artist);
    } else {
        thumbElem.style.display = 'none';
        iconElem.style.display = 'block';
    }

    if (playBtn) playBtn.className = 'fas fa-pause';
    if (eq) eq.classList.remove('paused');
    if (downloadBtn) downloadBtn.style.display = 'none';
    
    const bar = document.getElementById('progressBar');
    if (bar) {
        bar.value = 0;
        updateSliderFill(bar, '#00f2fe');
    }
    
    // Guard flag: prevent ended/error events from triggering during song transitions
    isChangingSong = true;
    audioPlayer.pause();
    audioPlayer.src = "";
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
        try { ytPlayer.stopVideo(); } catch (e) {}
    }
    // Allow a brief moment for events to settle, then release the guard
    setTimeout(() => { isChangingSong = false; }, 300);
    
    const searchQuery = `${track} ${artist || ''}`.trim();
    
    // Step 1: JioSaavn Ad-Free 320kbps Stream
    try {
        const saavnRes = await fetch(`/api/saavn/search?q=${encodeURIComponent(searchQuery)}`);
        const saavnData = await saavnRes.json();
        
        if (saavnData.success && saavnData.streamUrl) {
            activePlayerType = 'saavn';
            titleElem.innerText = saavnData.title || track;
            artistElem.innerText = saavnData.artist || artist || "";
            
            // Prefer preloaded album/collection image if supplied, else use saavnData.image
            const chosenImage = preloadedImage || saavnData.image || '';
            
            currentSongMeta.id = saavnData.id || '';
            currentSongMeta.hasLyrics = !!saavnData.has_lyrics;
            currentSongMeta.image = chosenImage;
            currentSongMeta.streamUrl = saavnData.streamUrl;
            
            if (chosenImage) {
                thumbElem.src = chosenImage;
                thumbElem.style.display = 'block';
                iconElem.style.display = 'none';
                applyDynamicAmbientGlow(chosenImage, saavnData.title || track, saavnData.artist || artist);
            } else {
                applyDynamicAmbientGlow(null, saavnData.title || track, saavnData.artist || artist);
            }
            
            if (downloadBtn) {
                downloadBtn.href = saavnData.streamUrl;
                downloadBtn.setAttribute('download', `${saavnData.title || track} - ${saavnData.artist || artist}.mp4`);
                downloadBtn.style.display = 'inline-flex';
            }
            
            audioPlayer.src = saavnData.streamUrl;
            isChangingSong = false; // New song is loaded, events are now valid again
            audioPlayer.volume = parseInt(document.getElementById('volumeBar').value || 100) / 100;
            audioPlayer.play().catch(err => {
                console.warn("Autoplay blocked, user interaction required:", err);
            });
            
            updateMediaSession(saavnData.title || track, saavnData.artist || artist || "", chosenImage);
            updatePlayerLikeBtn();
            if (window.innerWidth < 768) player.scrollIntoView({ behavior: 'smooth' });
            return;
        }
    } catch (saavnErr) {}
    
    // Step 2: YouTube fallback
    const ytQuery = `${track} ${artist || ''} official audio`.trim();
    try {
        const response = await fetch(`/api/yt/search?q=${encodeURIComponent(ytQuery)}`);
        const data = await response.json();
        
        if (data.success && data.videoId) {
            activePlayerType = 'youtube';
            titleElem.innerText = track;
            artistElem.innerText = artist || "";
            
            const ytImg = preloadedImage || `https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg`;
            currentSongMeta.image = ytImg;
            thumbElem.src = ytImg;
            thumbElem.style.display = 'block';
            iconElem.style.display = 'none';
            applyDynamicAmbientGlow(ytImg, track, artist);
            
            isChangingSong = false; // New song loaded via YouTube
            updateMediaSession(track, artist || "", ytImg);
            initOrLoadPlayer(data.videoId);
        } else {
            isChangingSong = false;
            titleElem.innerText = "Track not found";
            if (playBtn) playBtn.className = 'fas fa-play';
            if (eq) eq.classList.add('paused');
        }
    } catch (err) {
        isChangingSong = false;
        titleElem.innerText = "Connection Error";
        if (playBtn) playBtn.className = 'fas fa-play';
        if (eq) eq.classList.add('paused');
    }

    if (window.innerWidth < 768) player.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// 📜 LYRICS DRAWER
// ==========================================

async function openLyrics() {
    const modal = document.getElementById('lyricsModal');
    const title = document.getElementById('lyricsTitle');
    const artist = document.getElementById('lyricsArtist');
    const body = document.getElementById('lyricsBody');
    
    if (!currentSongMeta.track) {
        alert("Please play a song first to view lyrics!");
        return;
    }
    
    title.innerText = currentSongMeta.track;
    artist.innerText = currentSongMeta.artist || "Lyrics";
    body.innerHTML = `
        <div class="loading" style="display:block; padding:30px;">
            <div class="spinner" style="width:40px; height:40px;"></div>
            <p style="margin-top:10px;">Fetching lyrics...</p>
        </div>
    `;
    modal.style.display = 'flex';
    
    try {
        const queryParams = new URLSearchParams({
            id: currentSongMeta.id || '',
            track: currentSongMeta.track || '',
            artist: currentSongMeta.artist || ''
        });
        
        const lRes = await fetch(`/api/saavn/lyrics?${queryParams.toString()}`);
        const lData = await lRes.json();
        
        if (lData.success && lData.lyrics) {
            body.innerHTML = `
                <div style="font-size:16px; line-height:2.2; color:#fff; text-align:center; padding:10px 0;">
                    ${lData.lyrics}
                </div>
            `;
        } else {
            body.innerHTML = `<p style="color:var(--text-muted); padding:30px; text-align:center;">Lyrics not available for this song.</p>`;
        }
    } catch(err) {
        body.innerHTML = `<p style="color:var(--text-muted); padding:30px; text-align:center;">Could not load lyrics. Please try again.</p>`;
    }
}

function closeLyrics() {
    document.getElementById('lyricsModal').style.display = 'none';
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    const eq = document.getElementById('equalizerWave');
    if (eq) eq.classList.add('paused');
    audioPlayer.pause();
    audioPlayer.src = "";
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
        try { ytPlayer.stopVideo(); } catch (e) {}
    }
    player.style.display = 'none';
    stopProgressBar();
}

function toggleBio() {
    const bio = document.getElementById('artistBio');
    const btn = document.getElementById('readMoreBtn');
    if (bio.classList.contains('collapsed')) {
        bio.classList.remove('collapsed');
        btn.innerText = 'Read Less';
    } else {
        bio.classList.add('collapsed');
        btn.innerText = 'Read More';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function formatNumber(num) {
    if (!num || num == 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function displayError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-sad-tear" style="font-size: 60px;"></i>
            <h3 style="margin: 20px 0;">Oops!</h3>
            <p>${escapeHtml(message)}</p>
            <p style="margin-top: 20px;">Try searching for another artist, track, album, or playlist!</p>
        </div>
    `;
    resultsDiv.style.display = 'block';
}

// ==========================================
// 🎤 VOICE SEARCH & AUDIO FINGERPRINTING
// ==========================================

function initVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    }

    window.startVoiceSearch = async (inputId) => {
        const input = document.getElementById(inputId);
        const micBtn = input.nextElementSibling;
        let speechDetected = false;
        let mediaRecorder = null;
        let stream = null;
        
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            const audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", async () => {
                if (speechDetected) {
                   stream.getTracks().forEach(track => track.stop());
                   return;
                }

                micBtn.classList.remove('listening');
                micBtn.style.color = '#e0a800'; 
                micBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    let base64data = reader.result;
                    base64data = base64data.split(',')[1];
                    
                    try {
                        const response = await fetch('/api/recognize', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ audioData: base64data })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            switchTab('track');
                            document.getElementById('trackInput').value = data.title;
                            document.getElementById('trackArtistInput').value = data.artist;
                            searchTrack(); 
                        } else {
                            alert(data.error || "Song not recognized. Please move closer to speaker.");
                        }
                    } catch (err) {
                        alert("Error contacting recognition service.");
                    } finally {
                        micBtn.style.color = '';
                        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                        stream.getTracks().forEach(track => track.stop());
                    }
                };
            });

            if (recognition) {
                recognition.onresult = (event) => {
                    speechDetected = true;
                    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                    
                    const transcript = event.results[0][0].transcript;
                    input.value = transcript;
                    
                    micBtn.classList.remove('listening');
                    micBtn.style.color = '';
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';

                    if (inputId === 'artistInput') searchArtist();
                    else if (inputId === 'trackInput') searchTrack();
                    else if (inputId === 'albumInput') searchAlbums();
                    else if (inputId === 'playlistInput') searchPlaylists();
                };
                
                try { recognition.start(); } catch(e) {}
            }

            mediaRecorder.start(1000);
            micBtn.classList.add('listening');
            
            setTimeout(() => {
                if (!speechDetected && mediaRecorder.state === 'recording') {
                    if (recognition) {
                        try { recognition.stop(); } catch(e){}
                    }
                    mediaRecorder.stop();
                }
            }, 6000);

        } catch (error) {
            console.error('Error:', error);
            alert("Could not access microphone.");
        }
    };
}

// ==========================================
// 📲 PWA INSTALLATION & SERVICE WORKER
// ==========================================
let deferredPwaPrompt = null;

function isAppRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Browser fires this ONLY when the app is NOT installed (or after uninstall)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (!isAppRunningStandalone()) {
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    }
});

// Browser fires this immediately when user installs the app
window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.style.display = 'none';
    console.log('[PWA] MelodySphere was installed successfully!');
});

async function installPWA() {
    if (!deferredPwaPrompt) {
        alert('To install MelodySphere, tap your browser menu (three dots ⋮) and select "Install app" or "Add to Home screen".');
        return;
    }
    deferredPwaPrompt.prompt();
    const { outcome } = await deferredPwaPrompt.userChoice;
    console.log(`[PWA] Install prompt result: ${outcome}`);
    if (outcome === 'accepted') {
        const installBtn = document.getElementById('pwaInstallBtn');
        if (installBtn) installBtn.style.display = 'none';
    }
    deferredPwaPrompt = null;
}



// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((reg) => {
                console.log('[PWA] Service Worker registered with scope:', reg.scope);
            })
            .catch((err) => {
                console.warn('[PWA] Service Worker registration failed:', err);
            });
    });
}

// ==========================================
// 🔀 SHUFFLE & REPEAT PLAYBACK CONTROLS
// ==========================================

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('shuffleBtn');
    if (btn) {
        if (isShuffle) {
            btn.classList.add('active');
            btn.setAttribute('title', 'Shuffle On (S)');
            showToast('Shuffle ON', 'fa-random');
            if (currentPlaylist.length > 0) {
                unplayedShuffleIndices = currentPlaylist.map((_, i) => i).filter(i => i !== currentTrackIndex);
            }
        } else {
            btn.classList.remove('active');
            btn.setAttribute('title', 'Shuffle Off (S)');
            showToast('Shuffle OFF', 'fa-random');
            unplayedShuffleIndices = [];
        }
    }
}

function toggleRepeat() {
    const btn = document.getElementById('repeatBtn');
    const badge = document.getElementById('repeatBadge');
    
    if (repeatMode === 'off') {
        repeatMode = 'all';
        if (btn) btn.classList.add('active');
        if (badge) badge.style.display = 'none';
        showToast('Repeat: All tracks', 'fa-redo');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        if (btn) btn.classList.add('active');
        if (badge) badge.style.display = 'flex';
        showToast('Repeat: Current song', 'fa-redo');
    } else {
        repeatMode = 'off';
        if (btn) btn.classList.remove('active');
        if (badge) badge.style.display = 'none';
        showToast('Repeat OFF', 'fa-redo');
    }
}

// ==========================================
// 🎨 DYNAMIC AMBIENT ALBUM GLOW
// ==========================================

const AMBIENT_PALETTES = [
    { r: 0, g: 242, b: 254 },    // Electric Cyan
    { r: 255, g: 8, b: 68 },     // Neon Pink/Rose
    { r: 255, g: 126, b: 40 },   // Radiant Amber
    { r: 168, g: 85, b: 247 },   // Cyber Purple
    { r: 16, g: 217, b: 140 },   // Emerald Mint
    { r: 236, g: 72, b: 153 },   // Hot Magenta
    { r: 59, g: 130, b: 246 },   // Cobalt Blue
    { r: 245, g: 158, b: 11 },   // Golden Sunset
    { r: 20, g: 184, b: 166 },   // Deep Teal
    { r: 192, g: 132, b: 252 }   // Lavender Violet
];

function getHarmonicColor(title = '', artist = '') {
    const combined = `${title}-${artist}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % AMBIENT_PALETTES.length;
    return AMBIENT_PALETTES[idx];
}

function setAmbientTheme(r, g, b) {
    const root = document.documentElement;
    root.style.setProperty('--ambient-r', r);
    root.style.setProperty('--ambient-g', g);
    root.style.setProperty('--ambient-b', b);
    root.style.setProperty('--ambient-color', `rgb(${r}, ${g}, ${b})`);
    root.style.setProperty('--ambient-glow', `rgba(${r}, ${g}, ${b}, 0.45)`);

    const player = document.getElementById('playerContainer');
    if (player) {
        player.style.boxShadow = `0 -14px 55px rgba(${r}, ${g}, ${b}, 0.38), 0 -1px 0 rgba(${r}, ${g}, ${b}, 0.3)`;
        player.style.borderTopColor = `rgba(${r}, ${g}, ${b}, 0.38)`;
    }

    const iconWrap = document.getElementById('nowPlayingIconWrap');
    if (iconWrap) {
        iconWrap.style.boxShadow = `0 0 24px rgba(${r}, ${g}, ${b}, 0.5)`;
        iconWrap.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.45)`;
    }

    // Dynamic wave bars tint
    const waves = document.querySelectorAll('#equalizerWave span');
    waves.forEach(w => {
        w.style.background = `rgb(${r}, ${g}, ${b})`;
        w.style.boxShadow = `0 0 8px rgba(${r}, ${g}, ${b}, 0.7)`;
    });
}

function applyDynamicAmbientGlow(imgSrc, title, artist) {
    if (!imgSrc) {
        const c = getHarmonicColor(title, artist);
        setAmbientTheme(c.r, c.g, c.b);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;

    img.onload = function() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 20;
            canvas.height = 20;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 20, 20);

            const imgData = ctx.getImageData(0, 0, 20, 20).data;
            let rTotal = 0, gTotal = 0, bTotal = 0, validPixels = 0;

            for (let i = 0; i < imgData.length; i += 4) {
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];
                const lum = (r * 299 + g * 587 + b * 114) / 1000;

                if (lum > 35 && lum < 225) {
                    rTotal += r;
                    gTotal += g;
                    bTotal += b;
                    validPixels++;
                }
            }

            if (validPixels > 0) {
                const avgR = Math.round(rTotal / validPixels);
                const avgG = Math.round(gTotal / validPixels);
                const avgB = Math.round(bTotal / validPixels);
                setAmbientTheme(avgR, avgG, avgB);
            } else {
                const c = getHarmonicColor(title, artist);
                setAmbientTheme(c.r, c.g, c.b);
            }
        } catch (e) {
            // Safe fallback if canvas is tainted by CORS
            const c = getHarmonicColor(title, artist);
            setAmbientTheme(c.r, c.g, c.b);
        }
    };

    img.onerror = function() {
        const c = getHarmonicColor(title, artist);
        setAmbientTheme(c.r, c.g, c.b);
    };
}

// ==========================================
// 🌙 SLEEP TIMER IMPLEMENTATION
// ==========================================

function openSleepTimerModal() {
    const modal = document.getElementById('sleepTimerModal');
    if (modal) modal.style.display = 'flex';
    updateSleepTimerUI();
}

function closeSleepTimerModal() {
    const modal = document.getElementById('sleepTimerModal');
    if (modal) modal.style.display = 'none';
}

function setSleepTimer(minutesOrMode) {
    if (minutesOrMode === 'end-of-song') {
        if (!currentSongMeta.track) {
            showToast('Please play a song first', 'fa-exclamation-circle');
            return;
        }
        clearInterval(sleepTimerInterval);
        sleepTimerMode = 'end-of-song';
        sleepTimerEndTime = null;
        isSleepFading = false;
        
        updateSleepTimerUI();
        closeSleepTimerModal();
        showToast('Audio will stop after this song', 'fa-moon');
        return;
    }

    const mins = parseInt(minutesOrMode);
    if (isNaN(mins) || mins <= 0) return;

    clearInterval(sleepTimerInterval);
    sleepTimerMode = 'minutes';
    sleepTimerEndTime = Date.now() + mins * 60 * 1000;
    isSleepFading = false;
    sleepOriginalVolume = null;

    updateSleepTimerUI();
    closeSleepTimerModal();
    showToast(`Sleep timer set for ${mins} mins`, 'fa-moon');

    sleepTimerInterval = setInterval(() => {
        if (!sleepTimerEndTime) return;
        const remaining = sleepTimerEndTime - Date.now();
        if (remaining <= 0) {
            finishSleepTimer();
        } else {
            // If <= 15s remaining, smoothly fade out volume
            if (remaining <= 15000 && !isSleepFading) {
                isSleepFading = true;
                fadeOutAudioForSleep(remaining);
            }
            updateSleepTimerUI();
        }
    }, 1000);
}

function setCustomSleepTimer() {
    const input = document.getElementById('customSleepInput');
    if (!input) return;
    const mins = parseInt(input.value);
    if (!mins || mins < 1 || mins > 360) {
        showToast('Enter minutes between 1 and 360', 'fa-exclamation-circle');
        return;
    }
    setSleepTimer(mins);
    input.value = '';
}

function cancelSleepTimer() {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    sleepTimerEndTime = null;
    sleepTimerMode = null;
    isSleepFading = false;

    // Restore volume if cancelled during fade
    if (sleepOriginalVolume !== null) {
        if (activePlayerType === 'saavn') audioPlayer.volume = sleepOriginalVolume;
        const vBar = document.getElementById('volumeBar');
        if (vBar) vBar.value = Math.round(sleepOriginalVolume * 100);
        sleepOriginalVolume = null;
    }

    updateSleepTimerUI();
    showToast('Sleep timer turned OFF', 'fa-moon');
}

function fadeOutAudioForSleep(totalRemainingMs) {
    if (sleepOriginalVolume === null) {
        sleepOriginalVolume = activePlayerType === 'saavn' ? audioPlayer.volume : 1;
    }
    const fadeSteps = 15;
    const stepInterval = Math.max(200, Math.floor(totalRemainingMs / fadeSteps));
    let step = 0;

    const fadeTimer = setInterval(() => {
        if (!sleepTimerMode) {
            clearInterval(fadeTimer);
            return;
        }
        step++;
        const factor = Math.max(0, 1 - (step / fadeSteps));
        const newVol = (sleepOriginalVolume || 1) * factor;

        if (activePlayerType === 'saavn') {
            audioPlayer.volume = Math.max(0, newVol);
        } else if (activePlayerType === 'youtube' && ytPlayer && typeof ytPlayer.setVolume === 'function') {
            try { ytPlayer.setVolume(Math.round(newVol * 100)); } catch (e) {}
        }

        if (step >= fadeSteps) {
            clearInterval(fadeTimer);
        }
    }, stepInterval);
}

function finishSleepTimer() {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    sleepTimerEndTime = null;
    sleepTimerMode = null;
    isSleepFading = false;

    // Pause audio
    if (activePlayerType === 'saavn') {
        audioPlayer.pause();
        if (sleepOriginalVolume !== null) {
            audioPlayer.volume = sleepOriginalVolume;
        }
    } else if (activePlayerType === 'youtube' && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        try { ytPlayer.pauseVideo(); } catch (e) {}
    }

    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.className = 'fas fa-play';
    const eq = document.getElementById('equalizerWave');
    if (eq) eq.classList.add('paused');

    updateSleepTimerUI();
    showToast('Sleep timer ended. Goodnight! 🌙', 'fa-moon');
}

function updateSleepTimerUI() {
    const sleepBtn = document.getElementById('sleepTimerBtn');
    const sleepDot = document.getElementById('sleepActiveDot');
    const banner = document.getElementById('sleepActiveBanner');
    const countdown = document.getElementById('sleepCountdownDisplay');
    const subhead = document.getElementById('sleepTimerSubhead');

    if (!sleepTimerMode) {
        if (sleepBtn) sleepBtn.classList.remove('active');
        if (sleepDot) sleepDot.style.display = 'none';
        if (banner) banner.style.display = 'none';
        if (subhead) subhead.innerText = 'Turn off music automatically';
        return;
    }

    if (sleepBtn) sleepBtn.classList.add('active');
    if (sleepDot) sleepDot.style.display = 'block';

    if (sleepTimerMode === 'end-of-song') {
        if (banner) banner.style.display = 'flex';
        if (countdown) countdown.innerText = 'End of Song';
        if (subhead) subhead.innerText = 'Stopping after current track';
    } else if (sleepTimerMode === 'minutes' && sleepTimerEndTime) {
        const remainingSec = Math.max(0, Math.floor((sleepTimerEndTime - Date.now()) / 1000));
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (banner) banner.style.display = 'flex';
        if (countdown) countdown.innerText = timeFormatted;
        if (subhead) subhead.innerText = `Stopping in ${timeFormatted}`;
    }
}

// ==========================================
// 🍞 SLEEK FLOATING TOAST NOTIFICATION
// ==========================================

function showToast(message, icon = 'fa-info-circle') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-leave');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 2400);
}

