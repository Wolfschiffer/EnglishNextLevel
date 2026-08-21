// ============================================
// TOPICS — MENU / SELECTION FLOW
// topic -> level -> volume -> game type
// ============================================

(function () {
  const state = {
    topicId: 'kitchen',
    levelId: 'common',
    volumeId: 'volume-1',
    gameType: null
  };

  function getTopic() {
    return window.TOPICS_DATA?.[state.topicId] || null;
  }

  function getLevel() {
    const topic = getTopic();
    return topic?.levels?.[state.levelId] || null;
  }

  function getVolumes() {
    const level = getLevel();
    if (!level) return [];
    if (Array.isArray(level.volumes) && level.volumes.length) return level.volumes;

    // Backward-compatible fallback for any future topic still using one flat word list.
    if (Array.isArray(level.words)) {
      return [{ id: 'volume-1', label: 'Volume 1', words: level.words }];
    }
    return [];
  }

  function getVolume() {
    const volumes = getVolumes();
    return volumes.find((volume) => volume.id === state.volumeId) || volumes[0] || null;
  }

  function getPlayableLevel() {
    const level = getLevel();
    const volume = getVolume();
    if (!level || !volume) return null;

    return {
      id: level.id,
      levelId: level.id,
      volumeId: volume.id,
      baseLabel: level.label,
      volumeLabel: volume.label,
      label: `${level.label} · ${volume.label}`,
      wordCount: volume.words.length,
      words: volume.words
    };
  }

  function navigate(screen) {
    if (typeof window.navigateTo === 'function') {
      window.navigateTo(screen);
      return;
    }
    console.error('TOPICS: navigation system is unavailable.');
  }

  function back() {
    if (typeof window.goBack === 'function') window.goBack();
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

    document.querySelectorAll('[data-topic-level]').forEach((button) => {
      const level = topic.levels?.[button.dataset.topicLevel];
      const badge = button.querySelector('.topic-choice-badge');
      if (!level || !badge) return;
      const volumes = Array.isArray(level.volumes) ? level.volumes : [];
      const totalWords = volumes.reduce((sum, volume) => sum + (volume.words?.length || 0), 0);
      badge.textContent = volumes.length > 1
        ? `${volumes.length} volumes · ${totalWords} words`
        : `${totalWords || level.words?.length || 0} words`;
    });
  }

  function renderVolumeSelector() {
    const container = document.getElementById('topic-volume-grid');
    if (!container) return;

    const volumes = getVolumes();
    container.innerHTML = '';

    volumes.forEach((volume, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `topic-volume-card${volume.id === state.volumeId ? ' active' : ''}`;
      button.dataset.topicVolume = volume.id;
      button.setAttribute('aria-pressed', volume.id === state.volumeId ? 'true' : 'false');
      button.innerHTML = `
        <span class="topic-volume-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="topic-volume-copy">
          <strong>${volume.label}</strong>
          <small>${volume.words.length} ${volume.words.length === 1 ? 'word' : 'words'}</small>
        </span>
      `;
      button.addEventListener('click', () => selectVolume(volume.id));
      container.appendChild(button);
    });
  }

  function renderGameMenu() {
    const topic = getTopic();
    const playableLevel = getPlayableLevel();
    if (!topic || !playableLevel) return;

    const icon = document.getElementById('game-menu-topic-icon');
    const title = document.getElementById('game-menu-topic-title');
    const levelLabel = document.getElementById('game-menu-level-label');
    const volumeTitle = document.getElementById('topic-volume-step-title');
    const message = document.getElementById('topic-phase-message');

    if (icon) icon.textContent = topic.icon;
    if (title) title.textContent = topic.title;
    if (levelLabel) {
      levelLabel.textContent = `${playableLevel.baseLabel.toUpperCase()} · ${playableLevel.volumeLabel.toUpperCase()} · ${playableLevel.wordCount} WORDS`;
    }
    if (volumeTitle) volumeTitle.textContent = `Choose a ${playableLevel.baseLabel} Volume`;
    if (message) {
      message.textContent = '';
      message.classList.remove('visible');
    }

    renderVolumeSelector();
  }

  function selectTopic(topicId) {
    if (!window.TOPICS_DATA?.[topicId]) return;
    state.topicId = topicId;
    state.levelId = 'common';
    state.volumeId = 'volume-1';
    state.gameType = null;
    renderTopicLevelScreen();
    navigate('topicLevel');
  }

  function selectLevel(levelId) {
    const topic = getTopic();
    if (!topic?.levels?.[levelId]) return;
    state.levelId = levelId;
    state.volumeId = getVolumes()[0]?.id || 'volume-1';
    state.gameType = null;
    renderGameMenu();
    navigate('topicGameMenu');
  }

  function selectVolume(volumeId) {
    const volume = getVolumes().find((item) => item.id === volumeId);
    if (!volume) return;
    state.volumeId = volume.id;
    state.gameType = null;
    renderGameMenu();
  }

  function selectGame(gameType) {
    const topic = getTopic();
    const level = getPlayableLevel();
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

  // Initialize counts in case the screen is opened by restored browser history.
  renderTopicLevelScreen();

  window.TopicApp = {
    syncUserInfo,
    getSelection() {
      return {
        ...state,
        topic: getTopic(),
        level: getPlayableLevel(),
        baseLevel: getLevel(),
        volume: getVolume()
      };
    }
  };
})();
