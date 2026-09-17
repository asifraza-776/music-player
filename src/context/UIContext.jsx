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

  // Smart Browser History (popstate) Listener with Double-Back Exit Protection
  useEffect(() => {
    const initialView = ['explore', 'search', 'charts', 'library'].includes(
      window.location.hash.replace('#', '')
    )
      ? window.location.hash.replace('#', '')
      : 'explore';

    // Base state
    window.history.replaceState({ view: initialView, modal: null, isBase: true }, '', `#${initialView}`);
    // If starting on explore, arm the guard so first back press is caught
    if (initialView === 'explore') {
      window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
    }

    const handlePopState = (e) => {
      const state = e.state;

      // 1. If any modal (Playlist, Album, Lyrics, Sleep Timer) is open:
      // Pressing back MUST close the modal and keep user on the current page!
      if (activeModalRef.current) {
        setActiveModal(null);
        setModalData(null);
        if (state?.view && state.view !== currentViewRef.current) {
          setCurrentView(state.view);
        }
        return;
      }

      // 2. If state had a modal (user pressed forward):
      if (state?.modal) {
        setActiveModal(state.modal);
        if (state.view) setCurrentView(state.view);
        return;
      }

      // 3. Double-tap back protection on root Explore view
      if (currentViewRef.current === 'explore' && (!state?.view || state.view === 'explore')) {
        const now = Date.now();
        if (now - lastBackPressTimeRef.current < 2000) {
          // Double-tap detected within 2 seconds -> Allow real browser exit!
          lastBackPressTimeRef.current = 0;
          window.history.back();
          return;
        }

        // First tap: notify user and re-arm the guard
        lastBackPressTimeRef.current = now;
        if (showToastRef.current) {
          showToastRef.current('Press back again to exit 👋', 'Double-tap to close MelodySphere', 'info');
        }
        // Re-push guard state so the second tap can proceed or timeout resets
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
        return;
      }

      // 4. Tab navigation back/forward (Library -> Search -> Explore)
      if (state?.view) {
        setCurrentView(state.view);
        if (state.view === 'explore') {
          window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
        }
      } else {
        setCurrentView('explore');
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
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
      window.history.pushState({ view, modal: null }, '', `#${view}`);
      if (view === 'explore') {
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
      }
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
    setActiveModal(null);
    setModalData(null);
    // If the modal was pushed to history, pop it so browser history stays clean
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
