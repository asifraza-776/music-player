import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';

export default function CollectionModal() {
  const { activeModal, modalData, closeModal, openModal } = useUI();
  const { playMusic, currentTrack, isPlaying } = usePlayer();
  const {
    isTrackLiked,
    toggleTrackLike,
    isAlbumLiked,
    toggleAlbumLike,
    isPlaylistLiked,
    togglePlaylistLike,
    removeTrackFromPlaylist,
  } = useLibrary();

  const [loading, setLoading] = useState(false);
  const [collection, setCollection] = useState(null);

  useEffect(() => {
    if (activeModal !== 'collection' || !modalData) {
      setCollection(null);
      return;
    }

    const { type, id, title, artist, description, image, tracks } = modalData;

    if (type === 'custom') {
      setCollection({
        type: 'custom',
        id,
        title: title || 'My Playlist',
        subtitle: description || 'Personal Playlist',
        image: image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
        meta: `${(tracks || []).length} Songs`,
        songs: (tracks || []).map((t) => ({
          title: t.track,
          artist: t.artist,
          image: t.image,
        })),
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setCollection({
      type,
      id,
      title,
      subtitle: artist || (type === 'album' ? 'Various Artists' : 'Curated Playlist'),
      image: image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
      meta: 'Loading tracks...',
      songs: [],
    });

    const apiUrl =
      type === 'album'
        ? `/api/saavn/album?id=${encodeURIComponent(id || '')}&title=${encodeURIComponent(title || '')}&artist=${encodeURIComponent(artist || '')}`
        : `/api/saavn/playlist?id=${encodeURIComponent(id || '')}&title=${encodeURIComponent(title || '')}`;

    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.songs && data.songs.length > 0) {
          setCollection({
            type,
            id: data.id || id,
            title: data.title || title,
            subtitle: data.artist || artist || (type === 'album' ? 'Various Artists' : 'Curated Playlist'),
            image: data.image || image,
            meta: `${data.songs.length} Tracks ${data.year ? `• ${data.year}` : ''}`,
            songs: data.songs,
          });
        }
      })
      .catch((err) => {
        console.error('Error fetching collection:', err);
      })
      .finally(() => setLoading(false));
  }, [activeModal, modalData]);

  if (activeModal !== 'collection' || !collection) return null;

  const songs = collection.songs || [];
  const queue = songs.map((s) => ({
    track: s.title || s.song,
    artist: s.artist || s.singers || '',
    image: s.image || collection.image,
  }));

  const handlePlayAll = (shuffle = false) => {
    if (queue.length === 0) return;
    if (shuffle) {
      const randIdx = Math.floor(Math.random() * queue.length);
      playMusic(queue[randIdx].track, queue[randIdx].artist, queue[randIdx].image, queue, randIdx);
    } else {
      playMusic(queue[0].track, queue[0].artist, queue[0].image, queue, 0);
    }
  };

  const isSaved =
    collection.type === 'album'
      ? isAlbumLiked(collection.id, collection.title)
      : collection.type === 'playlist'
      ? isPlaylistLiked(collection.id, collection.title)
      : false;

  const handleToggleSave = () => {
    if (collection.type === 'album') {
      toggleAlbumLike({ id: collection.id, title: collection.title, artist: collection.subtitle, image: collection.image });
    } else if (collection.type === 'playlist') {
      togglePlaylistLike({ id: collection.id, title: collection.title, image: collection.image });
    }
  };

  return (
    <div
      id="collectionModal"
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal-card collection-modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              id="collectionBadge"
              className="tag"
              style={
                collection.type === 'album'
                  ? { background: 'rgba(0,242,254,0.15)', color: 'var(--neon-cyan)', borderColor: 'var(--neon-cyan)' }
                  : { background: 'rgba(255,8,68,0.15)', color: 'var(--neon-pink)', borderColor: 'var(--neon-pink)' }
              }
            >
              {collection.type.toUpperCase()}
            </span>
            <h3 id="collectionModalHeading" style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
              {collection.type === 'album' ? 'Album Details' : collection.type === 'playlist' ? 'Playlist Details' : 'My Playlist'}
            </h3>
          </div>
          <i className="fas fa-times close-modal" onClick={closeModal}></i>
        </div>

        <div className="modal-body" id="collectionModalBody">
          <div className="collection-hero" id="collectionHero">
            <img
              id="collectionImg"
              src={collection.image}
              alt={collection.title}
              className="collection-hero-img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
              }}
            />
            <div className="collection-hero-info">
              <div id="collectionTitle" className="collection-title">
                {collection.title}
              </div>
              <div id="collectionSubtitle" className="collection-subtitle">
                {collection.subtitle}
              </div>
              <div id="collectionMeta" className="collection-meta">
                {collection.meta}
              </div>
              <div className="collection-actions">
                <button
                  className="search-btn"
                  id="collectionPlayAllBtn"
                  onClick={() => handlePlayAll(false)}
                  style={{ padding: '10px 24px', borderRadius: '25px' }}
                >
                  <i className="fas fa-play"></i> Play All
                </button>
                <button
                  className="tab-btn"
                  id="collectionShuffleBtn"
                  onClick={() => handlePlayAll(true)}
                  style={{ padding: '10px 20px', borderRadius: '25px' }}
                >
                  <i className="fas fa-random"></i> Shuffle
                </button>
                {collection.type !== 'custom' && (
                  <button
                    className="tab-btn"
                    id="collectionLikeBtn"
                    onClick={handleToggleSave}
                    style={{ padding: '10px 18px', borderRadius: '25px' }}
                  >
                    <i className={isSaved ? 'fas fa-bookmark' : 'far fa-bookmark'}></i>{' '}
                    {isSaved ? 'Saved to Library' : 'Save to Library'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="collection-tracklist" id="collectionTracklist">
            {loading ? (
              <div className="loading" style={{ display: 'block', padding: '30px' }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                <p style={{ marginTop: '10px' }}>Loading tracks...</p>
              </div>
            ) : songs.length === 0 ? (
              <p style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No tracks found in this collection.
              </p>
            ) : (
              songs.map((s, idx) => {
                const title = s.title || s.song;
                const artist = s.artist || s.singers || '';
                const songImg = s.image || collection.image;
                const isThis =
                  currentTrack &&
                  currentTrack.track.toLowerCase().trim() === title.toLowerCase().trim() &&
                  currentTrack.artist.toLowerCase().trim() === artist.toLowerCase().trim();
                const liked = isTrackLiked(title, artist);

                return (
                  <div
                    key={`${title}-${idx}`}
                    className={`track-item ${isThis ? 'track-item-playing' : ''}`}
                    style={{ padding: '10px 15px' }}
                  >
                    <div
                      className="track-thumbnail-wrap"
                      onClick={() => playMusic(title, artist, songImg, queue, idx)}
                    >
                      <img
                        src={songImg}
                        className="track-thumbnail-img"
                        alt={title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
                        }}
                      />
                    </div>
                    <div
                      className="track-info"
                      onClick={() => playMusic(title, artist, songImg, queue, idx)}
                    >
                      <div
                        className="track-name"
                        style={{
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: isThis ? 'var(--neon-cyan)' : 'inherit',
                          fontWeight: isThis ? 700 : 'normal',
                        }}
                      >
                        <span>
                          {idx + 1}. {title}
                        </span>
                        {isThis && isPlaying && (
                          <div className="equalizer-waves" style={{ display: 'inline-flex', marginLeft: '6px', height: '13px' }}>
                            <span></span>
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                        )}
                      </div>
                      <div className="track-stats" style={{ fontSize: '12px' }}>
                        <i className="fas fa-microphone"></i> {artist}
                      </div>
                    </div>
                    <div className="track-actions" style={{ gap: '10px' }}>
                      <i
                        className={liked ? 'fas fa-heart' : 'far fa-heart'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTrackLike(title, artist, songImg);
                        }}
                        style={{ color: liked ? 'var(--neon-pink)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
                        title={liked ? 'Unlike' : 'Like'}
                      ></i>
                      {collection.type === 'custom' ? (
                        <i
                          className="fas fa-trash"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTrackFromPlaylist(collection.id, idx);
                            setCollection((prev) => ({
                              ...prev,
                              songs: prev.songs.filter((_, i) => i !== idx),
                            }));
                          }}
                          style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                          title="Remove from Playlist"
                        ></i>
                      ) : (
                        <i
                          className="fas fa-plus"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal('addToPl', { track: title, artist, image: songImg });
                          }}
                          style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}
                          title="Add to Playlist"
                        ></i>
                      )}
                      <div
                        className="track-play"
                        onClick={() => playMusic(title, artist, songImg, queue, idx)}
                        style={isThis && isPlaying ? { background: 'var(--neon-cyan)', color: '#000' } : {}}
                      >
                        <i className={`fas ${isThis && isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
