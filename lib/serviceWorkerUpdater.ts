// lib/serviceWorkerUpdater.ts
export function listenForSWUpdate(onUpdate: () => void) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Service Worker が切り替わったらページをリロード
      window.location.reload();
    });

    navigator.serviceWorker.ready.then((registration) => {
      if (!registration || !registration.waiting) return;
      // 新しい SW がある場合にコールバック
      onUpdate();
    });
  }
}
