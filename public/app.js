/**
 * MelodySphere - Frontend Logic
 * Includes: Search, Charts, Voice Search, and Music Player
 */

let currentView = 'search';

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Enter key support
    document.getElementById('artistInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchArtist();
    });
    
    document.getElementById('trackInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTrack();
    });
    
    document.getElementById('trackArtistInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTrack();
    });

    // Auto-search on page load
    setTimeout(() => {
        if (currentView === 'search') searchArtist();
    }, 500);

    // Initialize Voice Search
    initVoiceSearch();
});

function showSearch() {
    currentView = 'search';
    document.getElementById('searchView').style.display = 'block';
    document.getElementById('chartsView').style.display = 'none';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    // Use currentTarget or specific finding logic since this is called from inline onclick often
    const btn = document.querySelector('.nav-btn:first-child');
    if (btn) btn.classList.add('active');
    document.getElementById('results').style.display = 'none';
}

async function showCharts() {
    currentView = 'charts';
    document.getElementById('searchView').style.display = 'none';
    document.getElementById('chartsView').style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector('.nav-btn:nth-child(2)');
    if (btn) btn.classList.add('active');
    
    await loadCharts();
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
    searchArtist();
}

function switchTab(tab) {
    const artistSearch = document.getElementById('artistSearch');
    const trackSearch = document.getElementById('trackSearch');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tab === 'artist') {
        artistSearch.style.display = 'block';
        trackSearch.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        artistSearch.style.display = 'none';
        trackSearch.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
    
    document.getElementById('results').style.display = 'none';
}

async function searchArtist() {
    const query = document.getElementById('artistInput').value.trim();
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
        displayError('Failed to fetch data. Please try again.');
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
        if (artist) {
            url += `&artist=${encodeURIComponent(artist)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.results && data.results.length > 0) {
            displayTrackResults(data.results);
        } else {
            displayError('No tracks found');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to fetch data. Please try again.');
    }
    
    showLoading(false);
}

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
            html += `
                <div class="track-item">
                    <div class="track-info" onclick="playMusic('${escapeHtml(track.name)}', '${escapeHtml(artistName)}')">
                        <div class="track-name">${index + 1}. ${escapeHtml(track.name)}</div>
                        <div class="track-stats">
                            <i class="fas fa-users"></i> ${formatNumber(track.listeners)} listeners | 
                            <i class="fas fa-play"></i> ${formatNumber(track.playcount)} plays
                        </div>
                    </div>
                    <div class="track-actions">
                        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="yt-link" title="Watch on YouTube">
                            <i class="fab fa-youtube"></i>
                        </a>
                        <div class="track-play" onclick="playMusic('${escapeHtml(track.name)}', '${escapeHtml(artistName)}')">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    // Top Albums Section
    if (albums && albums.length > 0) {
        html += `
            <div class="music-section">
                <div class="section-header">
                    <div class="section-title"><i class="fas fa-compact-disc"></i> Top Albums</div>
                </div>
                <div class="albums-grid">
        `;
        
        albums.forEach(album => {
            html += `
                <div class="album-card" onclick="window.open('${album.url}', '_blank')">
                    <div class="album-cover">
                        ${album.image ? `<img src="${album.image}" alt="${album.name}" onerror="this.src='https://via.placeholder.com/300?text=Album'">` : '💿'}
                    </div>
                    <div class="album-name">${escapeHtml(album.name)}</div>
                    <div style="font-size: 12px; color: #666;">${formatNumber(album.playcount)} plays</div>
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
    
    let html = `
        <div class="music-section">
            <div class="section-header">
                <div class="section-title"><i class="fas fa-music"></i> Track Results (${tracks.length} found)</div>
            </div>
            <div class="track-results-grid">
    `;
    
    tracks.slice(0, 30).forEach((track, index) => {
        const query = `${track.name} ${track.artist}`;
        html += `
            <div class="track-item">
                <div class="track-info" onclick="playMusic('${escapeHtml(track.name)}', '${escapeHtml(track.artist)}')">
                    <div class="track-name">${index + 1}. ${escapeHtml(track.name)}</div>
                    <div class="track-stats">
                        <i class="fas fa-microphone"></i> ${escapeHtml(track.artist)} | 
                        <i class="fas fa-users"></i> ${formatNumber(track.listeners)} listeners
                    </div>
                </div>
                <div class="track-actions">
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query)}" target="_blank" class="yt-link" title="Watch on YouTube">
                        <i class="fab fa-youtube"></i>
                    </a>
                    <div class="track-play" onclick="playMusic('${escapeHtml(track.name)}', '${escapeHtml(track.artist)}')">
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

function displayError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="error-message">
            <i class="fas fa-sad-tear" style="font-size: 60px;"></i>
            <h3 style="margin: 20px 0;">Oops!</h3>
            <p>${escapeHtml(message)}</p>
            <p style="margin-top: 20px;">Try searching for another artist or track!</p>
        </div>
    `;
    resultsDiv.style.display = 'block';
}

async function playMusic(track, artist) {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('youtubePlayer');
    const titleElem = document.getElementById('playerTitle');
    const artistElem = document.getElementById('playerArtist');
    
    titleElem.innerText = "Finding Song...";
    artistElem.innerText = track;
    player.style.display = 'block';
    iframe.src = ""; 
    
    const query = `${track} ${artist} official audio`;
    
    try {
        const response = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success && data.videoId) {
            iframe.src = `https://www.youtube.com/embed/${data.videoId}?autoplay=1`;
            titleElem.innerText = track;
            artistElem.innerText = artist;
        } else {
            titleElem.innerText = "Error: Video not found";
            iframe.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
        }
    } catch (err) {
        console.error("YT Proxy Error:", err);
        titleElem.innerText = "Connection Error";
        iframe.src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
    }
    
    if (window.innerWidth < 768) {
        player.scrollIntoView({ behavior: 'smooth' });
    }
}

function closePlayer() {
    const player = document.getElementById('playerContainer');
    const iframe = document.getElementById('youtubePlayer');
    iframe.src = "";
    player.style.display = 'none';
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

function initVoiceSearch() {
    // Initialize standard speech recognition
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
                // If speech recognition already worked, ignore Shazam
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
                            if (inputId === 'trackInput' || inputId === 'artistInput') {
                                switchTab('track');
                                document.getElementById('trackInput').value = data.title;
                                document.getElementById('trackArtistInput').value = data.artist;
                                searchTrack(); 
                            }
                        } else {
                            alert(data.error || "Song not recognized. Please move closer to the music.");
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

            // Run Speech Recognition simultaneously for speaking/singing
            if (recognition) {
                recognition.onresult = (event) => {
                    speechDetected = true;
                    // Stop Shazam recording immediately
                    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                    
                    const transcript = event.results[0][0].transcript;
                    input.value = transcript;
                    
                    micBtn.classList.remove('listening');
                    micBtn.style.color = '';
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';

                    if (inputId === 'artistInput') {
                        searchArtist();
                    } else if (inputId === 'trackInput') {
                        searchTrack();
                    }
                };
                
                try {
                    recognition.start();
                } catch(e) {
                    console.warn("Speech recognition could not be started.", e);
                }
            }

            mediaRecorder.start(1000);
            micBtn.classList.add('listening');
            
            // Wait 6 seconds for Shazam recording
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

