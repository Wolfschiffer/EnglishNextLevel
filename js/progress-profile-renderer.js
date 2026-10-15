(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelProgressRenderer = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, () => {
  function create({
    document,
    window,
    numberModes,
    wordModes,
    formatScore,
    formatTime,
    summarizeOverall,
    setSyncState,
    getSyncState
  }) {
    function renderIdentity() {
      const name = window.currentUserName || window.currentUser?.displayName || (window.isGuest ? 'Guest' : 'Player');
      const email = !window.isGuest && window.currentUser?.email
        ? window.currentUser.email
        : 'Guest progress is stored on this device.';

      const nameEl = document.getElementById('progress-profile-name');
      const emailEl = document.getElementById('progress-profile-email');
      const avatar = document.getElementById('progress-avatar');
      if (nameEl) nameEl.textContent = name;
      if (emailEl) emailEl.textContent = email;
      if (avatar) avatar.textContent = (name.trim()[0] || 'P').toUpperCase();

      setSyncState(getSyncState());
    }

    function renderNumbers(progress) {
      const grid = document.getElementById('progress-numbers-grid');
      if (!grid) return;

      const scores = progress.numbers?.bestScores || {};
      const practiced = numberModes.filter(([modeId]) => (scores[modeId] || 0) > 0).length;
      const highest = Math.max(0, ...numberModes.map(([modeId]) => scores[modeId] || 0));

      const primary = document.getElementById('progress-numbers-primary');
      const best = document.getElementById('progress-numbers-best');
      if (primary) primary.textContent = `${practiced}/${numberModes.length}`;
      if (best) best.textContent = `Highest: ${formatScore(highest)}`;

      grid.innerHTML = '';
      numberModes.forEach(([modeId, label]) => {
        const score = scores[modeId] || 0;
        const item = document.createElement('div');
        item.className = `progress-number-item${score > 0 ? ' is-complete' : ''}`;
        item.innerHTML = `<span>${label}</span><strong>${formatScore(score)}</strong>`;
        grid.appendChild(item);
      });
    }

    function renderWords(progress) {
      const grid = document.getElementById('progress-words-grid');
      if (!grid) return;

      const completedCount = Object.keys(wordModes).filter((mode) => progress.words?.[mode]?.completed).length;
      const primary = document.getElementById('progress-words-primary');
      if (primary) primary.textContent = `${completedCount}/${Object.keys(wordModes).length}`;

      grid.innerHTML = '';
      Object.entries(wordModes).forEach(([mode, label]) => {
        const entry = progress.words?.[mode] || {};
        const card = document.createElement('article');
        card.className = `progress-word-card${entry.completed ? ' is-complete' : ''}`;
        card.innerHTML = `
        <div class="progress-word-card-heading">
          <div><span>WORDS</span><strong>${label}</strong></div>
          <span class="progress-complete-badge">${entry.completed ? 'Completed' : 'Not played'}</span>
        </div>
        <div class="progress-word-stats">
          <div><span>Best points</span><strong>${formatScore(entry.bestScore || 0)}</strong></div>
          <div><span>Best time</span><strong>${formatTime(entry.bestTime)}</strong></div>
        </div>
      `;
        grid.appendChild(card);
      });
    }

    function renderTopics(progress, topicCatalog, summary) {
      const container = document.getElementById('progress-topics-list');
      if (!container) return;

      const primary = document.getElementById('progress-topics-primary');
      if (primary) primary.textContent = `${summary.topicCompleted}/${summary.topicTotal}`;

      container.innerHTML = '';
      const topics = Object.values(topicCatalog || {});
      if (!topics.length) {
        container.innerHTML = '<p class="progress-empty">No topic progress yet.</p>';
        return;
      }

      topics.forEach((topic) => {
        const topicCard = document.createElement('article');
        topicCard.className = 'progress-topic-card';
        const rows = [];

        Object.values(topic.levels || {}).forEach((level) => {
          const volumes = Array.isArray(level.volumes)
            ? level.volumes
            : (Array.isArray(level.words) ? [{ id: 'volume-1', label: 'Volume 1', words: level.words }] : []);

          volumes.forEach((volume) => {
            const games = progress.topics?.[topic.id]?.[level.id]?.[volume.id] || {};
            const stats = progress.topicStats?.[topic.id]?.[level.id]?.[volume.id] || {};
            const matchStats = stats.match || {};
            const speakStats = stats.speak || {};
            rows.push(`
            <div class="progress-topic-row">
              <div class="progress-topic-row-copy"><strong>${level.label}</strong><span>${volume.label}</span></div>
              <div class="progress-topic-games">
                <div class="progress-topic-game ${games.match ? 'is-done' : ''}">
                  <span>${games.match ? '✓ ' : ''}Match</span>
                  ${games.match && matchStats.bestScore ? `<small>${formatScore(matchStats.bestScore)} pts · ${formatTime(matchStats.bestTime)}</small>` : ''}
                </div>
                <div class="progress-topic-game ${games.speak ? 'is-done' : ''}">
                  <span>${games.speak ? '✓ ' : ''}Speak</span>
                  ${games.speak && speakStats.bestScore ? `<small>${formatScore(speakStats.bestScore)} pts · ${formatTime(speakStats.bestTime)}</small>` : ''}
                </div>
              </div>
            </div>
          `);
          });
        });

        topicCard.innerHTML = `
        <div class="progress-topic-heading">
          <span class="progress-topic-icon" aria-hidden="true"></span>
          <div><span>TOPIC</span><strong>${topic.title || topic.id}</strong></div>
        </div>
        <div class="progress-topic-rows">${rows.join('')}</div>
      `;

        // Keep support for both file-backed icons and legacy emoji/text values.
        const iconHost = topicCard.querySelector('.progress-topic-icon');
        const iconValue = typeof topic.icon === 'string' ? topic.icon.trim() : '';
        const iconIsAsset = /^(?:\.?\.?\/|images\/|assets\/)|\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(iconValue);

        if (iconHost) {
          if (iconValue && iconIsAsset) {
            const image = document.createElement('img');
            image.src = iconValue;
            image.alt = '';
            image.decoding = 'async';
            image.loading = 'lazy';
            iconHost.appendChild(image);
          } else {
            iconHost.textContent = iconValue || '•';
          }
        }

        container.appendChild(topicCard);
      });
    }

    function renderOverall(summary) {
      const value = document.getElementById('progress-overall-percent');
      const fill = document.getElementById('progress-overall-fill');
      if (value) value.textContent = `${summary.percent}%`;
      if (fill) fill.style.width = `${summary.percent}%`;
    }

    function render(progress, topicCatalog) {
      const summary = summarizeOverall(progress, topicCatalog, numberModes, wordModes);
      renderIdentity();
      renderOverall(summary);
      renderNumbers(progress);
      renderWords(progress);
      renderTopics(progress, topicCatalog, summary);
      return summary;
    }

    return Object.freeze({ render });
  }

  return Object.freeze({ create });
});
