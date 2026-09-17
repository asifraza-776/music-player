import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const UIContext = createContext();

export function UIProvider({ children }) {
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (['explore', 'search', 'charts', 'library'].includes(hash)) {
      return hash;
    }
    return 'explore';
  });
  const [activeModal, setActiveModal] = useState(null); // 'collection' | 'lyrics' | 'sleep' | 'createPl' | 'addToPl'
  const [modalData, setModalData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState(null);
  const [canInstallPWA, setCanInstallPWA] = useState(false);
  const [pendingArtistSearch, setPendingArtistSearch] = useState('');

  const activeModalRef = useRef(activeModal);
  const currentViewRef = useRef(currentView);

  useEffect(() => {
    activeModalRef.current = activeModal;
  }, [activeModal]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

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

  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const showExitPromptRef = useRef(false);
  useEffect(() => {
    showExitPromptRef.current = showExitPrompt;
  }, [showExitPrompt]);

  const openExitPrompt = useCallback(() => {
    setShowExitPrompt(true);
  }, []);

  const closeExitPrompt = useCallback(() => {
    setShowExitPrompt(false);
  }, []);

  const confirmExit = useCallback(() => {
    setShowExitPrompt(false);
    try {
      window.close();
    } catch (e) {}
    setTimeout(() => {
      window.history.go(-10);
    }, 50);
  }, []);

  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Bulletproof Browser History & Back Protection Listener
  useEffect(() => {
    const basePath = window.location.pathname + window.location.search;

    // 1. Distinct root base entry (browser will NEVER collapse it with #explore)
    window.history.replaceState({ isRootBase: true }, '', basePath + '#root');
    // 2. Active in-app entry
    window.history.pushState({ view: 'explore', inApp: true }, '', basePath + '#explore');

    const handlePopState = (e) => {
      const state = e.state;

      // 1. If Exit Prompt was already open and user presses back AGAIN (Double-tap exit):
      if (showExitPromptRef.current) {
        setShowExitPrompt(false);
        try { window.close(); } catch (err) {}
        window.history.go(-10);
        return;
      }

      // 2. If any modal (Playlist, Album, Lyrics, Sleep Timer) is open:
      // Back button MUST close only the modal and keep user on the current page!
      if (activeModalRef.current) {
        setActiveModal(null);
        setModalData(null);
        return;
      }

      // 3. User reached root base (#root) or pressed back from Explore:
      // This is the TOTAL BACK moment!
      if (state?.isRootBase || currentViewRef.current === 'explore' || state?.view === 'root') {
        // Instantly re-push #explore so browser NEVER exits abruptly
        window.history.pushState({ view: 'explore', inApp: true }, '', basePath + '#explore');
        setCurrentView('explore');

        // Open the Exit Confirmation Banner / Modal!
        setShowExitPrompt(true);
        if (showToastRef.current) {
          showToastRef.current('Quit MelodySphere?', 'Tap Quit or press back again to exit', 'info');
        }
        return;
      }

      // 4. Tab navigation back/forward (Library / Search / Charts -> Explore)
      if (state?.view && state.view !== 'root') {
        setCurrentView(state.view);
      } else {
        setCurrentView('explore');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setCurrentViewHandler = useCallback((view, pushHistory = true) => {
    if (!view || (view === currentViewRef.current && !activeModalRef.current)) return;

    if (activeModalRef.current) {
      setActiveModal(null);
      setModalData(null);
    }
    if (showExitPromptRef.current) {
      setShowExitPrompt(false);
    }

    setCurrentView(view);
    if (pushHistory) {
      const basePath = window.location.pathname + window.location.search;
      window.history.pushState({ view, inApp: true }, '', basePath + `#${view}`);
    }
  }, []);

  const openModal = useCallback((type, data = null) => {
    if (showExitPromptRef.current) {
      setShowExitPrompt(false);
    }
    setActiveModal(type);
    setModalData(data);
    const basePath = window.location.pathname + window.location.search;
    window.history.pushState(
      { view: currentViewRef.current, modal: type, inApp: true },
      '',
      basePath + `#${currentViewRef.current || 'explore'}`
    );
  }, []);

  const closeModal = useCallback(() => {
    if (!activeModalRef.current) return;
    setActiveModal(null);
    setModalData(null);
    if (window.history.state?.modal) {
      window.history.back();
    }
  }, []);

  return (
    <UIContext.Provider
      value={{
        currentView,
        setCurrentView: setCurrentViewHandler,
        pendingArtistSearch,
        setPendingArtistSearch,
        activeModal,
        modalData,
        openModal,
        closeModal,
        showExitPrompt,
        openExitPrompt,
        closeExitPrompt,
        confirmExit,
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
