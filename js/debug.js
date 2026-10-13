(() => {
  const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';

  window.enlDebug = (...args) => {
    if (debugEnabled) console.debug('[ENL]', ...args);
  };
})();
