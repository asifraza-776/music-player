import React, { useState, useEffect } from 'react';
import { useUI } from '../../context/UIContext';
import { usePlayer } from '../../context/PlayerContext';

export default function SleepTimerModal() {
  const { activeModal, closeModal, showToast } = useUI();
  const { sleepTimer, startSleepTimer, cancelSleepTimer, currentTrack } = usePlayer();

  const [customMins, setCustomMins] = useState('');
  const [countdownText, setCountdownText] = useState('');

  useEffect(() => {
    if (!sleepTimer) {
      setCountdownText('');
      return;
    }

    if (sleepTimer.mode === 'end-of-song') {
      setCountdownText('End of Song');
      return;
    }

    if (sleepTimer.mode === 'minutes' && sleepTimer.endTime) {
      const update = () => {
        const remainingSec = Math.max(0, Math.floor((sleepTimer.endTime - Date.now()) / 1000));
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        setCountdownText(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    }
  }, [sleepTimer]);

  if (activeModal !== 'sleep') return null;

  const handleSetTimer = (duration) => {
    if (duration === 'end-of-song') {
      if (!currentTrack) {
        showToast('Please play a song first', '', 'warning');
        return;
      }
      startSleepTimer('end-of-song');
      showToast('Audio will stop after this song', '', 'info');
      closeModal();
      return;
    }

    startSleepTimer(duration);
    showToast(`Sleep timer set for ${duration} mins`, '', 'info');
    closeModal();
  };

  const handleCustomSet = () => {
    const mins = parseInt(customMins);
    if (!mins || mins < 1 || mins > 360) {
      showToast('Enter minutes between 1 and 360', '', 'warning');
      return;
    }
    handleSetTimer(mins);
    setCustomMins('');
  };

  const handleCancel = () => {
    cancelSleepTimer();
    showToast('Sleep timer turned OFF', '', 'info');
  };

  return (
    <div
      id="sleepTimerModal"
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal-card sleep-modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="sleep-header-icon">
              <i className="fas fa-moon"></i>
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Sleep Timer</h3>
              <p id="sleepTimerSubhead" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {sleepTimer ? (sleepTimer.mode === 'end-of-song' ? 'Stopping after current track' : `Stopping in ${countdownText}`) : 'Turn off music automatically'}
              </p>
            </div>
          </div>
          <i className="fas fa-times close-modal" onClick={closeModal}></i>
        </div>

        <div className="modal-body sleep-modal-body">
          {sleepTimer && (
            <div id="sleepActiveBanner" className="sleep-active-banner" style={{ display: 'flex' }}>
              <div className="sleep-banner-left">
                <div className="sleep-banner-label">
                  <i className="fas fa-hourglass-half"></i> Timer Active
                </div>
                <div className="sleep-countdown" id="sleepCountdownDisplay">
                  {countdownText}
                </div>
              </div>
              <button className="sleep-cancel-btn" onClick={handleCancel}>
                <i className="fas fa-stop"></i> Turn Off
              </button>
            </div>
          )}

          <div className="sleep-options-title">SELECT DURATION</div>
          <div className="sleep-options-grid">
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(5)}>
              <i className="far fa-clock"></i> 5 Minutes
            </button>
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(10)}>
              <i className="far fa-clock"></i> 10 Minutes
            </button>
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(15)}>
              <i className="far fa-clock"></i> 15 Minutes
            </button>
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(30)}>
              <i className="far fa-clock"></i> 30 Minutes
            </button>
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(45)}>
              <i className="far fa-clock"></i> 45 Minutes
            </button>
            <button className="sleep-opt-btn" onClick={() => handleSetTimer(60)}>
              <i className="far fa-clock"></i> 60 Minutes
            </button>
            <button className="sleep-opt-btn sleep-opt-special" onClick={() => handleSetTimer('end-of-song')}>
              <i className="fas fa-flag-checkered"></i> End of this Song
            </button>
          </div>

          <div className="sleep-custom-box">
            <label className="sleep-custom-label">
              <i className="fas fa-sliders-h"></i> Custom Minutes
            </label>
            <div className="sleep-custom-row">
              <input
                type="number"
                id="customSleepInput"
                min="1"
                max="360"
                placeholder="e.g. 25"
                className="sleep-input"
                value={customMins}
                onChange={(e) => setCustomMins(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSet()}
              />
              <button className="sleep-set-btn" onClick={handleCustomSet}>
                <i className="fas fa-check"></i> Set
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
