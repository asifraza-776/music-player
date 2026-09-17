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
  const isExitingRef = useRef(false);
  const guardGestureArmedRef = useRef(false);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Arm history guard with user gesture to bypass mobile browser History Manipulation Intervention
  useEffect(() => {
    const armGuardOnGesture = () => {
      if (guardGestureArmedRef.current) return;
      if (currentViewRef.current === 'explore' && !activeModalRef.current) {
        guardGestureArmedRef.current = true;
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
      }
    };

    window.addEventListener('pointerdown', armGuardOnGesture, { passive: true });
    window.addEventListener('touchstart', armGuardOnGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', armGuardOnGesture);
      window.removeEventListener('touchstart', armGuardOnGesture);
    };
  }, []);

  // Smart Browser History (popstate) Listener with Pure Double-Back Exit Protection
  useEffect(() => {
    const initialView = ['explore', 'search', 'charts', 'library'].includes(
      window.location.hash.replace('#', '')
    )
      ? window.location.hash.replace('#', '')
      : 'explore';

    const basePath = window.location.pathname + window.location.search;

    // Base root state without hash so browser records a real back step from #explore to basePath
    window.history.replaceState({ view: 'explore', isRoot: true, isBase: true }, '', basePath);
    // Active app state with distinct hash so first back press on app open is reliably caught
    window.history.pushState({ view: initialView, modal: null, isGuard: true }, '', `#${initialView}`);

    const handlePopState = (e) => {
      if (isExitingRef.current) {
        return;
      }

      const state = e.state;

      // 1. If any modal (Playlist, Album, Lyrics, Sleep Timer) is open:
      // Pressing back MUST close the modal and keep user on the current page!
      if (activeModalRef.current) {
        activeModalRef.current = null;
        setActiveModal(null);
        setModalData(null);
        if (state?.view && state.view !== currentViewRef.current) {
          currentViewRef.current = state.view;
          setCurrentView(state.view);
        }
        return;
      }

      // 2. If state had a modal (user pressed forward):
      if (state?.modal) {
        activeModalRef.current = state.modal;
        setActiveModal(state.modal);
        if (state.view) {
          currentViewRef.current = state.view;
          setCurrentView(state.view);
        }
        return;
      }

      // 3. If currently on Explore (Root) view:
      // User is ALREADY on Explore and pressed Back -> Trigger double-tap exit protection!
      if (currentViewRef.current === 'explore') {
        const now = Date.now();
        if (now - lastBackPressTimeRef.current < 2000) {
          // Double-tap confirmed within 2s -> Allow real browser exit!
          isExitingRef.current = true;
          lastBackPressTimeRef.current = 0;
          if (showToastRef.current) {
            showToastRef.current('Closing MelodySphere... 👋', '', 'info');
          }
          window.history.back();
          try {
            window.close();
          } catch (err) {}
          setTimeout(() => {
            isExitingRef.current = false;
          }, 1500);
          return;
        }

        // First tap while on Explore: notify user and re-arm the guard
        lastBackPressTimeRef.current = now;
        if (showToastRef.current) {
          showToastRef.current('Press back again to exit 👋', 'Tap back once more to close app', 'warning');
        }
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
        guardGestureArmedRef.current = true;
        return;
      }

      // 4. Tab navigation back/forward (e.g. Search / Charts / Library -> Explore):
      // Returns smoothly to Explore WITHOUT showing any exit toast!
      lastBackPressTimeRef.current = 0; // Reset exit timer
      const targetView = state?.view || 'explore';
      currentViewRef.current = targetView;
      setCurrentView(targetView);

      if (targetView === 'explore') {
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
        guardGestureArmedRef.current = true;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setCurrentViewHandler = useCallback((view, pushHistory = true) => {
    if (!view || (view === currentViewRef.current && !activeModalRef.current)) return;

    lastBackPressTimeRef.current = 0; // Reset exit timer on tab switch

    if (activeModalRef.current) {
      activeModalRef.current = null;
      setActiveModal(null);
      setModalData(null);
    }

    currentViewRef.current = view;
    setCurrentView(view);
    if (pushHistory) {
      window.history.pushState({ view, modal: null }, '', `#${view}`);
      if (view === 'explore') {
        window.history.pushState({ view: 'explore', modal: null, isGuard: true }, '', '#explore');
        guardGestureArmedRef.current = true;
      }
    }
  }, []);

  const openModal = useCallback((type, data = null) => {
    activeModalRef.current = type;
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
    activeModalRef.current = null;
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
