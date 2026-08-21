(() => {
  'use strict';

  const menuScreens = new Set([
    'categories',
    'profile',
    'numbersMenu',
    'wordsMenu',
    'wordsSubmenu',
    'wordsSubmenuPast',
    'topicsMenu',
    'topicLevel',
    'topicGameMenu'
  ]);

  function currentScreen() {
    return document.body.getAttribute('data-screen') || '';
  }

  function setActive(button, active) {
    if (!button) return;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }

  function syncActiveState() {
    const screen = currentScreen();
    const settingsOverlay = document.getElementById('words-settings-overlay');
    const settingsOpen = Boolean(settingsOverlay?.classList.contains('visible'));

    const home = document.getElementById('mobile-nav-home');
    const progress = document.getElementById('mobile-nav-progress');
    const settings = document.getElementById('mobile-nav-settings');

    setActive(home, screen === 'categories');
    setActive(progress, screen === 'profile');
    settings?.classList.toggle('is-active', settingsOpen);
    if (settingsOpen) settings?.setAttribute('aria-current', 'true');
    else settings?.removeAttribute('aria-current');

    const nav = document.getElementById('mobile-bottom-nav');
    nav?.setAttribute('aria-hidden', menuScreens.has(screen) ? 'false' : 'true');
  }

  function goHome() {
    if (typeof window.navigateToRoot === 'function') {
      window.navigateToRoot('categories');
    } else if (typeof window.navigateTo === 'function') {
      window.navigateTo('categories');
    }
  }

  function goProgress() {
    if (typeof window.navigateToRoot === 'function') {
      window.navigateToRoot('profile');
    } else if (typeof window.navigateTo === 'function') {
      window.navigateTo('profile');
    }
  }

  function openSettings() {
    if (typeof window.openWordsSettings === 'function') {
      window.openWordsSettings();
      window.setTimeout(syncActiveState, 0);
      return;
    }

    // Fallback: reuse whichever contextual settings control exists.
    const fallback = [
      'category-settings-btn',
      'numbers-menu-settings-btn',
      'words-menu-settings-btn',
      'topics-menu-settings-btn',
      'topic-level-settings-btn',
      'topic-game-menu-settings-btn'
    ].map((id) => document.getElementById(id)).find(Boolean);

    fallback?.click();
    window.setTimeout(syncActiveState, 0);
  }

  function init() {
    document.getElementById('mobile-nav-home')?.addEventListener('click', goHome);
    document.getElementById('mobile-nav-progress')?.addEventListener('click', goProgress);
    document.getElementById('mobile-nav-settings')?.addEventListener('click', openSettings);

    const bodyObserver = new MutationObserver(syncActiveState);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });

    const settingsOverlay = document.getElementById('words-settings-overlay');
    if (settingsOverlay) {
      const settingsObserver = new MutationObserver(syncActiveState);
      settingsObserver.observe(settingsOverlay, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    }

    syncActiveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
