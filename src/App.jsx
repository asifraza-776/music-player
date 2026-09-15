import React from 'react';
import { UIProvider, useUI } from './context/UIContext';
import { LibraryProvider } from './context/LibraryContext';
import { PlayerProvider } from './context/PlayerContext';
import Header from './components/Header';
import SearchView from './components/Search/SearchView';
import ExploreView from './components/Explore/ExploreView';
import ChartsView from './components/Charts/ChartsView';
import LibraryView from './components/Library/LibraryView';
import MusicPlayer from './components/Player/MusicPlayer';
import CollectionModal from './components/Modals/CollectionModal';
import LyricsModal from './components/Modals/LyricsModal';
import SleepTimerModal from './components/Modals/SleepTimerModal';
import { CreatePlaylistModal, AddToPlaylistModal } from './components/Modals/PlaylistModals';
import ToastContainer from './components/ToastContainer';

function MainContent() {
  const { currentView } = useUI();

  return (
    <>
      <Header />
      <div className="container">
        <div className="hero">
          <h1>
            <i className="fas fa-headphones"></i> Discover Amazing Music
          </h1>
          <p>Search for artists, explore top tracks, albums, playlists, and enjoy ad-free music</p>
        </div>

        {currentView === 'search' && <SearchView />}
        {currentView === 'explore' && <ExploreView />}
        {currentView === 'charts' && <ChartsView />}
        {currentView === 'library' && <LibraryView />}
      </div>

      <div className="footer">
        <p>
          <i className="fas fa-heart" style={{ color: 'var(--neon-pink)' }}></i> MelodySphere | Pure Ad-Free Music Discovery | Free Forever
        </p>
      </div>

      {/* Global Modals */}
      <CollectionModal />
      <LyricsModal />
      <SleepTimerModal />
      <CreatePlaylistModal />
      <AddToPlaylistModal />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Sticky Bottom Audio Player */}
      <MusicPlayer />
    </>
  );
}

export default function App() {
  return (
    <UIProvider>
      <LibraryProvider>
        <PlayerProvider>
          <MainContent />
        </PlayerProvider>
      </LibraryProvider>
    </UIProvider>
  );
}
