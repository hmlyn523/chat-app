// lib/serviceWorkerUpdater.ts
export function listenForSWUpdate(onUpdate: () => void) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Service Worker が切り替わったらページをリロード
      window.location.reload();
    });

    // ページ開いたままでも定期的に更新チェック
    setInterval(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      // 新しい SW が waiting になっていればコールバック
      if (registration.waiting) {
        onUpdate();
      } else {
        // SW を更新チェック
        registration.update();
      }
    }, 30 * 1000); // 30秒ごとにチェック（必要に応じて調整）
  }
}
