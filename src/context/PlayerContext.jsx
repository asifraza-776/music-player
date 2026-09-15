import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUI } from './UIContext';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const { showToast } = useUI();
  const [currentTrack, setCurrentTrack] = useState(null); // { track, artist, image, id }
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const [isLoading, setIsLoading] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [playbackSource, setPlaybackSource] = useState(null); // 'jiosaavn' | 'youtube'
  const [ambientGlow, setAmbientGlow] = useState('rgba(0, 242, 254, 0.4)');
  const [sleepTimer, setSleepTimerState] = useState(null); // { mode: 'minutes', endTime } | { mode: 'end-of-song' }

  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const isChangingSongRef = useRef(false);
  const lastPrevTapRef = useRef(0);

  // Sync refs to prevent stale closures in event listeners
  const playlistQueueRef = useRef([]);
  const currentTrackIndexRef = useRef(-1);
  const repeatModeRef = useRef('off');
  const isShuffleRef = useRef(false);
  const playbackSourceRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const currentTrackRef = useRef(null);
  const unplayedShuffleIndicesRef = useRef([]);
  const handleTrackEndedRef = useRef();

  useEffect(() => {
    playlistQueueRef.current = playlistQueue;
  }, [playlistQueue]);
  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);
  useEffect(() => {
    playbackSourceRef.current = playbackSource;
  }, [playbackSource]);
  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  }, [sleepTimer]);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Initialize HTML5 Audio & YouTube IFrame
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (!isChangingSongRef.current) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      if (isChangingSongRef.current) return;
      if (handleTrackEndedRef.current) handleTrackEndedRef.current();
    };

    const handleError = () => {
      if (isChangingSongRef.current) return;
      console.warn('HTML5 Audio error, falling back to YouTube if active track exists');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Initialize YouTube IFrame API
    window.onYouTubeIframeAPIReady = () => {
      ytPlayerRef.current = new window.YT.Player('youtubePlayer', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              if (handleTrackEndedRef.current) handleTrackEndedRef.current();
            }
          },
        },
      });
    };

    // If YT API already loaded
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Sync OS MediaSession
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.track,
        artist: currentTrack.artist,
        artwork: currentTrack.image ? [{ src: currentTrack.image, sizes: '512x512', type: 'image/jpeg' }] : [],
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    }
  }, [currentTrack]);

  // Extract Ambient Glow from Image
  const computeAmbientGlow = (imgUrl) => {
    if (!imgUrl) {
      setAmbientGlow('rgba(0, 242, 254, 0.4)');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] + data[i + 1] + data[i + 2] > 60) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        if (count > 0) {
          setAmbientGlow(`rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, 0.5)`);
        }
      } catch (e) {
        setAmbientGlow('rgba(0, 242, 254, 0.4)');
      }
    };
  };

  // Play a song by track and artist
  const playMusic = useCallback(async (track, artist, image = '', queue = null, index = -1) => {
    if (!track) return;
    isChangingSongRef.current = true;
    setIsLoading(true);
    setIsPlayerVisible(true);

    const targetIdx = index >= 0 ? index : 0;
    const queueId = (queue && queue[targetIdx]?.id) ? queue[targetIdx].id : null;
    const newMeta = { track, artist, image, id: queueId };
    setCurrentTrack(newMeta);
    computeAmbientGlow(image);

    if (queue && queue.length > 0) {
      setPlaylistQueue(queue);
      setCurrentTrackIndex(targetIdx);
      if (isShuffleRef.current) {
        unplayedShuffleIndicesRef.current = queue
          .map((_, i) => i)
          .filter((i) => i !== targetIdx);
      }
    }

    // Stop existing audio sources cleanly
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch (e) {}
    }

    try {
      // 1. Try JioSaavn direct high quality stream
      const searchRes = await fetch(`/api/saavn/search?q=${encodeURIComponent(track + ' ' + artist)}`);
      const searchData = await searchRes.json();

      let streamUrl = null;
      let finalImg = image;
      let songId = null;
      let hasLyrics = false;

      if (searchData.success && searchData.streamUrl) {
        streamUrl = searchData.streamUrl;
        songId = searchData.id || null;
        hasLyrics = !!searchData.has_lyrics;
        if (!finalImg && searchData.image) finalImg = searchData.image;
        setCurrentTrack({
          track: searchData.title || track,
          artist: searchData.artist || artist,
          image: finalImg,
          id: songId,
          streamUrl: searchData.streamUrl,
          hasLyrics,
        });
      } else if (searchData.results && searchData.results.length > 0) {
        const topResult = searchData.results[0];
        if (!finalImg && topResult.image) finalImg = topResult.image;
        songId = topResult.id || null;
        hasLyrics = !!topResult.has_lyrics;

        const streamRes = await fetch(`/api/saavn/stream?id=${topResult.id}`);
        const streamData = await streamRes.json();
        if (streamData.streamUrl) {
          streamUrl = streamData.streamUrl;
        }
        setCurrentTrack({
          track: topResult.title || track,
          artist: topResult.artist || artist,
          image: finalImg,
          id: songId,
          streamUrl: streamUrl,
          hasLyrics,
        });
      }

      if (finalImg && finalImg !== image) {
        setCurrentTrack((prev) => ({ ...prev, image: finalImg }));
        computeAmbientGlow(finalImg);
      }

      if (streamUrl && audioRef.current) {
        setPlaybackSource('jiosaavn');
        audioRef.current.src = streamUrl;
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        isChangingSongRef.current = false;
        return;
      }

      // 2. Fallback to YouTube
      console.log('JioSaavn stream not found, using YouTube fallback...');
      const ytRes = await fetch(`/api/yt/search?q=${encodeURIComponent(track + ' ' + artist)}`);
      const ytData = await ytRes.json();

      if (ytData.videoId && ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
        setPlaybackSource('youtube');
        ytPlayerRef.current.loadVideoById(ytData.videoId);
        setIsPlaying(true);
        setCurrentTrack((prev) => ({
          ...prev,
          track,
          artist,
          image: finalImg,
          youtubeId: ytData.videoId,
        }));
      } else {
        console.warn('Could not play track from either JioSaavn or YouTube');
      }
    } catch (err) {
      console.error('Play music error:', err);
    } finally {
      setIsLoading(false);
      isChangingSongRef.current = false;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (audioRef.current && audioRef.current.src) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } else if (playbackSource === 'youtube' && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } else {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      } catch (e) {}
    } else if (!isPlaying && playlistQueueRef.current.length > 0) {
      playTrackByIndex(0);
    }
  }, [playbackSource, isPlaying]);

  const playTrackByIndex = useCallback(
    (index) => {
      const queue = playlistQueueRef.current;
      if (index >= 0 && index < queue.length) {
        const item = queue[index];
        playMusic(item.track, item.artist, item.image || '', queue, index);
      }
    },
    [playMusic]
  );

  const playNext = useCallback(
    (autoEnded = false) => {
      const queue = playlistQueueRef.current;
      const currentIdx = currentTrackIndexRef.current;
      const shuffle = isShuffleRef.current;
      const repeat = repeatModeRef.current;

      if (!queue || queue.length === 0) {
        if (audioRef.current) audioRef.current.currentTime = 0;
        return;
      }

      if (shuffle && queue.length > 1) {
        if (!unplayedShuffleIndicesRef.current || unplayedShuffleIndicesRef.current.length === 0) {
          unplayedShuffleIndicesRef.current = queue
            .map((_, i) => i)
            .filter((i) => i !== currentIdx);
        }
        if (unplayedShuffleIndicesRef.current.length === 0) {
          unplayedShuffleIndicesRef.current = queue.map((_, i) => i);
        }
        const randomPick = Math.floor(Math.random() * unplayedShuffleIndicesRef.current.length);
        const nextIndex = unplayedShuffleIndicesRef.current.splice(randomPick, 1)[0];
        playTrackByIndex(nextIndex);
        return;
      }

      let nextIndex = currentIdx + 1;
      if (nextIndex >= queue.length) {
        if (autoEnded && repeat === 'off') {
          // End of queue reached and repeat is off: stop playback
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setIsPlaying(false);
          return;
        }
        nextIndex = 0; // Wrap back to first track
      }
      playTrackByIndex(nextIndex);
    },
    [playTrackByIndex]
  );

  const playPrevious = useCallback(() => {
    const now = Date.now();
    // If audio has played for more than 3 seconds and not tapped twice quickly, rewind to start
    if (audioRef.current && audioRef.current.currentTime > 3 && now - lastPrevTapRef.current > 2000) {
      audioRef.current.currentTime = 0;
      lastPrevTapRef.current = now;
      return;
    }
    if (playbackSourceRef.current === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
      try {
        const ytTime = ytPlayerRef.current.getCurrentTime();
        if (ytTime > 3 && now - lastPrevTapRef.current > 2000) {
          ytPlayerRef.current.seekTo(0, true);
          lastPrevTapRef.current = now;
          return;
        }
      } catch (e) {}
    }
    lastPrevTapRef.current = now;

    const queue = playlistQueueRef.current;
    const currentIdx = currentTrackIndexRef.current;

    if (!queue || queue.length === 0) {
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    let prevIndex = currentIdx - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    playTrackByIndex(prevIndex);
  }, [playTrackByIndex]);

  const closePlayer = useCallback(() => {
    isChangingSongRef.current = true;
    setIsPlaying(false);
    setIsPlayerVisible(false);
    setCurrentTrack(null);
    setSleepTimerState(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      try {
        ytPlayerRef.current.stopVideo();
        ytPlayerRef.current.pauseVideo();
      } catch (e) {}
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  }, []);

  const handleTrackEnded = useCallback(() => {
    const timer = sleepTimerRef.current;
    if (timer?.mode === 'end-of-song') {
      setSleepTimerState(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
      }
      setIsPlaying(false);
      if (showToast) showToast('Song ended. Sleep timer stopped playback! 🌙', '', 'info');
      return;
    }

    const repeat = repeatModeRef.current;
    const source = playbackSourceRef.current;

    if (repeat === 'one') {
      if (source === 'jiosaavn' && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else if (source === 'youtube' && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(0);
        ytPlayerRef.current.playVideo();
      }
    } else {
      playNext(true);
    }
  }, [playNext, showToast]);

  // Keep ref up to date
  handleTrackEndedRef.current = handleTrackEnded;

  const seek = useCallback(
    (percentage) => {
      const targetTime = (percentage / 100) * (duration || 0);
      if (playbackSource === 'jiosaavn' && audioRef.current) {
        audioRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
      } else if (playbackSource === 'youtube' && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.seekTo(targetTime, true);
          setCurrentTime(targetTime);
        } catch (e) {}
      }
    },
    [duration, playbackSource]
  );

  const changeVolume = useCallback((val) => {
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) audioRef.current.volume = val / 100;
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try {
        ytPlayerRef.current.setVolume(val);
      } catch (e) {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      changeVolume(50);
    } else {
      changeVolume(0);
    }
  }, [isMuted, changeVolume]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      const queue = playlistQueueRef.current;
      const currentIdx = currentTrackIndexRef.current;
      if (next && queue.length > 0) {
        unplayedShuffleIndicesRef.current = queue
          .map((_, i) => i)
          .filter((i) => i !== currentIdx);
      } else {
        unplayedShuffleIndicesRef.current = [];
      }
      return next;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // Sleep Timer countdown listener
  useEffect(() => {
    if (!sleepTimer || sleepTimer.mode !== 'minutes' || !sleepTimer.endTime) return;

    const timer = setInterval(() => {
      const remaining = sleepTimer.endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(timer);
        setSleepTimerState(null);
        if (audioRef.current) {
          audioRef.current.pause();
        }
        if (ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
          try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
        }
        setIsPlaying(false);
        if (showToast) showToast('Sleep timer ended. Goodnight! 🌙', '', 'info');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimer, showToast]);

  const startSleepTimer = useCallback((minsOrMode) => {
    if (minsOrMode === 'end-of-song') {
      setSleepTimerState({ mode: 'end-of-song' });
    } else {
      const mins = parseInt(minsOrMode);
      if (mins > 0) {
        setSleepTimerState({ mode: 'minutes', endTime: Date.now() + mins * 60 * 1000 });
      }
    }
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerState(null);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        isShuffle,
        repeatMode,
        isLoading,
        playlistQueue,
        currentTrackIndex,
        isPlayerVisible,
        playbackSource,
        ambientGlow,
        sleepTimer,
        startSleepTimer,
        cancelSleepTimer,
        playMusic,
        playTrackByIndex,
        togglePlay,
        playNext,
        playPrevious,
        seek,
        changeVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        closePlayer,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}
