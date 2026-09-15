import React from 'react';
import { useUI } from '../context/UIContext';

export default function Header() {
  const { currentView, setCurrentView, canInstallPWA, installPWA } = useUI();

  return (
    <div className="navbar">
      <div className="container navbar-container">
        <div className="header-content">
          <div className="logo-row">
            <div className="logo" onClick={() => setCurrentView('explore')} style={{ cursor: 'pointer' }}>
              <i className="fas fa-music"></i> Melody
              <span style={{ background: 'linear-gradient(135deg, #ffe6f0, #ffb6c1)', WebkitBackgroundClip: 'text' }}>
                Sphere
              </span>
            </div>
            {canInstallPWA && (
              <button id="pwaInstallBtn" className="pwa-header-btn" onClick={installPWA}>
                <i className="fas fa-download"></i> <span className="pwa-btn-text">Install App</span>
              </button>
            )}
          </div>
          <div className="nav-links">
            <button
              className={`nav-btn ${currentView === 'explore' ? 'active' : ''}`}
              data-view="explore"
              onClick={() => setCurrentView('explore')}
            >
              <i className="fas fa-compass"></i> <span>Explore</span>
            </button>
            <button
              className={`nav-btn ${currentView === 'search' ? 'active' : ''}`}
              data-view="search"
              onClick={() => setCurrentView('search')}
            >
              <i className="fas fa-search"></i> <span>Search</span>
            </button>
            <button
              className={`nav-btn ${currentView === 'charts' ? 'active' : ''}`}
              data-view="charts"
              onClick={() => setCurrentView('charts')}
            >
              <i className="fas fa-chart-line"></i> <span>Charts</span>
            </button>
            <button
              className={`nav-btn ${currentView === 'library' ? 'active' : ''}`}
              data-view="library"
              onClick={() => setCurrentView('library')}
            >
              <i className="fas fa-heart"></i>
              <span className="nav-text-desktop">Liked & Library</span>
              <span className="nav-text-mobile">Library</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
