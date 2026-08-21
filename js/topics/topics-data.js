// ============================================
// TOPICS — VOCABULARY DATA
// American English is the primary reference.
// Volumes keep each round compact while allowing the topic to grow.
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
        volumeSize: 10,
        volumes: [
          {
            id: 'volume-1',
            label: 'Volume 1',
            words: [
              { id: 'refrigerator', english: 'refrigerator', portuguese: 'geladeira', accepted: ['refrigerator', 'fridge'] },
              { id: 'stove', english: 'stove', portuguese: 'fogão', accepted: ['stove'] },
              { id: 'oven', english: 'oven', portuguese: 'forno', accepted: ['oven'] },
              { id: 'microwave', english: 'microwave', portuguese: 'micro-ondas', accepted: ['microwave'] },
              { id: 'sink', english: 'sink', portuguese: 'pia', accepted: ['sink'], recognitionAliases: ['sync'] },
              { id: 'plate', english: 'plate', portuguese: 'prato', accepted: ['plate'] },
              { id: 'glass', english: 'glass', portuguese: 'copo', accepted: ['glass'] },
              { id: 'fork', english: 'fork', portuguese: 'garfo', accepted: ['fork'] },
              { id: 'knife', english: 'knife', portuguese: 'faca', accepted: ['knife'] },
              { id: 'spoon', english: 'spoon', portuguese: 'colher', accepted: ['spoon'] }
            ]
          },
          {
            id: 'volume-2',
            label: 'Volume 2',
            words: [
              { id: 'bowl', english: 'bowl', portuguese: 'tigela', accepted: ['bowl'] },
              { id: 'cup', english: 'cup', portuguese: 'xícara', accepted: ['cup'] },
              { id: 'mug', english: 'mug', portuguese: 'caneca', accepted: ['mug'] },
              { id: 'pan', english: 'pan', portuguese: 'frigideira', accepted: ['pan'] },
              { id: 'pot', english: 'pot', portuguese: 'panela', accepted: ['pot'] },
              { id: 'bottle', english: 'bottle', portuguese: 'garrafa', accepted: ['bottle'] },
              { id: 'kettle', english: 'kettle', portuguese: 'chaleira', accepted: ['kettle'] },
              { id: 'toaster', english: 'toaster', portuguese: 'torradeira', accepted: ['toaster'] },
              { id: 'blender', english: 'blender', portuguese: 'liquidificador', accepted: ['blender'] },
              { id: 'dishwasher', english: 'dishwasher', portuguese: 'lava-louças', accepted: ['dishwasher'] }
            ]
          }
        ]
      },
      advanced: {
        id: 'advanced',
        label: 'Advanced',
        volumeSize: 6,
        volumes: [
          {
            id: 'volume-1',
            label: 'Volume 1',
            words: [
              { id: 'whisk', english: 'whisk', portuguese: 'fuê', accepted: ['whisk'] },
              { id: 'grater', english: 'grater', portuguese: 'ralador', accepted: ['grater'], recognitionAliases: ['greater'] },
              { id: 'ladle', english: 'ladle', portuguese: 'concha', accepted: ['ladle'], recognitionAliases: ['play doh', 'play dough', 'lego'] },
              { id: 'peeler', english: 'peeler', portuguese: 'descascador', accepted: ['peeler'] },
              { id: 'cutting-board', english: 'cutting board', portuguese: 'tábua de corte', accepted: ['cutting board'] },
              { id: 'spatula', english: 'spatula', portuguese: 'espátula', accepted: ['spatula'] }
            ]
          },
          {
            id: 'volume-2',
            label: 'Volume 2',
            words: [
              { id: 'tongs', english: 'tongs', portuguese: 'pegador de cozinha', accepted: ['tongs'] },
              { id: 'colander', english: 'colander', portuguese: 'escorredor', accepted: ['colander'] },
              { id: 'rolling-pin', english: 'rolling pin', portuguese: 'rolo de massa', accepted: ['rolling pin'] },
              { id: 'measuring-cup', english: 'measuring cup', portuguese: 'copo medidor', accepted: ['measuring cup'] },
              { id: 'can-opener', english: 'can opener', portuguese: 'abridor de latas', accepted: ['can opener'] },
              { id: 'corkscrew', english: 'corkscrew', portuguese: 'saca-rolhas', accepted: ['corkscrew'] }
            ]
          }
        ]
      }
    }
  }
});
