import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LibraryContext = createContext();

export function getUserId() {
  let uid = localStorage.getItem('melodysphere_user_id');
  if (!uid) {
    uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('melodysphere_user_id', uid);
  }
  return uid;
}

export function userApiFetch(url, options = {}) {
  options = { ...options };
  options.headers = { ...(options.headers || {}), 'x-user-id': getUserId() };
  return fetch(url, options);
}

export function LibraryProvider({ children }) {
  const [library, setLibrary] = useState(() => {
    try {
      const saved = localStorage.getItem('melodysphere_library');
      if (saved) return JSON.parse(saved);
      const oldFavs = localStorage.getItem('melodysphere_favorites');
      if (oldFavs) {
        return { likedTracks: JSON.parse(oldFavs), likedAlbums: [], likedPlaylists: [], customPlaylists: [] };
      }
    } catch (e) {}
    return { likedTracks: [], likedAlbums: [], likedPlaylists: [], customPlaylists: [] };
  });

  const saveLocal = (updated) => {
    try {
      localStorage.setItem('melodysphere_library', JSON.stringify(updated));
      localStorage.setItem('melodysphere_favorites', JSON.stringify(updated.likedTracks || []));
    } catch (e) {}
  };

  // Sync with backend on startup
  useEffect(() => {
    async function syncBackend() {
      try {
        const res = await userApiFetch('/api/user/library');
        const data = await res.json();
        if (data.success) {
          const fresh = {
            likedTracks: data.likedTracks || [],
            likedAlbums: data.likedAlbums || [],
            likedPlaylists: data.likedPlaylists || [],
            customPlaylists: data.customPlaylists || [],
          };
          setLibrary(fresh);
          saveLocal(fresh);
        }
      } catch (err) {
        console.warn('Backend sync failed, running offline:', err);
      }
    }
    syncBackend();
  }, []);

  const isTrackLiked = useCallback((track, artist) => {
    if (!track) return false;
    const tLower = (track || '').toLowerCase().trim();
    const aLower = (artist || '').toLowerCase().trim();
    return (library.likedTracks || []).some((t) => {
      const itemTrack = (t?.track || t?.title || (typeof t === 'string' ? t : '') || '').toLowerCase().trim();
      const itemArtist = (t?.artist || t?.singers || '').toLowerCase().trim();
      return itemTrack === tLower && (!aLower || !itemArtist || itemArtist === aLower);
    });
  }, [library.likedTracks]);

  const isAlbumLiked = useCallback((id, title) => {
    return (library.likedAlbums || []).some(
      (a) => (id && a?.id && a.id === id) || (title && a?.title && a.title.toLowerCase().trim() === (title || '').toLowerCase().trim())
    );
  }, [library.likedAlbums]);

  const isPlaylistLiked = useCallback((id, title) => {
    return (library.likedPlaylists || []).some(
      (p) => (id && p?.id && p.id === id) || (title && p?.title && p.title.toLowerCase().trim() === (title || '').toLowerCase().trim())
    );
  }, [library.likedPlaylists]);

  const toggleTrackLike = useCallback(async (track, artist, image = '') => {
    if (!track) return;
    const tLower = (track || '').toLowerCase().trim();
    const aLower = (artist || '').toLowerCase().trim();

    setLibrary((prev) => {
      const list = [...(prev.likedTracks || [])];
      const idx = list.findIndex((t) => {
        const itemTrack = (t?.track || t?.title || (typeof t === 'string' ? t : '') || '').toLowerCase().trim();
        const itemArtist = (t?.artist || t?.singers || '').toLowerCase().trim();
        return itemTrack === tLower && (!aLower || !itemArtist || itemArtist === aLower);
      });
      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        list.unshift({ track, artist: artist || '', image: image || '', id: '' });
      }
      const updated = { ...prev, likedTracks: list };
      saveLocal(updated);
      return updated;
    });

    try {
      await userApiFetch('/api/user/library/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'track', item: { track, artist, image } }),
      });
    } catch (e) {}
  }, []);

  const toggleAlbumLike = useCallback(async (album) => {
    if (!album) return;
    setLibrary((prev) => {
      const list = [...(prev.likedAlbums || [])];
      const idx = list.findIndex(
        (a) => (album.id && a?.id && a.id === album.id) || (a?.title && album.title && a.title.toLowerCase().trim() === album.title.toLowerCase().trim())
      );
      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        list.unshift(album);
      }
      const updated = { ...prev, likedAlbums: list };
      saveLocal(updated);
      return updated;
    });

    try {
      await userApiFetch('/api/user/library/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'album', item: album }),
      });
    } catch (e) {}
  }, []);

  const togglePlaylistLike = useCallback(async (playlist) => {
    if (!playlist) return;
    setLibrary((prev) => {
      const list = [...(prev.likedPlaylists || [])];
      const idx = list.findIndex(
        (p) => (playlist.id && p?.id && p.id === playlist.id) || (p?.title && playlist.title && p.title.toLowerCase().trim() === playlist.title.toLowerCase().trim())
      );
      if (idx > -1) {
        list.splice(idx, 1);
      } else {
        list.unshift(playlist);
      }
      const updated = { ...prev, likedPlaylists: list };
      saveLocal(updated);
      return updated;
    });

    try {
      await userApiFetch('/api/user/library/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'playlist', item: playlist }),
      });
    } catch (e) {}
  }, []);

  const createPlaylist = useCallback(async (name, description = '') => {
    try {
      const res = await userApiFetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (data.success && data.playlist) {
        setLibrary((prev) => {
          const updated = { ...prev, customPlaylists: data.playlists || prev.customPlaylists };
          saveLocal(updated);
          return updated;
        });
        return data.playlist;
      }
    } catch (e) {}
    return null;
  }, []);

  const deletePlaylist = useCallback(async (playlistId) => {
    try {
      const res = await userApiFetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLibrary((prev) => {
          const updated = { ...prev, customPlaylists: data.playlists };
          saveLocal(updated);
          return updated;
        });
      }
    } catch (e) {}
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId, track) => {
    try {
      const res = await userApiFetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      });
      const data = await res.json();
      if (data.success) {
        setLibrary((prev) => {
          const list = [...(prev.customPlaylists || [])];
          const idx = list.findIndex((p) => p.id === playlistId);
          if (idx > -1) list[idx] = data.playlist;
          const updated = { ...prev, customPlaylists: list };
          saveLocal(updated);
          return updated;
        });
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to add track' };
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId, trackIndex) => {
    try {
      const res = await userApiFetch(`/api/playlists/${playlistId}/tracks/${trackIndex}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLibrary((prev) => {
          const list = [...(prev.customPlaylists || [])];
          const idx = list.findIndex((p) => p.id === playlistId);
          if (idx > -1) list[idx] = data.playlist;
          const updated = { ...prev, customPlaylists: list };
          saveLocal(updated);
          return updated;
        });
      }
    } catch (e) {}
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        library,
        isTrackLiked,
        isAlbumLiked,
        isPlaylistLiked,
        toggleTrackLike,
        toggleAlbumLike,
        togglePlaylistLike,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
