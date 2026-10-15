// The scope is relative to the current ENL path, so it also works on GitHub Pages.
if ('serviceWorker' in navigator && window.isSecureContext) {
    const serviceWorkerUrl = new URL('./service-worker.js', window.location.href);
    const appScope = new URL('./', window.location.href).pathname;

    navigator.serviceWorker.register(serviceWorkerUrl, { scope: appScope })
        .catch((error) => {
            console.warn('ENL offline shell could not be registered.', error);
        });
}
