import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
  const [currentView, setCurrentView] = useState('explore');
  const [activeModal, setActiveModal] = useState(null); // 'collection' | 'lyrics' | 'sleep' | 'createPl' | 'addToPl'
  const [modalData, setModalData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
      setCanInstallPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const installPWA = useCallback(async () => {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    const { outcome } = await deferredPwaPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPWA(false);
      setDeferredPwaPrompt(null);
    }
  }, [deferredPwaPrompt]);

  // Toast Notification Dispatcher
  const showToast = useCallback((title, subtitle = '', type = 'info') => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const newToast = { id, title, subtitle, type, leaving: false };

    setToasts((prev) => [...prev.slice(-3), newToast]); // max 4 toasts

    setTimeout(() => {
      // Mark as leaving for smooth exit animation
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 2800);
  }, []);

  const openModal = useCallback((type, data = null) => {
    setActiveModal(type);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  const [pendingArtistSearch, setPendingArtistSearch] = useState('');

  return (
    <UIContext.Provider
      value={{
        currentView,
        setCurrentView,
        pendingArtistSearch,
        setPendingArtistSearch,
        activeModal,
        modalData,
        openModal,
        closeModal,
        toasts,
        showToast,
        canInstallPWA,
        installPWA,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
