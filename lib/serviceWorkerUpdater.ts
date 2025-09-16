// lib/serviceWorkerUpdater.ts
export function listenForSWUpdate(onUpdate: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistration().then((registration) => {
    if (!registration) return;

    // 新しい SW が見つかったとき
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        // install → waiting → activated と変化していく
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // 🔑 ここでのみ「新バージョンが利用可能」と判断
          onUpdate();
        }
      });
    });
  });
}
