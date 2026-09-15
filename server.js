const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs");
require("dotenv").config();

// Protect server from crashing on external network ECONNRESET / aborted fetches
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err && err.message ? err.message : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason && reason.message ? reason.message : reason);
});

const app = express();

// Database initialization
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const DB_FILE = path.join(dataDir, "database.json");

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { likedTracks: [], likedAlbums: [], likedPlaylists: [], customPlaylists: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("DB Read Error:", err);
    return { likedTracks: [], likedAlbums: [], likedPlaylists: [], customPlaylists: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("DB Write Error:", err);
    return false;
  }
}

// Your Last.fm API Key
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

// Middleware - Increased limit for audio files (5s audio can be a few Megabytes)
app.use(express.json({ limit: "50mb", extended: true }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to fetch high-quality artist images from iTunes (fallback)
async function getArtistImage(artistName) {
  if (!artistName) return null;
  
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&limit=1`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" }
    });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const artwork = data.results[0].artworkUrl100;
      if (artwork) {
        return artwork.replace('100x100', '600x600');
      }
    }
  } catch (err) {
    console.log(`🎨 Image Fallback failed for ${artistName}: ${err.message}`);
  }
  return null;
}

// Helper to fetch high-quality album artwork (JioSaavn / iTunes fallback)
async function getAlbumArtwork(albumName, artistName = '') {
  if (!albumName) return null;
  try {
    const q = `${albumName} ${artistName}`.trim();
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&q=${encodeURIComponent(q)}&_format=json&_marker=0&n=1&p=1&ctx=web6dot0`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    const data = await res.json();
    if (data.results && data.results.length > 0 && data.results[0].image) {
      return data.results[0].image.replace("150x150", "500x500").replace("50x50", "500x500");
    }
  } catch (e) {}

  try {
    const term = `${albumName} ${artistName}`.trim();
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=album&limit=1`);
    const data = await res.json();
    if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
      return data.results[0].artworkUrl100.replace('100x100', '600x600');
    }
  } catch (e) {}
  return null;
}

// API Routes

// Get artist info with bio
app.get("/api/artist/info", async (req, res) => {
  try {
    const artist = req.query.artist;
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Artist with top tracks and albums
app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q || "arijit singh";
    console.log(`\n🔍 Searching for artist: ${query}`);
    
    const searchRes = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(query)}&api_key=${LASTFM_API_KEY}&format=json`
    );
    const searchData = await searchRes.json();
    
    if (!searchData.results?.artistmatches?.artist?.length) {
      return res.json({ success: false, error: "No artist found", query: query });
    }
    
    const artist = searchData.results.artistmatches.artist[0];
    
    // Get full artist info (bio, etc)
    const infoRes = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artist.name)}&api_key=${LASTFM_API_KEY}&format=json`
    );
    const infoData = await infoRes.json();
    const artistInfo = infoData.artist;
    
    // Get top tracks
    const tracksRes = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(artist.name)}&api_key=${LASTFM_API_KEY}&format=json`
    );
    const tracksData = await tracksRes.json();
    
    // Get top albums
    const albumsRes = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.gettopalbums&artist=${encodeURIComponent(artist.name)}&api_key=${LASTFM_API_KEY}&format=json`
    );
    const albumsData = await albumsRes.json();
    
    const topTracks = tracksData.toptracks?.track?.slice(0, 15).map(track => ({
      name: track.name,
      listeners: track.listeners,
      playcount: track.playcount,
      url: track.url,
      duration: track.duration
    })) || [];
    
    let topAlbums = albumsData.topalbums?.album?.slice(0, 8).map(album => ({
      name: album.name,
      playcount: album.playcount,
      url: album.url,
      image: album.image?.[3]?.["#text"] || null
    })) || [];

    // If Last.fm returned few or no albums, fetch authentic albums from JioSaavn
    if (topAlbums.length < 3) {
      try {
        const saavnAlbUrl = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&q=${encodeURIComponent(artist.name)}&_format=json&_marker=0&n=8&p=1&ctx=web6dot0`;
        const saavnAlbRes = await fetch(saavnAlbUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        const saavnAlbData = await saavnAlbRes.json();
        if (saavnAlbData.results && saavnAlbData.results.length > 0) {
          topAlbums = saavnAlbData.results.map(alb => ({
            name: alb.title,
            playcount: '',
            url: alb.perma_url,
            image: alb.image ? alb.image.replace("150x150", "500x500").replace("50x50", "500x500") : null
          }));
        }
      } catch (albErr) {
        console.warn("JioSaavn album fallback error:", albErr.message);
      }
    } else {
      // Resolve any missing/placeholder images for Last.fm albums in parallel
      topAlbums = await Promise.all(topAlbums.map(async (alb) => {
        const isPl = !alb.image || alb.image.includes("2a96") || alb.image.includes("default") || alb.image === "";
        if (isPl) {
          const freshImg = await getAlbumArtwork(alb.name, artist.name);
          if (freshImg) alb.image = freshImg;
        }
        return alb;
      }));
    }

    // Final Image Decision (Last.fm vs iTunes fallback)
    let finalImage = artistInfo?.image?.[3]?.["#text"];
    
    // Last.fm uses several "no image" placeholders. If it starts with 'http' and contains '2a96', it's likely a placeholder.
    const isPlaceholder = !finalImage || 
                         finalImage.includes("2a96") || 
                         finalImage.includes("default_artist") ||
                         finalImage === "";
    
    if (isPlaceholder) {
       console.log(`🎨 Artist image missing for ${artist.name}. Fetching from iTunes...`);
       const itunesImg = await getArtistImage(artist.name);
       if (itunesImg) finalImage = itunesImg;
    }

    res.json({
      success: true,
      artist: {
        name: artist.name,
        listeners: artist.listeners,
        playcount: artist.playcount,
        url: artist.url,
        bio: artistInfo?.bio?.summary?.replace(/<a[^>]*>.*?<\/a>/g, '') || "No bio available",
        image: finalImage,
        tags: artistInfo?.tags?.tag?.slice(0, 5).map(t => t.name) || []
      },
      top_tracks: topTracks,
      top_albums: topAlbums
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Search Track with JioSaavn (authentic HD 500x500 movie/album artwork & metadata)
app.get("/api/track/search", async (req, res) => {
  try {
    const track = req.query.q || "Tum Hi Ho";
    const artist = req.query.artist || "";
    const query = `${track} ${artist}`.trim();
    console.log(`🎶 Searching for track: ${query}`);

    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=30&q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const data = await response.json();
    const raw = data.results || [];
    const cleanQ = track.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();

    // Find maximum play count among title matches
    let maxPlays = 0;
    for (const s of raw) {
      const t = (s.song || s.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      if (t === cleanQ || t.startsWith(cleanQ)) {
        const p = parseInt(s.play_count || 0);
        if (p > maxPlays) maxPlays = p;
      }
    }

    // Sort: Title match first, top-tier plays with earliest year (original film album), then play count
    raw.sort((a, b) => {
      const tA = (a.song || a.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      const tB = (b.song || b.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      const exactA = tA === cleanQ || tA.startsWith(cleanQ);
      const exactB = tB === cleanQ || tB.startsWith(cleanQ);

      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      const pA = parseInt(a.play_count || 0);
      const pB = parseInt(b.play_count || 0);

      const topTierA = maxPlays > 100000 && pA >= maxPlays * 0.5;
      const topTierB = maxPlays > 100000 && pB >= maxPlays * 0.5;

      if (topTierA && topTierB) {
        const yrA = parseInt(a.year || (a.more_info && a.more_info.year) || 2099);
        const yrB = parseInt(b.year || (b.more_info && b.more_info.year) || 2099);
        if (yrA !== yrB) return yrA - yrB;
      }

      if (topTierA && !topTierB) return -1;
      if (!topTierA && topTierB) return 1;

      return pB - pA;
    });

    // Deduplicate songs by title + album to avoid repetitive compilation rows
    const seen = new Set();
    const results = [];
    for (const s of raw) {
      const title = (s.song || s.title || '').trim();
      const artistName = (s.singers || s.primary_artists || s.music || '').trim();
      const albumName = (s.album || '').trim();
      const key = (title + '---' + albumName).toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          name: title,
          artist: artistName || artist || 'Unknown Artist',
          album: albumName,
          year: s.year || (s.more_info && s.more_info.year) || '',
          duration: s.duration,
          image: s.image ? s.image.replace("150x150", "500x500").replace("50x50", "500x500") : null,
          has_lyrics: s.has_lyrics === 'true',
          id: s.id
        });
      }
    }

    // Fallback to Last.fm if JioSaavn returned 0 results
    if (results.length === 0) {
      const lfmUrl = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json${artist ? `&artist=${encodeURIComponent(artist)}` : ''}`;
      const lfmRes = await fetch(lfmUrl);
      const lfmData = await lfmRes.json();
      const lfmTracks = (lfmData.results?.trackmatches?.track || []).map(t => ({
        name: t.name,
        artist: t.artist,
        listeners: t.listeners,
        image: null
      }));
      return res.json({ success: true, results: lfmTracks });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("Track search error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Curated Top Artists (India & Pakistan)
const TOP_DESI_ARTISTS = [
  { name: "Arijit Singh", country: "india", tag: "Romantic / Bollywood", listeners: 24500000, playcount: 142000000, image: "https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg" },
  { name: "Atif Aslam", country: "pakistan", tag: "Romantic / Pop", listeners: 22400000, playcount: 128000000, image: "https://c.saavncdn.com/953/club-ambition-Unknown-2024-20240628202752-500x500.jpg" },
  { name: "Nusrat Fateh Ali Khan", country: "pakistan", tag: "Sufi / Qawwali Legend", listeners: 20300000, playcount: 115000000, image: "https://c.saavncdn.com/796/Sufi-Splendors-Hindi-2014-500x500.jpg" },
  { name: "Shreya Ghoshal", country: "india", tag: "Melody Queen / Bollywood", listeners: 19800000, playcount: 110000000, image: "https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_500x500.jpg" },
  { name: "Rahat Fateh Ali Khan", country: "pakistan", tag: "Sufi / Classical", listeners: 18700000, playcount: 98000000, image: "https://c.saavncdn.com/068/Teri-Mohabbat-Unknown-2026-20260708075743-500x500.jpg" },
  { name: "Diljit Dosanjh", country: "india", tag: "Punjabi / Global Pop", listeners: 17200000, playcount: 92000000, image: "https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg" },
  { name: "Sonu Nigam", country: "india", tag: "Evergreen / Bollywood", listeners: 16400000, playcount: 88000000, image: "https://c.saavncdn.com/artists/Sonu_Nigam_003_20260813182013_500x500.jpg" },
  { name: "AP Dhillon", country: "india", tag: "Punjabi Wave / Hip-Hop", listeners: 15600000, playcount: 84000000, image: "https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg" },
  { name: "Kaifi Khalil", country: "pakistan", tag: "Balochi / Soul / Pop", listeners: 13500000, playcount: 76000000, image: "https://c.saavncdn.com/371/Kahani-Suno-2-0-feat-Kaifi-Khalil-Slowed-and-Reverbed-English-2023-20230216024616-500x500.jpg" },
  { name: "Kishore Kumar", country: "india", tag: "Golden Era / Legend", listeners: 18900000, playcount: 105000000, image: "https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg" },
  { name: "Lata Mangeshkar", country: "india", tag: "Nightingale of India", listeners: 19100000, playcount: 108000000, image: "https://c.saavncdn.com/artists/Lata_Mangeshkar_004_20230623105323_500x500.jpg" },
  { name: "Ali Zafar", country: "pakistan", tag: "Pop / Rock / Folk", listeners: 11600000, playcount: 62000000, image: "https://c.saavncdn.com/870/Aurat-A-Poem-by-Ali-Zafar-Hindi-2019-20260709163329-500x500.jpg" },
  { name: "Neha Kakkar", country: "india", tag: "Dance / Party Hits", listeners: 16200000, playcount: 86000000, image: "https://c.saavncdn.com/artists/Neha_Kakkar_007_20241212115832_500x500.jpg" },
  { name: "Talha Anjum", country: "pakistan", tag: "Urdu Rap / Hip-Hop", listeners: 11400000, playcount: 65000000, image: "https://c.saavncdn.com/594/No-Other-Place-feat-Talha-Anjum-English-2022-20220721235551-500x500.jpg" },
  { name: "KK", country: "india", tag: "Soulful / Rock Romantic", listeners: 15300000, playcount: 82000000, image: "https://c.saavncdn.com/artists/KK_500x500.jpg" },
  { name: "Asim Azhar", country: "pakistan", tag: "Youth Pop / Melodic", listeners: 10900000, playcount: 58000000, image: "https://c.saavncdn.com/988/Aarzu-Asim-Azhar-Edm-Mix-Urdu-2026-20260611145427-500x500.jpg" },
  { name: "Jubin Nautiyal", country: "india", tag: "Acoustic / Romantic", listeners: 14800000, playcount: 79000000, image: "https://c.saavncdn.com/artists/Jubin_Nautiyal_003_20231130204020_500x500.jpg" },
  { name: "Badshah", country: "india", tag: "Commercial / Rap", listeners: 13900000, playcount: 74000000, image: "https://c.saavncdn.com/artists/Badshah_006_20241118064015_500x500.jpg" },
  { name: "Abdul Hannan", country: "pakistan", tag: "Indie Pop / Lo-Fi", listeners: 9800000, playcount: 51000000, image: "https://c.saavncdn.com/382/Abdullah-Hindi-1980-20190924060933-500x500.jpg" },
  { name: "Kumar Sanu", country: "india", tag: "90s King of Romance", listeners: 14100000, playcount: 75000000, image: "https://c.saavncdn.com/artists/Kumar_Sanu_500x500.jpg" },
  { name: "Alka Yagnik", country: "india", tag: "90s Queen of Melody", listeners: 15800000, playcount: 83000000, image: "https://c.saavncdn.com/artists/Alka_Yagnik_002_20220314192930_500x500.jpg" },
  { name: "Bilal Saeed", country: "pakistan", tag: "Punjabi Pop / R&B", listeners: 10200000, playcount: 54000000, image: "https://c.saavncdn.com/476/Dhund-Ke-Dikha-Hindi-2020-20220510011352-500x500.jpg" },
  { name: "Sid Sriram", country: "india", tag: "Carnatic / Soul Fusion", listeners: 11900000, playcount: 61000000, image: "https://c.saavncdn.com/artists/Sid_Sriram_005_20240425180600_500x500.jpg" },
  { name: "Mohit Chauhan", country: "india", tag: "Silk Voice / Indie Folk", listeners: 12700000, playcount: 68000000, image: "https://c.saavncdn.com/artists/Mohit_Chauhan_500x500.jpg" },
  { name: "Shafqat Amanat Ali", country: "pakistan", tag: "Classical / Fusion", listeners: 12300000, playcount: 64000000, image: "https://c.saavncdn.com/904/Tere-Naal-Love-Ho-Gaya-Hindi-2011-20260907165855-500x500.jpg" },
  { name: "Darshan Raval", country: "india", tag: "Youth Anthem / Pop", listeners: 12400000, playcount: 66000000, image: "https://c.saavncdn.com/artists/Darshan_Raval_006_20250807060352_500x500.jpg" },
  { name: "Armaan Malik", country: "india", tag: "Pop / Romantic", listeners: 11200000, playcount: 59000000, image: "https://c.saavncdn.com/artists/Armaan_Malik_006_20260813132832_500x500.jpg" },
  { name: "Sunidhi Chauhan", country: "india", tag: "Powerhouse / Dance", listeners: 13400000, playcount: 71000000, image: "https://c.saavncdn.com/artists/Sunidhi_Chauhan_005_20250515061617_500x500.jpg" },
  { name: "Abida Parveen", country: "pakistan", tag: "Sufiana Kalam / Legend", listeners: 11800000, playcount: 63000000, image: "https://c.saavncdn.com/338/Best-Of-Abida-Parveen-Punjabi-2025-20251106053038-500x500.jpg" },
  { name: "Hasan Raheem", country: "pakistan", tag: "Indie / R&B", listeners: 8600000, playcount: 45000000, image: "https://c.saavncdn.com/436/Husn-Hindi-2023-20231129054140-500x500.jpg" },
  { name: "Anuv Jain", country: "india", tag: "Acoustic / Storyteller", listeners: 10800000, playcount: 57000000, image: "https://c.saavncdn.com/artists/Anuv_Jain_001_20231206073013_500x500.jpg" },
  { name: "King", country: "india", tag: "Pop / Hip-Hop", listeners: 12100000, playcount: 64000000, image: "https://c.saavncdn.com/734/Champagne-Talk-Hindi-2022-20221008011951-500x500.jpg" },
  { name: "Farhan Saeed", country: "pakistan", tag: "Pop / OST Romance", listeners: 9200000, playcount: 48000000, image: "https://c.saavncdn.com/089/Thodi-Der-Shreya-Ghosal-Farhan-Saeed-Vocals-Only-Hindi-2026-20260820123601-500x500.jpg" },
  { name: "Ghulam Ali", country: "pakistan", tag: "Ghazal Maestro", listeners: 10500000, playcount: 55000000, image: "https://c.saavncdn.com/337/Teri-Judai-Mein-Hindi-2018-20181018-500x500.jpg" }
];

// Get Charts (Top Indian & Pakistani Artists)
app.get("/api/charts", (req, res) => {
  try {
    const country = (req.query.country || 'all').toLowerCase();
    let list = TOP_DESI_ARTISTS;
    if (country === 'india') {
      list = TOP_DESI_ARTISTS.filter(a => a.country === 'india');
    } else if (country === 'pakistan') {
      list = TOP_DESI_ARTISTS.filter(a => a.country === 'pakistan');
    }
    res.json({
      success: true,
      artists: {
        artist: list
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// YouTube Search Proxy
app.get("/api/yt/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Missing query" });
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" }
    });
    const html = await response.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    const videoId = match ? match[1] : null;
    if (videoId) {
      res.json({ success: true, videoId: videoId, url: `https://www.youtube.com/watch?v=${videoId}` });
    } else {
      res.status(404).json({ success: false, error: "No video found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// JioSaavn Search and Direct Ad-Free Audio Stream Routes
app.get("/api/saavn/search", async (req, res) => {
  try {
    const rawQuery = req.query.q;
    if (!rawQuery) return res.status(400).json({ error: "Missing query" });

    console.log(`🎶 JioSaavn searching for: ${rawQuery}`);

    async function fetchFromSaavn(q) {
      const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=20&q=${encodeURIComponent(q)}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      return await searchRes.json();
    }

    let searchData = await fetchFromSaavn(rawQuery);

    if (!searchData.results || searchData.results.length === 0) {
      // Clean query by removing (From ...), [Remix], etc.
      const cleaned = rawQuery.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").replace(/\s+/g, " ").trim();
      if (cleaned && cleaned !== rawQuery) {
        console.log(`🎶 Retrying with cleaned query: ${cleaned}`);
        searchData = await fetchFromSaavn(cleaned);
      }
    }

    if (!searchData.results || searchData.results.length === 0) {
      return res.status(404).json({ success: false, error: "Song not found on JioSaavn" });
    }

    // Filter to songs that have playable audio streams
    const playable = searchData.results.filter(s => !!(s.encrypted_media_url || (s.more_info && s.more_info.encrypted_media_url)));
    const cleanTitle = rawQuery.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();

    // Find maximum play count among matching title songs
    let maxPlays = 0;
    for (const s of playable) {
      const songTitle = (s.song || s.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      if (songTitle === cleanTitle || songTitle.startsWith(cleanTitle)) {
        const p = parseInt(s.play_count || 0);
        if (p > maxPlays) maxPlays = p;
      }
    }

    // Prioritize songs whose title matches, top-tier plays with EARLIEST release year (original film soundtrack)
    playable.sort((a, b) => {
      const songA = (a.song || a.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      const songB = (b.song || b.title || '').replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim().toLowerCase();
      const exactA = songA === cleanTitle || cleanTitle.startsWith(songA);
      const exactB = songB === cleanTitle || cleanTitle.startsWith(songB);

      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;

      const pA = parseInt(a.play_count || 0);
      const pB = parseInt(b.play_count || 0);

      // Top-tier plays: songs within 50% of the maximum hit count
      const topTierA = maxPlays > 100000 && pA >= maxPlays * 0.5;
      const topTierB = maxPlays > 100000 && pB >= maxPlays * 0.5;

      if (topTierA && topTierB) {
        const yrA = parseInt(a.year || (a.more_info && a.more_info.year) || 2099);
        const yrB = parseInt(b.year || (b.more_info && b.more_info.year) || 2099);
        if (yrA !== yrB) return yrA - yrB;
      }

      if (topTierA && !topTierB) return -1;
      if (!topTierA && topTierB) return 1;

      return pB - pA;
    });

    const song = playable.length > 0 ? playable[0] : searchData.results[0];
    const encUrl = song.encrypted_media_url || (song.more_info && song.more_info.encrypted_media_url);

    if (!encUrl) {
      return res.status(404).json({ success: false, error: "Audio stream not found" });
    }

    // Generate Auth Token for direct 320kbps CDN URL
    const tokenUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
    const tokenRes = await fetch(tokenUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.auth_url) {
      return res.status(404).json({ success: false, error: "Failed to generate stream URL" });
    }

    // High resolution album/track artwork
    let hdImage = song.image ? song.image.replace("150x150", "500x500").replace("50x50", "500x500") : null;

    res.json({
      success: true,
      id: song.id,
      has_lyrics: song.has_lyrics === 'true',
      title: song.song || song.title,
      artist: song.primary_artists || song.singers || song.music,
      image: hdImage,
      duration: song.duration,
      streamUrl: `/api/saavn/stream?url=${encodeURIComponent(tokenData.auth_url)}`
    });
  } catch (err) {
    console.error("JioSaavn Search Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Multi-Source Lyrics Route (JioSaavn + LRCLIB + Lyrics.ovh)
app.get(["/api/saavn/lyrics", "/api/lyrics"], async (req, res) => {
  try {
    const songId = req.query.id;
    const track = req.query.track || req.query.title || "";
    const artist = req.query.artist || "";

    // Source 1: JioSaavn Official Lyrics (if songId provided)
    if (songId) {
      try {
        const lyricsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&_format=json&lyrics_id=${encodeURIComponent(songId)}&ctx=web6dot0&api_version=4`;
        const response = await fetch(lyricsUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        const data = await response.json();
        if (data && data.lyrics && data.lyrics.trim().length > 10) {
          return res.json({ success: true, source: 'JioSaavn', lyrics: data.lyrics, snippet: data.snippet });
        }
      } catch (err) {
        console.log("JioSaavn lyrics fetch error:", err.message);
      }
    }

    // Source 2: LRCLIB (Global, Bollywood, English lyrics database)
    if (track) {
      try {
        const cleanTrack = track.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/['"]/g, "").trim();
        const cleanArtist = artist.split(",")[0].split("&")[0].split("feat")[0].replace(/\(.*?\)/g, "").trim();
        
        let lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTrack)}`;
        if (cleanArtist) lrcUrl += `&artist_name=${encodeURIComponent(cleanArtist)}`;

        const lrcRes = await fetch(lrcUrl, {
          headers: { "User-Agent": "MelodySphere/1.0" }
        });
        
        if (lrcRes.ok) {
          const lrcData = await lrcRes.json();
          let lyrics = lrcData.plainLyrics;
          if (!lyrics && lrcData.syncedLyrics) {
            lyrics = lrcData.syncedLyrics.replace(/\[\d+:\d+\.\d+\]\s*/g, '');
          }
          if (lyrics && lyrics.trim().length > 10) {
            return res.json({ success: true, source: 'LRCLIB', lyrics: lyrics.replace(/\n/g, '<br>') });
          }
        }
      } catch (err) {
        console.log("LRCLIB lyrics fetch error:", err.message);
      }
    }

    // Source 3: Lyrics.ovh Fallback
    if (track && artist) {
      try {
        const cleanTrack = track.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
        const cleanArtist = artist.split(",")[0].trim();
        const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTrack)}`;
        const ovhRes = await fetch(ovhUrl);
        if (ovhRes.ok) {
          const ovhData = await ovhRes.json();
          if (ovhData && ovhData.lyrics && ovhData.lyrics.trim().length > 10) {
            return res.json({ success: true, source: 'Lyrics.ovh', lyrics: ovhData.lyrics.replace(/\n/g, '<br>') });
          }
        }
      } catch (err) {}
    }

    res.status(404).json({ success: false, error: "Lyrics not available for this song" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Stream audio proxy with Range header support for seamless playback and seeking
app.get("/api/saavn/stream", async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).send("Missing URL");

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.jiosaavn.com/"
    };

    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const audioRes = await fetch(rawUrl, { headers });

    res.status(audioRes.status);
    for (const [key, value] of audioRes.headers.entries()) {
      if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    const { Readable } = require("stream");
    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    console.error("Stream Proxy Error:", err.message);
    res.status(500).send("Error streaming audio");
  }
});

// Direct MP3 Audio Download Proxy
app.get(["/api/saavn/download", "/api/download"], async (req, res) => {
  try {
    const rawUrl = req.query.url;
    const title = (req.query.title || req.query.track || "Song").trim();
    const artist = (req.query.artist || "").trim();

    console.log(`📥 Download request for: "${title}" by "${artist}"`);

    let cdnUrl = null;

    // 1. If direct url or /api/saavn/stream?url=... was passed
    if (rawUrl) {
      if (rawUrl.includes("url=")) {
        const parts = rawUrl.split("url=");
        cdnUrl = decodeURIComponent(parts[1]);
      } else if (rawUrl.startsWith("http")) {
        cdnUrl = rawUrl;
      }
    }

    // 2. If no CDN url yet, search JioSaavn to obtain direct 320kbps token url
    if (!cdnUrl) {
      const q = `${title} ${artist}`.trim();
      const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=5&q=${encodeURIComponent(q)}`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      });
      const searchData = await searchRes.json();
      if (searchData && searchData.results && searchData.results.length > 0) {
        const playable = searchData.results.find(s => !!(s.encrypted_media_url || (s.more_info && s.more_info.encrypted_media_url))) || searchData.results[0];
        const encUrl = playable.encrypted_media_url || (playable.more_info && playable.more_info.encrypted_media_url);
        if (encUrl) {
          const tokenUrl = `https://www.jiosaavn.com/api.php?__call=song.generateAuthToken&url=${encodeURIComponent(encUrl)}&bitrate=320&api_version=4&_format=json&ctx=web6dot0&_marker=0`;
          const tokenRes = await fetch(tokenUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          });
          const tokenData = await tokenRes.json();
          if (tokenData && tokenData.auth_url) {
            cdnUrl = tokenData.auth_url;
          }
        }
      }
    }

    if (!cdnUrl) {
      return res.status(404).send("Audio stream not found for download");
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.jiosaavn.com/"
    };

    const audioRes = await fetch(cdnUrl, { headers });
    if (!audioRes.ok) {
      return res.status(audioRes.status).send("Failed to stream audio file");
    }

    const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ");
    const cleanArtist = artist.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ");
    const filename = cleanArtist ? `${cleanTitle} - ${cleanArtist}.mp3` : `${cleanTitle}.mp3`;

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "audio/mpeg");
    if (audioRes.headers.get("content-length")) {
      res.setHeader("Content-Length", audioRes.headers.get("content-length"));
    }

    const { Readable } = require("stream");
    Readable.fromWeb(audioRes.body).pipe(res);
  } catch (err) {
    console.error("Download route error:", err.message);
    res.status(500).send("Error downloading track");
  }
});

// ==========================================
// 💾 DATABASE & USER LIBRARY REST ROUTES
// ==========================================

// Helper to isolate library data per user / device
function getUserData(req) {
  const userId = (req.headers['x-user-id'] || req.query.userId || '').toString().trim() || 'default_user';
  const db = readDB();
  if (!db.users) db.users = {};
  
  if (!db.users[userId]) {
    // If it's default_user or legacy, initialize with existing data if present
    db.users[userId] = {
      likedTracks: (userId === 'default_user' && Array.isArray(db.likedTracks)) ? [...db.likedTracks] : [],
      likedAlbums: (userId === 'default_user' && Array.isArray(db.likedAlbums)) ? [...db.likedAlbums] : [],
      likedPlaylists: (userId === 'default_user' && Array.isArray(db.likedPlaylists)) ? [...db.likedPlaylists] : [],
      customPlaylists: (userId === 'default_user' && Array.isArray(db.customPlaylists)) ? [...db.customPlaylists] : []
    };
    writeDB(db);
  }
  
  const userLib = db.users[userId];
  return { db, userLib, userId };
}

// Get entire library for this user (Liked tracks, albums, playlists & custom playlists)
app.get("/api/user/library", (req, res) => {
  const { userLib } = getUserData(req);
  res.json({ success: true, ...userLib });
});

// Toggle Like (track, album, or playlist) per user
app.post("/api/user/library/like", (req, res) => {
  const { type, item } = req.body;
  if (!type || !item) return res.status(400).json({ success: false, error: "Missing type or item" });

  const { db, userLib } = getUserData(req);
  let liked = false;

  if (type === "track") {
    if (!userLib.likedTracks) userLib.likedTracks = [];
    const idx = userLib.likedTracks.findIndex(t => t.track.toLowerCase() === item.track.toLowerCase() && t.artist.toLowerCase() === item.artist.toLowerCase());
    if (idx > -1) {
      userLib.likedTracks.splice(idx, 1);
      liked = false;
    } else {
      userLib.likedTracks.unshift({ track: item.track, artist: item.artist, image: item.image || "", id: item.id || "" });
      liked = true;
    }
  } else if (type === "album") {
    if (!userLib.likedAlbums) userLib.likedAlbums = [];
    const idx = userLib.likedAlbums.findIndex(a => (a.id && item.id && a.id === item.id) || (a.title && item.title && a.title.toLowerCase() === item.title.toLowerCase()));
    if (idx > -1) {
      userLib.likedAlbums.splice(idx, 1);
      liked = false;
    } else {
      userLib.likedAlbums.unshift({ id: item.id, title: item.title, artist: item.artist, image: item.image, songCount: item.songCount });
      liked = true;
    }
  } else if (type === "playlist") {
    if (!userLib.likedPlaylists) userLib.likedPlaylists = [];
    const idx = userLib.likedPlaylists.findIndex(p => (p.id && item.id && p.id === item.id) || (p.title && item.title && p.title.toLowerCase() === item.title.toLowerCase()));
    if (idx > -1) {
      userLib.likedPlaylists.splice(idx, 1);
      liked = false;
    } else {
      userLib.likedPlaylists.unshift({ id: item.id, title: item.title, image: item.image, count: item.count });
      liked = true;
    }
  }

  writeDB(db);
  res.json({ success: true, liked, ...userLib });
});

// Custom Playlists CRUD per user
app.get("/api/playlists", (req, res) => {
  const { userLib } = getUserData(req);
  res.json({ success: true, playlists: userLib.customPlaylists || [] });
});

app.post("/api/playlists", (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, error: "Playlist name is required" });

  const { db, userLib } = getUserData(req);
  if (!userLib.customPlaylists) userLib.customPlaylists = [];
  const newPlaylist = {
    id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name.trim(),
    description: description ? description.trim() : "",
    createdAt: new Date().toISOString(),
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60",
    tracks: []
  };
  userLib.customPlaylists.unshift(newPlaylist);
  writeDB(db);
  res.json({ success: true, playlist: newPlaylist, playlists: userLib.customPlaylists });
});

app.delete("/api/playlists/:id", (req, res) => {
  const { db, userLib } = getUserData(req);
  userLib.customPlaylists = (userLib.customPlaylists || []).filter(p => p.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, playlists: userLib.customPlaylists });
});

app.post("/api/playlists/:id/tracks", (req, res) => {
  const { track, artist, image } = req.body;
  if (!track || !artist) return res.status(400).json({ success: false, error: "Track and artist are required" });

  const { db, userLib } = getUserData(req);
  const playlist = (userLib.customPlaylists || []).find(p => p.id === req.params.id);
  if (!playlist) return res.status(404).json({ success: false, error: "Playlist not found" });

  if (!playlist.tracks) playlist.tracks = [];
  const exists = playlist.tracks.some(t => t.track.toLowerCase() === track.toLowerCase() && t.artist.toLowerCase() === artist.toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, error: "Track already in this playlist" });
  }

  playlist.tracks.push({ track, artist, image: image || "" });
  if (image && (!playlist.image || playlist.image.includes('unsplash'))) {
    playlist.image = image;
  }
  writeDB(db);
  res.json({ success: true, playlist });
});

app.delete("/api/playlists/:id/tracks/:trackIndex", (req, res) => {
  const { db, userLib } = getUserData(req);
  const playlist = (userLib.customPlaylists || []).find(p => p.id === req.params.id);
  if (!playlist) return res.status(404).json({ success: false, error: "Playlist not found" });

  const idx = parseInt(req.params.trackIndex);
  if (idx >= 0 && idx < playlist.tracks.length) {
    playlist.tracks.splice(idx, 1);
    writeDB(db);
  }
  res.json({ success: true, playlist });
});

// ==========================================
// 💿 JIOSAAVN ALBUM & PLAYLIST ROUTES
// ==========================================

// JioSaavn Search Albums
app.get("/api/saavn/album/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing query" });
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&q=${encodeURIComponent(q)}&_format=json&_marker=0&n=12&p=1&ctx=web6dot0`;
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    const data = await response.json();
    const rawAlbums = data.results || [];
    const cleanQ = q.trim().toLowerCase();

    // Prioritize exact title matches, maintaining JioSaavn's popularity rank
    rawAlbums.sort((a, b) => {
      const tA = (a.title || '').trim().toLowerCase();
      const tB = (b.title || '').trim().toLowerCase();
      const exactA = tA === cleanQ;
      const exactB = tB === cleanQ;
      if (exactA && !exactB) return -1;
      if (!exactA && exactB) return 1;
      return 0;
    });

    const results = rawAlbums.map(alb => ({
      id: alb.albumid,
      title: alb.title,
      artist: typeof alb.artist === 'string' ? alb.artist : (alb.primary_artists || alb.music || 'Various Artists'),
      year: alb.year || "",
      image: alb.image ? alb.image.replace("150x150", "500x500").replace("50x50", "500x500") : null,
      perma_url: alb.perma_url
    }));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// JioSaavn Get Album Details with all tracks
// JioSaavn Get Album Details with all tracks (with dynamic fallback by title)
app.get("/api/saavn/album", async (req, res) => {
  try {
    const albumId = req.query.id;
    const title = req.query.title || "";
    const artist = req.query.artist || "";
    if (!albumId && !title) return res.status(400).json({ error: "Missing album id or title" });

    let rawSongs = [];
    let data = {};

    if (albumId) {
      try {
        const albumUrl = `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${encodeURIComponent(albumId)}&_format=json`;
        const response = await fetch(albumUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        data = await response.json();
        rawSongs = data.list || data.songs || [];
      } catch (e) {}
    }

    // Dynamic Fallback: If 0 songs and title provided, search JioSaavn for fresh album
    if (rawSongs.length === 0 && title) {
      console.log(`🔍 Album ID ${albumId} returned 0 tracks. Searching JioSaavn for "${title}"...`);
      try {
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&q=${encodeURIComponent(title + (artist ? ' ' + artist : ''))}&_format=json&_marker=0&n=3&p=1&ctx=web6dot0`;
        const sRes = await fetch(searchUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        const sData = await sRes.json();
        if (sData.results && sData.results.length > 0) {
          const freshId = sData.results[0].albumid;
          const freshUrl = `https://www.jiosaavn.com/api.php?__call=content.getAlbumDetails&albumid=${encodeURIComponent(freshId)}&_format=json`;
          const fRes = await fetch(freshUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          });
          data = await fRes.json();
          rawSongs = data.list || data.songs || [];
        }
      } catch (searchErr) {
        console.warn("Album fallback search failed:", searchErr.message);
      }
    }

    const songs = rawSongs.map(s => ({
      id: s.id,
      title: s.title || s.song,
      artist: s.singers || s.primary_artists || s.music || "Unknown Artist",
      duration: s.duration,
      image: s.image ? s.image.replace("150x150", "500x500").replace("50x50", "500x500") : (data.image ? data.image.replace("150x150", "500x500") : null),
      has_lyrics: s.has_lyrics === 'true'
    }));

    res.json({
      success: true,
      id: data.albumid || albumId,
      title: data.title || data.name || title,
      artist: typeof data.artist === 'string' ? data.artist : (data.primary_artists || data.music || artist || 'Various Artists'),
      year: data.year,
      image: data.image ? data.image.replace("150x150", "500x500").replace("50x50", "500x500") : null,
      songs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// JioSaavn Search Playlists
app.get("/api/saavn/playlist/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing query" });
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&q=${encodeURIComponent(q)}&_format=json&_marker=0&n=12&p=1&ctx=web6dot0`;
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    const data = await response.json();
    const results = (data.results || []).map(pl => ({
      id: pl.listid,
      title: pl.listname || pl.title,
      image: pl.image ? pl.image.replace("150x150", "500x500").replace("50x50", "500x500") : null,
      count: pl.numsongs || pl.count || 0,
      artist: pl.artist_name || pl.firstname || "JioSaavn Editor"
    }));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// JioSaavn Get Playlist Details with all tracks (with dynamic search fallback)
app.get("/api/saavn/playlist", async (req, res) => {
  try {
    const playlistId = req.query.id;
    const title = req.query.title || "";
    if (!playlistId && !title) return res.status(400).json({ error: "Missing playlist id or title" });

    let rawSongs = [];
    let data = {};

    if (playlistId) {
      try {
        const plUrl = `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${encodeURIComponent(playlistId)}&_format=json&_marker=0&ctx=web6dot0`;
        const response = await fetch(plUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        data = await response.json();
        rawSongs = data.songs || data.list || [];
      } catch (e) {}
    }

    // Dynamic Fallback 1: If 0 songs and title provided, search JioSaavn for fresh playlist
    if (rawSongs.length === 0 && title) {
      console.log(`🔍 Playlist ID ${playlistId} returned 0 tracks. Searching JioSaavn for "${title}"...`);
      try {
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&q=${encodeURIComponent(title)}&_format=json&_marker=0&n=5&p=1&ctx=web6dot0`;
        const sRes = await fetch(searchUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        const sData = await sRes.json();
        if (sData.results && sData.results.length > 0) {
          const freshId = sData.results[0].listid;
          const freshPlUrl = `https://www.jiosaavn.com/api.php?__call=playlist.getDetails&listid=${encodeURIComponent(freshId)}&_format=json&_marker=0&ctx=web6dot0`;
          const fRes = await fetch(freshPlUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
          });
          data = await fRes.json();
          rawSongs = data.songs || data.list || [];
        }
      } catch (searchErr) {
        console.warn("Playlist fallback search failed:", searchErr.message);
      }
    }

    // Dynamic Fallback 2: If still 0 songs, search tracks directly matching title/mood
    if (rawSongs.length === 0 && title) {
      try {
        const trackSearchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&p=1&n=25&q=${encodeURIComponent(title)}`;
        const tRes = await fetch(trackSearchUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        const tData = await tRes.json();
        rawSongs = tData.results || [];
      } catch (tErr) {}
    }

    const songs = rawSongs.map(s => ({
      id: s.id,
      title: s.title || s.song,
      artist: s.singers || s.primary_artists || s.music || "Unknown Artist",
      duration: s.duration,
      image: s.image ? s.image.replace("150x150", "500x500").replace("50x50", "500x500") : (data.image ? data.image.replace("150x150", "500x500") : null),
      has_lyrics: s.has_lyrics === 'true'
    }));

    res.json({
      success: true,
      id: data.listid || playlistId,
      title: data.listname || data.title || title,
      image: data.image ? data.image.replace("150x150", "500x500").replace("50x50", "500x500") : (songs[0]?.image || null),
      count: songs.length,
      songs
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Featured / Curated Playlists & Trending Albums (Fresh, verified working IDs & Images)
app.get("/api/saavn/featured", async (req, res) => {
  try {
    const featuredPlaylists = [
      { id: "47599074", title: "Trending Bollywood Hits", image: "https://c.saavncdn.com/editorial/NowTrending_20260423085344_500x500.jpg", count: 37, category: "Trending" },
      { id: "154546814", title: "90s Romance - Hindi", image: "https://c.saavncdn.com/editorial/90sRomanceHindi_20260302042658_500x500.jpg", count: 42, category: "90s & 2000s" },
      { id: "58057412", title: "Best of Arijit Singh", image: "https://c.saavncdn.com/editorial/Let_sPlayArijitSinghHindi_20240812070403_500x500.jpg", count: 50, category: "Romance" },
      { id: "3958470", title: "Punjabi Party Hits", image: "https://c.saavncdn.com/editorial/PunjabiPartyHits_20260617050614_500x500.jpg", count: 36, category: "Punjabi" },
      { id: "1079336813", title: "Lo-Fi Midnight Chill", image: "https://c.saavncdn.com/editorial/ChillMaaro-LoFiMix_20260403095103_500x500.jpg", count: 34, category: "Lo-Fi" },
      { id: "1302033575", title: "Romantic Melodies Hindi", image: "https://c.saavncdn.com/editorial/RomanticHits2026Hindi_20260707083404_500x500.jpg", count: 20, category: "Romance" },
      { id: "1167751270", title: "2000s Bollywood Nostalgia", image: "https://c.saavncdn.com/editorial/charts_Hindi2000s_156632_20240408061838_500x500.jpg", count: 100, category: "90s & 2000s" },
      { id: "1302033253", title: "Punjabi Pop & Hip Hop", image: "https://c.saavncdn.com/editorial/HipHopHits2026Punjabi_20260707081504_500x500.jpg", count: 20, category: "Punjabi" },
      { id: "79653434", title: "Ultimate Party Mix Hindi", image: "https://c.saavncdn.com/editorial/NonStopParty_20251226043305_500x500.jpg", count: 50, category: "Party" },
      { id: "1214349427", title: "Heartbroken & Sad Melodies", image: "https://c.saavncdn.com/editorial/OldSadSongs_20240307040155_500x500.jpg", count: 22, category: "Sad Hits" },
      { id: "1296588511", title: "Spiritual & Devotional Peace", image: "https://c.saavncdn.com/editorial/HindiDevotionalSongs_20251226083602_500x500.jpg", count: 20, category: "Devotional & Sufi" },
      { id: "1262711873", title: "Sufi & Soulful Magic", image: "https://c.saavncdn.com/editorial/SufiHitsCarvaanSelect_20250718104134_500x500.jpg", count: 49, category: "Devotional & Sufi" },
      { id: "1039524952", title: "Acoustic & Unplugged Sessions", image: "https://c.saavncdn.com/editorial/artist_selects-1039520512_20220317082925_500x500.jpg", count: 18, category: "Lo-Fi" },
      { id: "1167751266", title: "Late Night Long Drive", image: "https://c.saavncdn.com/editorial/charts_Hindi1990s_136920_20240408061858_500x500.jpg", count: 100, category: "Trending" },
      { id: "111163065", title: "Workout High Energy Hits", image: "https://c.saavncdn.com/editorial/Workout1Hour_20260622051759_500x500.jpg", count: 25, category: "Party" },
      { id: "1264830656", title: "Monsoon & Rainy Chai Vibes", image: "https://c.saavncdn.com/editorial/MonsoonMoodsCarvaanSelect_20250625162244_500x500.jpg", count: 20, category: "Romance" },
      { id: "1134543272", title: "Top 50 Hindi India", image: "https://c.saavncdn.com/editorial/Hindi-IndiaSuperhitsTop50_20260911054516_500x500.jpg", count: 50, category: "Trending" },
      { id: "826644795", title: "Golden Retro 70s & 80s", image: "https://c.saavncdn.com/editorial/DecadeOfHeroes1980s_20240826084735_500x500.jpg", count: 20, category: "90s & 2000s" },
      { id: "154589446", title: "Sidhu Moose Wala Tribute", image: "https://c.saavncdn.com/editorial/Let_sPlaySidhuMooseWalaPunjabi_20240807075915_500x500.jpg", count: 35, category: "Punjabi" },
      { id: "1269193212", title: "Desi Hip-Hop & Rap Revolution", image: "https://c.saavncdn.com/editorial/ApneDesiGaaneCarvaanSelect_20251209091748_500x500.jpg", count: 27, category: "Party" }
    ];

    const trendingAlbums = [
      { id: "1139549", title: "Aashiqui 2", artist: "Jeet Gannguli, Mithoon, Ankit Tiwari", year: "2013", category: "Romance", image: "https://c.saavncdn.com/430/Aashiqui-2-Hindi-2013-500x500.jpg" },
      { id: "1045274", title: "Rockstar", artist: "A.R. Rahman", year: "2011", category: "Trending", image: "https://c.saavncdn.com/408/Rockstar-Hindi-2011-20221212023139-500x500.jpg" },
      { id: "16188900", title: "Kabir Singh", artist: "Sachet-Parampara, Vishal Mishra, Mithoon", year: "2019", category: "Romance", image: "https://c.saavncdn.com/807/Kabir-Singh-Hindi-2019-20240131131003-500x500.jpg" },
      { id: "1139559", title: "Yeh Jawaani Hai Deewani", artist: "Pritam", year: "2013", category: "Party", image: "https://c.saavncdn.com/440/Yeh-Jawaani-Hai-Deewani-2013-500x500.jpg" },
      { id: "49986024", title: "ANIMAL", artist: "JAM8, Vishal Mishra, Manan Bhardwaj", year: "2023", category: "Trending", image: "https://c.saavncdn.com/092/ANIMAL-Hindi-2023-20260724191152-500x500.jpg" },
      { id: "48037104", title: "Jawan", artist: "Anirudh Ravichander", year: "2023", category: "Trending", image: "https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg" },
      { id: "29060166", title: "Shershaah", artist: "Tanishk Bagchi, Jasleen Royal, B Praak", year: "2021", category: "Romance", image: "https://c.saavncdn.com/238/Shershaah-Original-Motion-Picture-Soundtrack--Hindi-2021-20210815181610-500x500.jpg" },
      { id: "1120992", title: "Dilwale Dulhania Le Jayenge", artist: "Jatin-Lalit", year: "1995", category: "90s & 2000s", image: "https://c.saavncdn.com/588/Dilwale-Dulhania-Le-Jayenge-Hindi-1995-20171114-500x500.jpg" },
      { id: "1031364", title: "Jab We Met", artist: "Pritam, Sandesh Sandilya", year: "2007", category: "90s & 2000s", image: "https://c.saavncdn.com/223/Jab-We-Met-Hindi-2007-20231016162009-500x500.jpg" },
      { id: "38845390", title: "Brahmastra", artist: "Pritam, Amitabh Bhattacharya", year: "2022", category: "Romance", image: "https://c.saavncdn.com/871/Brahmastra-Original-Motion-Picture-Soundtrack-Hindi-2022-20221006155213-500x500.jpg" },
      { id: "2597301", title: "Ae Dil Hai Mushkil", artist: "Pritam", year: "2016", category: "Sad Hits", image: "https://c.saavncdn.com/257/Ae-Dil-Hai-Mushkil-Hindi-2016-500x500.jpg" },
      { id: "12606087", title: "Kal Ho Naa Ho", artist: "Shankar-Ehsaan-Loy", year: "2003", category: "90s & 2000s", image: "https://c.saavncdn.com/587/Kal-Ho-Naa-Ho-Hindi-2003-20190516130956-500x500.jpg" },
      { id: "1129607", title: "Sanam Teri Kasam", artist: "Himesh Reshammiya", year: "2008", category: "Sad Hits", image: "https://c.saavncdn.com/689/Sanam-Teri-Kasam-Hindi-2008-20260820195719-500x500.jpg" },
      { id: "32809777", title: "Gangubai Kathiawadi", artist: "Sanjay Leela Bhansali", year: "2022", category: "Trending", image: "https://c.saavncdn.com/544/Gangubai-Kathiawadi-Hindi-2022-20220217161339-500x500.jpg" },
      { id: "41039709", title: "Pathaan", artist: "Vishal & Shekhar", year: "2022", category: "Party", image: "https://c.saavncdn.com/807/Pathaan-Hindi-2022-20221222104158-500x500.jpg" },
      { id: "50592774", title: "Dunki", artist: "Pritam", year: "2023", category: "Romance", image: "https://c.saavncdn.com/139/Dunki-Hindi-2023-20231220211003-500x500.jpg" },
      { id: "51763191", title: "Fighter", artist: "Vishal & Shekhar", year: "2024", category: "Party", image: "https://c.saavncdn.com/142/Fighter-Hindi-2024-20240701191023-500x500.jpg" },
      { id: "57019500", title: "Stree 2", artist: "Sachin-Jigar", year: "2024", category: "Trending", image: "https://c.saavncdn.com/373/Stree-2-Hindi-2024-20240828083834-500x500.jpg" },
      { id: "15233952", title: "Kesari", artist: "Tanishk Bagchi, Arko, Jasleen Royal", year: "2019", category: "Trending", image: "https://c.saavncdn.com/991/Kesari-Hindi-2019-20250617065847-500x500.jpg" },
      { id: "10601320", title: "Half Girlfriend", artist: "Mithoon, Tanishk Bagchi", year: "2017", category: "Romance", image: "https://c.saavncdn.com/441/Half-Girlfriend-Hindi-2017-20180622-500x500.jpg" },
      { id: "10660301", title: "Raabta", artist: "Pritam, JAM8", year: "2017", category: "Romance", image: "https://c.saavncdn.com/023/Raabta-Hindi-2017-500x500.jpg" }
    ];

    res.json({ success: true, playlists: featuredPlaylists, albums: trendingAlbums });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recognize Song (Audio Fingerprinting via Shazam API)
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const { Shazam, s16LEToSamplesArray } = require("shazam-api");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const shazam = new Shazam();

app.post("/api/recognize", async (req, res) => {
  const tempWebm = path.join(os.tmpdir(), `temp_${Date.now()}.webm`);
  const tempPcm = path.join(os.tmpdir(), `temp_${Date.now()}.pcm`);

  try {
    const { audioData } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ success: false, error: "No audio data provided" });
    }

    console.log("🎤 Received audio for recognition... Processing with Free Shazam API");

    // Fix base64 padding if necessary
    let base64String = audioData;
    // Remove data URI scheme if present (app.js should already do this)
    if (base64String.includes(',')) {
      base64String = base64String.split(',')[1];
    }
    
    // Write Base64 to webm file
    const audioBuffer = Buffer.from(base64String, "base64");
    fs.writeFileSync(tempWebm, audioBuffer);

    // Convert webm to roughly 16kHz 16-bit mono PCM using FFmpeg
    // We removed -v quiet to ensure ffmpeg runs robustly (though errors still go to stderr)
    await execPromise(`"${ffmpegPath}" -i "${tempWebm}" -ar 16000 -ac 1 -f s16le "${tempPcm}" -y`);

    // Read the PCM file and parse it for Shazam
    const pcmData = fs.readFileSync(tempPcm);
    
    if (pcmData.length === 0) {
       throw new Error("PCM audio conversion resulted in an empty file. The recorded audio might be corrupted or silent.");
    }

    const samples = s16LEToSamplesArray(pcmData);

    // Call Shazam
    const songData = await shazam.recognizeSong(samples);
    
    console.log(`Shazam recognition complete. Sent ${pcmData.length} bytes of audio.`);

    // Clean up temp files
    try {
      if (fs.existsSync(tempWebm)) fs.unlinkSync(tempWebm);
      if (fs.existsSync(tempPcm)) fs.unlinkSync(tempPcm);
    } catch (cleanErr) {}

    // Parse Response
    if (songData && songData.track) {
        console.log(`🎶 Recognized: ${songData.track.title} by ${songData.track.subtitle}`);
        res.json({
            success: true,
            title: songData.track.title,
            artist: songData.track.subtitle,
            album: songData.track.sections?.find(s => s.type === "SONG")?.metadata?.find(m => m.title === "Album")?.text
        });
    } else {
        console.error("Shazam API No Result. PCM Size:", pcmData.length);
        res.status(404).json({ 
            success: false, 
            error: `Song not recognized. (Audio received: ${Math.round(pcmData.length / 1024)} KB). Make sure you are playing the ORIGINAL song from a speaker.` 
        });
    }
  } catch (err) {
    console.error("Recognize Route Error:", err.message);
    
    // Clean up temp files on error
    try {
      if (fs.existsSync(tempWebm)) fs.unlinkSync(tempWebm);
      if (fs.existsSync(tempPcm)) fs.unlinkSync(tempPcm);
    } catch (cleanErr) {}

    res.status(500).json({ success: false, error: "Server error during recognition" });
  }
});

// Serve static files AFTER API routes (prefer Vite dist build, fallback to public)
const staticDir = fs.existsSync(path.join(__dirname, "dist"))
  ? path.join(__dirname, "dist")
  : path.join(__dirname, "public");

app.use(express.static(staticDir));

// Catch-all: serve index.html for all non-API GET requests
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(staticDir, "index.html"));
  }
  next();
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 MelodySphere Backend Running at http://localhost:${PORT}`);
  });
}

module.exports = app;