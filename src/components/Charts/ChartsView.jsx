import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';

export default function ChartsView() {
  const [topArtists, setTopArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setCurrentView } = useUI();

  useEffect(() => {
    async function loadCharts() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/charts');
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
  }, []);

  return (
    <div id="chartsView">
      <div className="charts-section">
        <div className="section-header">
          <div className="section-title">
            <i className="fas fa-chart-line"></i> Global Top Artists
          </div>
        </div>

        {isLoading ? (
          <div className="loading" style={{ display: 'block', padding: '40px' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '10px' }}>Loading top charts...</p>
          </div>
        ) : (
          <div className="charts-grid">
            {topArtists.map((artist, idx) => {
              const img = artist.image && artist.image[2] && artist.image[2]['#text']
                ? artist.image[2]['#text']
                : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';

              return (
                <div
                  key={idx}
                  className="chart-card"
                  onClick={() => {
                    setCurrentView('search');
                  }}
                >
                  <div className="chart-card-img-wrap">
                    <img src={img} alt={artist.name} className="chart-card-img" />
                    <div className="chart-rank-badge">#{idx + 1}</div>
                  </div>
                  <div className="chart-card-info">
                    <div className="chart-card-name">{artist.name}</div>
                    <div className="chart-card-stats">
                      <i className="fas fa-headphones"></i> {parseInt(artist.listeners || 0).toLocaleString()} listeners
                    </div>
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
