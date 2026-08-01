const express = require("express");
const path = require("path");
const os = require("os");
require("dotenv").config();
const app = express();

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
    
    const topAlbums = albumsData.topalbums?.album?.slice(0, 8).map(album => ({
      name: album.name,
      playcount: album.playcount,
      url: album.url,
      image: album.image?.[3]?.["#text"] || null
    })) || [];

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

// Search Track
app.get("/api/track/search", async (req, res) => {
  try {
    const track = req.query.q || "Tum Hi Ho";
    const artist = req.query.artist || "";
    console.log(`Searching for track: ${track}`);
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json${artist ? `&artist=${encodeURIComponent(artist)}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();
    const tracks = data.results?.trackmatches?.track || [];
    res.json({ success: true, results: tracks });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Charts (Top Artists with Images)
app.get("/api/charts", async (req, res) => {
  try {
    console.log("📈 Fetching Top Charts...");
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${LASTFM_API_KEY}&format=json&limit=16`
    );
    const data = await response.json();
    
    if (data.artists?.artist) {
       // Fetch images in parallel for speed
       const artistsWithImages = await Promise.all(data.artists.artist.map(async (artist) => {
          const image = await getArtistImage(artist.name);
          return { ...artist, image: image };
       }));
       data.artists.artist = artistsWithImages;
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Recognize Song (Audio Fingerprinting via Shazam API)
const fs = require("fs");
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

// Serve static files AFTER API routes
app.use(express.static("public"));

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🚀 MelodySphere Backend Running at http://localhost:${PORT}`);
  });
}

module.exports = app;