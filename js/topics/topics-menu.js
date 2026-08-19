// ============================================
// TOPICS — MENU / SELECTION FLOW
// Phase 1: topic -> level -> game type
// ============================================

(function () {
  const state = {
    topicId: 'kitchen',
    levelId: 'common',
    gameType: null
  };

  function getTopic() {
    return window.TOPICS_DATA?.[state.topicId] || null;
  }

  function getLevel() {
    const topic = getTopic();
    return topic?.levels?.[state.levelId] || null;
  }

  function navigate(screen) {
    if (typeof window.navigateTo === 'function') {
      window.navigateTo(screen);
      return;
    }
    console.error('TOPICS: navigation system is unavailable.');
  }

  function back() {
    if (typeof window.goBack === 'function') {
      window.goBack();
    }
  }

  function syncUserInfo() {
    const wrapper = document.getElementById('topics-user-info');
    const nameEl = document.getElementById('topics-user-name');
    if (!wrapper || !nameEl) return;

    if (window.currentUser && !window.isGuest) {
      const email = window.currentUser.email || '';
      nameEl.textContent = email.split('@')[0] || 'Player';
      wrapper.style.display = 'flex';
    } else if (window.isGuest) {
      nameEl.textContent = 'Guest';
      wrapper.style.display = 'flex';
    } else {
      wrapper.style.display = 'none';
    }
  }

  function renderTopicLevelScreen() {
    const topic = getTopic();
    if (!topic) return;

    const icon = document.getElementById('selected-topic-icon');
    const title = document.getElementById('selected-topic-title');
    const description = document.getElementById('selected-topic-description');

    if (icon) icon.textContent = topic.icon;
    if (title) title.textContent = topic.title;
    if (description) description.textContent = topic.description;
  }

  function renderGameMenu() {
    const topic = getTopic();
    const level = getLevel();
    if (!topic || !level) return;

    const icon = document.getElementById('game-menu-topic-icon');
    const title = document.getElementById('game-menu-topic-title');
    const levelLabel = document.getElementById('game-menu-level-label');
    const message = document.getElementById('topic-phase-message');

    if (icon) icon.textContent = topic.icon;
    if (title) title.textContent = topic.title;
    if (levelLabel) levelLabel.textContent = `${level.label.toUpperCase()} · ${level.wordCount} WORDS`;
    if (message) {
      message.textContent = '';
      message.classList.remove('visible');
    }
  }

  function selectTopic(topicId) {
    if (!window.TOPICS_DATA?.[topicId]) return;
    state.topicId = topicId;
    state.levelId = 'common';
    state.gameType = null;
    renderTopicLevelScreen();
    navigate('topicLevel');
  }

  function selectLevel(levelId) {
    const topic = getTopic();
    if (!topic?.levels?.[levelId]) return;
    state.levelId = levelId;
    state.gameType = null;
    renderGameMenu();
    navigate('topicGameMenu');
  }

  function selectGame(gameType) {
    const topic = getTopic();
    const level = getLevel();
    if (!topic || !level) return;

    state.gameType = gameType;

    const message = document.getElementById('topic-phase-message');
    if (message) {
      message.textContent = '';
      message.classList.remove('visible');
    }

    if (gameType === 'match') {
      if (!window.TopicMatchPairs || typeof window.TopicMatchPairs.prepare !== 'function') {
        console.error('TOPICS: Match Pairs module is unavailable.');
        return;
      }

      window.TopicMatchPairs.prepare({ topic, level });
      navigate('topicMatch');
      return;
    }

    if (gameType === 'speak') {
      if (!window.TopicSpeakGame || typeof window.TopicSpeakGame.prepare !== 'function') {
        console.error('TOPICS: Speak module is unavailable.');
        return;
      }

      window.TopicSpeakGame.prepare({ topic, level });
      navigate('topicSpeak');
    }
  }

  document.querySelector('[data-topic-id="kitchen"]')?.addEventListener('click', () => selectTopic('kitchen'));

  document.querySelectorAll('[data-topic-level]').forEach((button) => {
    button.addEventListener('click', () => selectLevel(button.dataset.topicLevel));
  });

  document.querySelectorAll('[data-topic-game]').forEach((button) => {
    button.addEventListener('click', () => selectGame(button.dataset.topicGame));
  });

  document.getElementById('back-to-category-from-topics')?.addEventListener('click', back);
  document.getElementById('back-to-topics-from-level')?.addEventListener('click', back);
  document.getElementById('back-to-level-from-game-menu')?.addEventListener('click', back);

  window.TopicApp = {
    syncUserInfo,
    getSelection() {
      return {
        ...state,
        topic: getTopic(),
        level: getLevel()
      };
    }
  };
})();
