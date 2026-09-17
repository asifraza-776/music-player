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

  const lastBackPressTimeRef = useRef(0);
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Smart Browser History (popstate) Listener with Exit Confirmation Modal
  useEffect(() => {
    const initialView = ['explore', 'search', 'charts', 'library'].includes(
      window.location.hash.replace('#', '')
    )
      ? window.location.hash.replace('#', '')
      : 'explore';

    const basePath = window.location.pathname + window.location.search;

    // Base root state without hash
    window.history.replaceState({ isRoot: true }, '', basePath);
    // Active app state with distinct hash so browser records a real history step
    window.history.pushState({ view: initialView, isApp: true }, '', `#${initialView}`);

    const handlePopState = (e) => {
      const state = e.state;

      // 1. If ExitModal is already open and user presses back on phone -> close the ExitModal!
      if (activeModalRef.current === 'exit') {
        setActiveModal(null);
        setModalData(null);
        return;
      }

      // 2. If any other modal (Playlist, Album, Lyrics, Sleep Timer) is open:
      // Pressing back MUST close the modal and keep user on the current page!
      if (activeModalRef.current) {
        setActiveModal(null);
        setModalData(null);
        if (state?.view && state.view !== currentViewRef.current) {
          setCurrentView(state.view);
        }
        return;
      }

      // 3. If forward navigation to a modal
      if (state?.modal && state.modal !== 'exit') {
        setActiveModal(state.modal);
        if (state.view) setCurrentView(state.view);
        return;
      }

      // 4. If user is at root (Explore) and presses Back -> Open Exit Confirmation Modal!
      if (currentViewRef.current === 'explore' || state?.isRoot) {
        setActiveModal('exit');
        setModalData(null);
        // Re-push active state so the exit modal stays mounted and user stays on the page
        window.history.pushState({ view: 'explore', isApp: true, modal: 'exit' }, '', '#explore');
        return;
      }

      // 5. Tab navigation back/forward (Library -> Search -> Explore)
      if (state?.view) {
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

    setCurrentView(view);
    if (pushHistory) {
      window.history.pushState({ view, isApp: true }, '', `#${view}`);
    }
  }, []);

  const openModal = useCallback((type, data = null) => {
    setActiveModal(type);
    setModalData(data);
    // Push modal entry into browser history so hardware/browser back closes it!
    window.history.pushState(
      { view: currentViewRef.current, modal: type },
      '',
      `#${currentViewRef.current || 'explore'}`
    );
  }, []);

  const closeModal = useCallback(() => {
    if (!activeModalRef.current) return;
    const isExit = activeModalRef.current === 'exit';
    setActiveModal(null);
    setModalData(null);

    // If it was the ExitModal, DO NOT call history.back() because that triggers the popstate exit trap again!
    if (isExit) {
      return;
    }

    // For other modals (collection, lyrics, sleep), pop the history entry cleanly
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
