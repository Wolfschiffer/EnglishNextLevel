// Normalizes and checks spoken answers against a topic word and its aliases.
(function () {
  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function removeLeadingArticle(value) {
    return value.replace(/^(a|an|the)\s+/, '').trim();
  }

  function acceptedAnswers(word) {
    const source = Array.isArray(word?.accepted) && word.accepted.length
      ? word.accepted
      : [word?.english];
    const aliases = Array.isArray(word?.recognitionAliases)
      ? word.recognitionAliases
      : [];

    return [...source, ...aliases]
      .filter(Boolean)
      .map(normalize)
      .filter(Boolean);
  }

  function isCorrect(transcript, word) {
    const normalized = normalize(transcript);
    const withoutArticle = removeLeadingArticle(normalized);

    return acceptedAnswers(word).some((accepted) => {
      return normalized === accepted || withoutArticle === accepted;
    });
  }

  window.TopicSpeakAnswer = { isCorrect, normalize };
})();
