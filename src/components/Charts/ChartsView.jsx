import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';

function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default function ChartsView() {
  const [topArtists, setTopArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setPendingArtistSearch, setCurrentView } = useUI();

  useEffect(() => {
    async function loadCharts() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/charts');
        const data = await res.json();
        if (data.artists && data.artists.artist) {
          setTopArtists(data.artists.artist.slice(0, 16));
        }
      } catch (err) {
        console.warn('Failed to load charts:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCharts();
  }, []);

  const handleSelectArtist = (name) => {
    if (setPendingArtistSearch) {
      setPendingArtistSearch(name);
    }
    setCurrentView('search');
  };

  return (
    <div id="chartsView">
      <div className="charts-section">
        <div className="section-header">
          <div className="section-title">
            <i className="fas fa-chart-line"></i> Global Top Artists
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
                  <div style={{ fontSize: '12px', color: '#666' }}>
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

