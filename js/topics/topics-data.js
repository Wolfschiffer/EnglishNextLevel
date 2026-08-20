// ============================================
// TOPICS — VOCABULARY DATA
// American English is the primary reference.
// ============================================

window.TOPICS_DATA = Object.freeze({
  kitchen: {
    id: 'kitchen',
    title: 'Kitchen Objects',
    icon: '🍽️',
    description: 'Common objects you use in the kitchen',
    englishVariant: 'en-US',
    levels: {
      common: {
        id: 'common',
        label: 'Common',
        wordCount: 10,
        words: [
          { id: 'refrigerator', english: 'refrigerator', portuguese: 'geladeira', accepted: ['refrigerator', 'fridge'] },
          { id: 'stove', english: 'stove', portuguese: 'fogão', accepted: ['stove'] },
          { id: 'oven', english: 'oven', portuguese: 'forno', accepted: ['oven'] },
          { id: 'microwave', english: 'microwave', portuguese: 'micro-ondas', accepted: ['microwave'] },
          { id: 'sink', english: 'sink', portuguese: 'pia', accepted: ['sink'] },
          { id: 'plate', english: 'plate', portuguese: 'prato', accepted: ['plate'] },
          { id: 'glass', english: 'glass', portuguese: 'copo', accepted: ['glass'] },
          { id: 'fork', english: 'fork', portuguese: 'garfo', accepted: ['fork'] },
          { id: 'knife', english: 'knife', portuguese: 'faca', accepted: ['knife'] },
          { id: 'spoon', english: 'spoon', portuguese: 'colher', accepted: ['spoon'] }
        ]
      },
      advanced: {
        id: 'advanced',
        label: 'Advanced',
        wordCount: 5,
        words: [
          { id: 'whisk', english: 'whisk', portuguese: 'batedor de arame', accepted: ['whisk'] },
          { id: 'grater', english: 'grater', portuguese: 'ralador', accepted: ['grater'], recognitionAliases: ['greater'] },
          { id: 'ladle', english: 'ladle', portuguese: 'concha', accepted: ['ladle'], recognitionAliases: ['play doh', 'play dough', 'lego'] },
          { id: 'peeler', english: 'peeler', portuguese: 'descascador', accepted: ['peeler'] },
          { id: 'cutting-board', english: 'cutting board', portuguese: 'tábua de corte', accepted: ['cutting board'] }
        ]
      }
    }
  }
});
