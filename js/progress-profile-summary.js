(function (root, factory) {
  const api = factory(root?.EnglishNextLevelProgressData);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.EnglishNextLevelProgressSummary = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, (progressData) => {
  if (typeof progressData?.safeNumber !== 'function') {
    throw new Error('EnglishNextLevelProgressData must load before the progress summary.');
  }

  const { safeNumber } = progressData;

  function formatScore(value) {
    return Math.max(0, Math.floor(safeNumber(value))).toLocaleString('en-US');
  }

  function formatTime(seconds) {
    if (!seconds) return '—';
    const total = Math.max(0, Math.floor(safeNumber(seconds)));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function countTopicActivities(progress) {
    let completed = 0;
    Object.values(progress?.topics || {}).forEach((levels) => {
      Object.values(levels || {}).forEach((volumes) => {
        Object.values(volumes || {}).forEach((games) => {
          if (games?.match) completed += 1;
          if (games?.speak) completed += 1;
        });
      });
    });
    return completed;
  }

  function totalAvailableTopicActivities(topicCatalog) {
    let total = 0;
    Object.values(topicCatalog || {}).forEach((topic) => {
      Object.values(topic?.levels || {}).forEach((level) => {
        const volumes = Array.isArray(level?.volumes)
          ? level.volumes
          : (Array.isArray(level?.words) ? [{ words: level.words }] : []);
        total += volumes.length * 2;
      });
    });
    return total;
  }

  function summarizeOverall(progress, topicCatalog, numberModes, wordModes) {
    const numberCompleted = numberModes.filter(([modeId]) => (
      (progress.numbers?.bestScores?.[modeId] || 0) > 0
    )).length;
    const wordCompleted = Object.keys(wordModes).filter((mode) => (
      progress.words?.[mode]?.completed
    )).length;
    const topicCompleted = countTopicActivities(progress);
    const topicTotal = totalAvailableTopicActivities(topicCatalog);
    const total = numberModes.length + Object.keys(wordModes).length + topicTotal;
    const completed = numberCompleted + wordCompleted + topicCompleted;

    return {
      numberCompleted,
      wordCompleted,
      topicCompleted,
      topicTotal,
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  return Object.freeze({
    formatScore,
    formatTime,
    countTopicActivities,
    totalAvailableTopicActivities,
    summarizeOverall
  });
});
