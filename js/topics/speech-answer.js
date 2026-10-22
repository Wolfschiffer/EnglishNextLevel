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

  function isOneEditApart(left, right) {
    if (left === right || Math.abs(left.length - right.length) > 1) return false;

    let leftIndex = 0;
    let rightIndex = 0;
    let edits = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex] === right[rightIndex]) {
        leftIndex += 1;
        rightIndex += 1;
        continue;
      }

      edits += 1;
      if (edits > 1) return false;

      if (left.length > right.length) leftIndex += 1;
      else if (right.length > left.length) rightIndex += 1;
      else {
        leftIndex += 1;
        rightIndex += 1;
      }
    }

    if (leftIndex < left.length || rightIndex < right.length) edits += 1;
    return edits === 1;
  }

  function match(transcript, word) {
    const normalized = normalize(transcript);
    const withoutArticle = removeLeadingArticle(normalized);
    const canonical = normalize(word?.english);
    const answers = acceptedAnswers(word);

    const exactAnswer = answers.find((accepted) => normalized === accepted || withoutArticle === accepted);
    if (exactAnswer) {
      return {
        correct: true,
        answer: word?.english || exactAnswer,
        corrected: withoutArticle !== canonical
      };
    }

    // Allow one small recognition spelling error only for longer answers.
    // Short words are too easy to confuse with a different valid answer.
    const compactTranscript = withoutArticle.replace(/[\s-]/g, '');
    const nearAnswer = answers.find((accepted) => {
      const compactAnswer = removeLeadingArticle(accepted).replace(/[\s-]/g, '');
      return compactAnswer.length >= 8 && compactTranscript.length >= 7 &&
        isOneEditApart(compactTranscript, compactAnswer);
    });

    if (nearAnswer) {
      return {
        correct: true,
        answer: word?.english || nearAnswer,
        corrected: true
      };
    }

    return { correct: false, answer: null, corrected: false };
  }

  function isCorrect(transcript, word) {
    return match(transcript, word).correct;
  }

  window.TopicSpeakAnswer = { isCorrect, match, normalize };
})();
