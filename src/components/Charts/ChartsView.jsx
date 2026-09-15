import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function ChartsView() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'india' | 'pakistan'
  const [topArtists, setTopArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setPendingArtistSearch, setCurrentView } = useUI();

  useEffect(() => {
    async function loadCharts() {
      setIsLoading(true);
      try {
        const url = activeTab === 'all' ? '/api/charts' : `/api/charts?country=${activeTab}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.artists && data.artists.artist) {
          setTopArtists(data.artists.artist);
        }
      } catch (err) {
        console.warn('Failed to load charts:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCharts();
  }, [activeTab]);

  const handleSelectArtist = (name) => {
    if (setPendingArtistSearch) {
      setPendingArtistSearch(name);
    }
    setCurrentView('search');
  };

  return (
    <div id="chartsView">
      <div className="charts-section">
        <div className="section-header" style={{ flexWrap: 'wrap', gap: '15px' }}>
          <div className="section-title">
            <i className="fas fa-chart-line"></i> Top Artists (India & Pakistan)
          </div>
          <div className="search-tabs" style={{ marginBottom: 0, gap: '8px' }}>
            <button
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
              style={{ padding: '8px 18px', fontSize: '13.5px' }}
            >
              🔥 All Top Artists ({topArtists.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'india' ? 'active' : ''}`}
              onClick={() => setActiveTab('india')}
              style={{ padding: '8px 18px', fontSize: '13.5px' }}
            >
              🇮🇳 India
            </button>
            <button
              className={`tab-btn ${activeTab === 'pakistan' ? 'active' : ''}`}
              onClick={() => setActiveTab('pakistan')}
              style={{ padding: '8px 18px', fontSize: '13.5px' }}
            >
              🇵🇰 Pakistan
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="charts-grid" id="chartsGrid">
            <div className="loading" style={{ display: 'block' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '10px' }}>Loading top artists...</p>
            </div>
          </div>
        ) : (
          <div className="charts-grid" id="chartsGrid">
            {topArtists.map((artist, index) => {
              const imgUrl = artist.image || 'https://via.placeholder.com/150?text=Artist';
              const countryFlag = artist.country === 'pakistan' ? '🇵🇰 Pakistan' : '🇮🇳 India';
              return (
                <div
                  key={artist.name || index}
                  className="chart-item"
                  onClick={() => handleSelectArtist(artist.name)}
                >
                  <div className="chart-rank">#{index + 1}</div>
                  <img
                    src={imgUrl}
                    className="chart-img"
                    alt={artist.name}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/150?text=Artist';
                    }}
                  />
                  <div className="chart-name">{artist.name}</div>
                  {artist.tag && (
                    <div style={{ fontSize: '11px', color: 'var(--neon-cyan)', marginTop: '4px', fontWeight: '500' }}>
                      {countryFlag} • {artist.tag}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#a0a0b0', marginTop: '3px' }}>
                    {formatNumber(artist.listeners || artist.playcount)} listeners
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

