import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, X, Download } from 'lucide-react';
import { versionInfo } from '../../version';

export default function PWAManager() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showRestoredToast, setShowRestoredToast] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showUpdateToast, setShowUpdateToast] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  // 1. Listen for connection changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestoredToast(true);
      setTimeout(() => setShowRestoredToast(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestoredToast(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Service Worker registration and update detection (P0, P4)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          setSwRegistration(registration);
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Check if there is already an updated service worker waiting
          if (registration.waiting) {
            setShowUpdateToast(true);
          }

          // Listen for new service workers installing
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // A new service worker is installed and waiting to take over
                    setShowUpdateToast(true);
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });

      // Reload page when the active service worker changes (after skipWaiting)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  // 3. Install Prompt handling with recurrence rules (P8)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check major version difference to clear ignore flag
      const currentMajor = parseInt(versionInfo.version.split('.')[0], 10);
      const storedMajorRaw = localStorage.getItem('pwa-install-checked-major-version');
      const storedMajor = storedMajorRaw ? parseInt(storedMajorRaw, 10) : null;

      if (storedMajor !== null && currentMajor > storedMajor) {
        // Major version upgraded, reset ignore date
        localStorage.removeItem('pwa-install-ignored-until');
      }
      localStorage.setItem('pwa-install-checked-major-version', currentMajor.toString());

      // Validate recurrence timing
      const ignoredUntil = localStorage.getItem('pwa-install-ignored-until');
      const now = Date.now();

      if (!ignoredUntil || now > parseInt(ignoredUntil, 10)) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleUpdateApp = () => {
    if (swRegistration && swRegistration.waiting) {
      // Send the skip waiting signal to trigger instant reload (P4)
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback
      window.location.reload();
    }
  };

  const handleDismissUpdate = () => {
    setShowUpdateToast(false);
  };

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the installation');
        } else {
          console.log('[PWA] User dismissed the installation');
          // Ignored for 30 days
          const thirtyDays = 30 * 24 * 60 * 60 * 1000;
          localStorage.setItem('pwa-install-ignored-until', (Date.now() + thirtyDays).toString());
        }
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      });
    }
  };

  const handleIgnoreInstall = () => {
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa-install-ignored-until', (Date.now() + thirtyDays).toString());
    setShowInstallBanner(false);
  };

  return (
    <>
      <AnimatePresence>
        {/* Offline Banner (P2 & Offline Status Alert) */}
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            className="fixed top-0 left-0 right-0 z-[9999] bg-brand-danger text-white py-2.5 px-4 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-md"
          >
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>Você está sem conexão com a internet. Algumas funcionalidades podem estar indisponíveis.</span>
          </motion.div>
        )}

        {/* Connection Restored Toast (P2) */}
        {showRestoredToast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[9999] bg-brand-success text-white py-3 px-5 rounded-lg shadow-xl border border-brand-success/20 flex items-center gap-3 text-sm font-medium"
          >
            <Wifi className="w-4 h-4" />
            <span>Conexão restabelecida.</span>
          </motion.div>
        )}

        {/* Update Application Toast (P4) */}
        {showUpdateToast && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[9998] bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-2xl flex flex-col gap-3 max-w-sm glass"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin-slow" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Nova versão disponível</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Deseja atualizar a aplicação agora? A atualização é segura e não perderá sua sessão atual.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleDismissUpdate} 
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-deep transition-colors"
                aria-label="Ignorar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={handleDismissUpdate}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-bg-deep transition-all cursor-pointer"
              >
                Depois
              </button>
              <button
                onClick={handleUpdateApp}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar Agora
              </button>
            </div>
          </motion.div>
        )}

        {/* Custom PWA Installation Banner (P8) */}
        {showInstallBanner && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            className="fixed bottom-6 left-6 z-[9997] bg-bg-surface border border-border-subtle p-5 rounded-xl shadow-2xl flex flex-col gap-3 max-w-sm glass"
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3">
                <img 
                  src="/cerberus-logo.png" 
                  alt="Cerberus Logo" 
                  className="w-9 h-9 object-contain rounded bg-white p-0.5 border border-border-subtle shrink-0" 
                />
                <div>
                  <h4 className="text-sm font-bold text-text-primary">Instalar o Cerberusu?</h4>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Acesse o motor de vendas e inteligência tributária diretamente da sua área de trabalho ou tela inicial.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleIgnoreInstall} 
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-bg-deep transition-colors"
                aria-label="Ignorar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={handleIgnoreInstall}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-bg-deep transition-all cursor-pointer"
              >
                Agora não
              </button>
              <button
                onClick={handleInstallApp}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
