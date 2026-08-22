// ============================================
// TOPICS — VOCABULARY DATA
// American English is the primary reference.
// Every topic has 2 Common volumes with 10 words each.
// Every topic has 2 Advanced volumes with 6 words each.
// ============================================

window.TOPICS_DATA = Object.freeze({
  "kitchen": {
    "id": "kitchen",
    "title": "Kitchen Objects",
    "icon": "images/topics/kitchen.png",
    "description": "Common objects and tools you use in the kitchen",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "refrigerator",
                "english": "refrigerator",
                "portuguese": "geladeira",
                "accepted": [
                  "refrigerator",
                  "fridge"
                ]
              },
              {
                "id": "stove",
                "english": "stove",
                "portuguese": "fogão",
                "accepted": [
                  "stove"
                ]
              },
              {
                "id": "oven",
                "english": "oven",
                "portuguese": "forno",
                "accepted": [
                  "oven"
                ]
              },
              {
                "id": "microwave",
                "english": "microwave",
                "portuguese": "micro-ondas",
                "accepted": [
                  "microwave"
                ]
              },
              {
                "id": "sink",
                "english": "sink",
                "portuguese": "pia",
                "accepted": [
                  "sink"
                ],
                "recognitionAliases": [
                  "sync"
                ]
              },
              {
                "id": "plate",
                "english": "plate",
                "portuguese": "prato",
                "accepted": [
                  "plate"
                ]
              },
              {
                "id": "glass",
                "english": "glass",
                "portuguese": "copo",
                "accepted": [
                  "glass"
                ]
              },
              {
                "id": "fork",
                "english": "fork",
                "portuguese": "garfo",
                "accepted": [
                  "fork"
                ]
              },
              {
                "id": "knife",
                "english": "knife",
                "portuguese": "faca",
                "accepted": [
                  "knife"
                ]
              },
              {
                "id": "spoon",
                "english": "spoon",
                "portuguese": "colher",
                "accepted": [
                  "spoon"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "bowl",
                "english": "bowl",
                "portuguese": "tigela",
                "accepted": [
                  "bowl"
                ]
              },
              {
                "id": "cup",
                "english": "cup",
                "portuguese": "xícara",
                "accepted": [
                  "cup"
                ]
              },
              {
                "id": "mug",
                "english": "mug",
                "portuguese": "caneca",
                "accepted": [
                  "mug"
                ]
              },
              {
                "id": "pan",
                "english": "pan",
                "portuguese": "frigideira",
                "accepted": [
                  "pan"
                ]
              },
              {
                "id": "pot",
                "english": "pot",
                "portuguese": "panela",
                "accepted": [
                  "pot"
                ]
              },
              {
                "id": "bottle",
                "english": "bottle",
                "portuguese": "garrafa",
                "accepted": [
                  "bottle"
                ]
              },
              {
                "id": "kettle",
                "english": "kettle",
                "portuguese": "chaleira",
                "accepted": [
                  "kettle"
                ]
              },
              {
                "id": "toaster",
                "english": "toaster",
                "portuguese": "torradeira",
                "accepted": [
                  "toaster"
                ]
              },
              {
                "id": "blender",
                "english": "blender",
                "portuguese": "liquidificador",
                "accepted": [
                  "blender"
                ]
              },
              {
                "id": "dishwasher",
                "english": "dishwasher",
                "portuguese": "lava-louças",
                "accepted": [
                  "dishwasher"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "whisk",
                "english": "whisk",
                "portuguese": "fuê",
                "accepted": [
                  "whisk"
                ]
              },
              {
                "id": "grater",
                "english": "grater",
                "portuguese": "ralador",
                "accepted": [
                  "grater"
                ],
                "recognitionAliases": [
                  "greater"
                ]
              },
              {
                "id": "ladle",
                "english": "ladle",
                "portuguese": "concha",
                "accepted": [
                  "ladle"
                ],
                "recognitionAliases": [
                  "play doh",
                  "play dough",
                  "lego"
                ]
              },
              {
                "id": "peeler",
                "english": "peeler",
                "portuguese": "descascador",
                "accepted": [
                  "peeler"
                ]
              },
              {
                "id": "cutting-board",
                "english": "cutting board",
                "portuguese": "tábua de corte",
                "accepted": [
                  "cutting board"
                ]
              },
              {
                "id": "spatula",
                "english": "spatula",
                "portuguese": "espátula",
                "accepted": [
                  "spatula"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "tongs",
                "english": "tongs",
                "portuguese": "pegador de cozinha",
                "accepted": [
                  "tongs"
                ]
              },
              {
                "id": "colander",
                "english": "colander",
                "portuguese": "escorredor",
                "accepted": [
                  "colander"
                ]
              },
              {
                "id": "rolling-pin",
                "english": "rolling pin",
                "portuguese": "rolo de massa",
                "accepted": [
                  "rolling pin"
                ]
              },
              {
                "id": "measuring-cup",
                "english": "measuring cup",
                "portuguese": "copo medidor",
                "accepted": [
                  "measuring cup"
                ]
              },
              {
                "id": "can-opener",
                "english": "can opener",
                "portuguese": "abridor de latas",
                "accepted": [
                  "can opener"
                ]
              },
              {
                "id": "corkscrew",
                "english": "corkscrew",
                "portuguese": "saca-rolhas",
                "accepted": [
                  "corkscrew"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "adjectives": {
    "id": "adjectives",
    "title": "Adjectives",
    "icon": "images/topics/adjectives.png",
    "description": "Words that describe people, objects and situations",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "big",
                "english": "big",
                "portuguese": "grande",
                "accepted": [
                  "big"
                ]
              },
              {
                "id": "small",
                "english": "small",
                "portuguese": "pequeno",
                "accepted": [
                  "small"
                ]
              },
              {
                "id": "tall",
                "english": "tall",
                "portuguese": "alto",
                "accepted": [
                  "tall"
                ]
              },
              {
                "id": "short",
                "english": "short",
                "portuguese": "baixo / curto",
                "accepted": [
                  "short"
                ]
              },
              {
                "id": "old",
                "english": "old",
                "portuguese": "velho / antigo",
                "accepted": [
                  "old"
                ]
              },
              {
                "id": "young",
                "english": "young",
                "portuguese": "jovem",
                "accepted": [
                  "young"
                ]
              },
              {
                "id": "hot",
                "english": "hot",
                "portuguese": "quente",
                "accepted": [
                  "hot"
                ]
              },
              {
                "id": "cold",
                "english": "cold",
                "portuguese": "frio",
                "accepted": [
                  "cold"
                ]
              },
              {
                "id": "beautiful",
                "english": "beautiful",
                "portuguese": "bonito",
                "accepted": [
                  "beautiful"
                ]
              },
              {
                "id": "easy",
                "english": "easy",
                "portuguese": "fácil",
                "accepted": [
                  "easy"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "good",
                "english": "good",
                "portuguese": "bom",
                "accepted": [
                  "good"
                ]
              },
              {
                "id": "bad",
                "english": "bad",
                "portuguese": "ruim",
                "accepted": [
                  "bad"
                ]
              },
              {
                "id": "new",
                "english": "new",
                "portuguese": "novo",
                "accepted": [
                  "new"
                ]
              },
              {
                "id": "strong",
                "english": "strong",
                "portuguese": "forte",
                "accepted": [
                  "strong"
                ]
              },
              {
                "id": "weak",
                "english": "weak",
                "portuguese": "fraco",
                "accepted": [
                  "weak"
                ]
              },
              {
                "id": "clean",
                "english": "clean",
                "portuguese": "limpo",
                "accepted": [
                  "clean"
                ]
              },
              {
                "id": "dirty",
                "english": "dirty",
                "portuguese": "sujo",
                "accepted": [
                  "dirty"
                ]
              },
              {
                "id": "heavy",
                "english": "heavy",
                "portuguese": "pesado",
                "accepted": [
                  "heavy"
                ]
              },
              {
                "id": "light-adjective",
                "english": "light",
                "portuguese": "leve",
                "accepted": [
                  "light"
                ]
              },
              {
                "id": "friendly",
                "english": "friendly",
                "portuguese": "amigável",
                "accepted": [
                  "friendly"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "crowded",
                "english": "crowded",
                "portuguese": "lotado",
                "accepted": [
                  "crowded"
                ]
              },
              {
                "id": "reliable",
                "english": "reliable",
                "portuguese": "confiável",
                "accepted": [
                  "reliable"
                ]
              },
              {
                "id": "stubborn",
                "english": "stubborn",
                "portuguese": "teimoso",
                "accepted": [
                  "stubborn"
                ]
              },
              {
                "id": "awkward",
                "english": "awkward",
                "portuguese": "desajeitado / constrangedor",
                "accepted": [
                  "awkward"
                ]
              },
              {
                "id": "affordable",
                "english": "affordable",
                "portuguese": "acessível (preço)",
                "accepted": [
                  "affordable"
                ]
              },
              {
                "id": "spacious",
                "english": "spacious",
                "portuguese": "espaçoso",
                "accepted": [
                  "spacious"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "tedious",
                "english": "tedious",
                "portuguese": "tedioso",
                "accepted": [
                  "tedious"
                ]
              },
              {
                "id": "versatile",
                "english": "versatile",
                "portuguese": "versátil",
                "accepted": [
                  "versatile"
                ]
              },
              {
                "id": "fragile",
                "english": "fragile",
                "portuguese": "frágil",
                "accepted": [
                  "fragile"
                ]
              },
              {
                "id": "scarce",
                "english": "scarce",
                "portuguese": "escasso",
                "accepted": [
                  "scarce"
                ]
              },
              {
                "id": "witty",
                "english": "witty",
                "portuguese": "espirituoso / perspicaz",
                "accepted": [
                  "witty"
                ]
              },
              {
                "id": "thorough",
                "english": "thorough",
                "portuguese": "minucioso / completo",
                "accepted": [
                  "thorough"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "feelings": {
    "id": "feelings",
    "title": "Feelings",
    "icon": "images/topics/feelings.png",
    "description": "Common emotions and ways to describe how you feel",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "happy",
                "english": "happy",
                "portuguese": "feliz",
                "accepted": [
                  "happy"
                ]
              },
              {
                "id": "sad",
                "english": "sad",
                "portuguese": "triste",
                "accepted": [
                  "sad"
                ]
              },
              {
                "id": "angry",
                "english": "angry",
                "portuguese": "com raiva",
                "accepted": [
                  "angry"
                ]
              },
              {
                "id": "tired",
                "english": "tired",
                "portuguese": "cansado",
                "accepted": [
                  "tired"
                ]
              },
              {
                "id": "scared",
                "english": "scared",
                "portuguese": "assustado",
                "accepted": [
                  "scared"
                ]
              },
              {
                "id": "nervous",
                "english": "nervous",
                "portuguese": "nervoso",
                "accepted": [
                  "nervous"
                ]
              },
              {
                "id": "excited",
                "english": "excited",
                "portuguese": "animado / empolgado",
                "accepted": [
                  "excited"
                ]
              },
              {
                "id": "bored",
                "english": "bored",
                "portuguese": "entediado",
                "accepted": [
                  "bored"
                ]
              },
              {
                "id": "worried",
                "english": "worried",
                "portuguese": "preocupado",
                "accepted": [
                  "worried"
                ]
              },
              {
                "id": "calm",
                "english": "calm",
                "portuguese": "calmo",
                "accepted": [
                  "calm"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "surprised",
                "english": "surprised",
                "portuguese": "surpreso",
                "accepted": [
                  "surprised"
                ]
              },
              {
                "id": "confused",
                "english": "confused",
                "portuguese": "confuso",
                "accepted": [
                  "confused"
                ]
              },
              {
                "id": "relaxed",
                "english": "relaxed",
                "portuguese": "relaxado",
                "accepted": [
                  "relaxed"
                ]
              },
              {
                "id": "lonely",
                "english": "lonely",
                "portuguese": "solitário",
                "accepted": [
                  "lonely"
                ]
              },
              {
                "id": "proud",
                "english": "proud",
                "portuguese": "orgulhoso",
                "accepted": [
                  "proud"
                ]
              },
              {
                "id": "jealous",
                "english": "jealous",
                "portuguese": "ciumento",
                "accepted": [
                  "jealous"
                ]
              },
              {
                "id": "curious",
                "english": "curious",
                "portuguese": "curioso",
                "accepted": [
                  "curious"
                ]
              },
              {
                "id": "hopeful",
                "english": "hopeful",
                "portuguese": "esperançoso",
                "accepted": [
                  "hopeful"
                ]
              },
              {
                "id": "upset",
                "english": "upset",
                "portuguese": "chateado",
                "accepted": [
                  "upset"
                ]
              },
              {
                "id": "grateful",
                "english": "grateful",
                "portuguese": "grato",
                "accepted": [
                  "grateful"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "frustrated",
                "english": "frustrated",
                "portuguese": "frustrado",
                "accepted": [
                  "frustrated"
                ]
              },
              {
                "id": "embarrassed",
                "english": "embarrassed",
                "portuguese": "envergonhado",
                "accepted": [
                  "embarrassed"
                ]
              },
              {
                "id": "disappointed",
                "english": "disappointed",
                "portuguese": "decepcionado",
                "accepted": [
                  "disappointed"
                ]
              },
              {
                "id": "relieved",
                "english": "relieved",
                "portuguese": "aliviado",
                "accepted": [
                  "relieved"
                ]
              },
              {
                "id": "overwhelmed",
                "english": "overwhelmed",
                "portuguese": "sobrecarregado",
                "accepted": [
                  "overwhelmed"
                ]
              },
              {
                "id": "resentful",
                "english": "resentful",
                "portuguese": "ressentido",
                "accepted": [
                  "resentful"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "apprehensive",
                "english": "apprehensive",
                "portuguese": "apreensivo",
                "accepted": [
                  "apprehensive"
                ]
              },
              {
                "id": "nostalgic",
                "english": "nostalgic",
                "portuguese": "nostálgico",
                "accepted": [
                  "nostalgic"
                ]
              },
              {
                "id": "guilty",
                "english": "guilty",
                "portuguese": "culpado",
                "accepted": [
                  "guilty"
                ]
              },
              {
                "id": "insecure",
                "english": "insecure",
                "portuguese": "inseguro",
                "accepted": [
                  "insecure"
                ]
              },
              {
                "id": "homesick",
                "english": "homesick",
                "portuguese": "com saudade de casa",
                "accepted": [
                  "homesick"
                ]
              },
              {
                "id": "elated",
                "english": "elated",
                "portuguese": "eufórico / muito feliz",
                "accepted": [
                  "elated"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "house": {
    "id": "house",
    "title": "Parts of the House",
    "icon": "images/topics/house.png",
    "description": "Rooms and areas found around a home",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "kitchen-room",
                "english": "kitchen",
                "portuguese": "cozinha",
                "accepted": [
                  "kitchen"
                ]
              },
              {
                "id": "bathroom-room",
                "english": "bathroom",
                "portuguese": "banheiro",
                "accepted": [
                  "bathroom",
                  "restroom"
                ]
              },
              {
                "id": "bedroom-room",
                "english": "bedroom",
                "portuguese": "quarto",
                "accepted": [
                  "bedroom"
                ]
              },
              {
                "id": "living-room",
                "english": "living room",
                "portuguese": "sala de estar",
                "accepted": [
                  "living room"
                ]
              },
              {
                "id": "dining-room",
                "english": "dining room",
                "portuguese": "sala de jantar",
                "accepted": [
                  "dining room"
                ]
              },
              {
                "id": "garage",
                "english": "garage",
                "portuguese": "garagem",
                "accepted": [
                  "garage"
                ]
              },
              {
                "id": "yard",
                "english": "yard",
                "portuguese": "quintal",
                "accepted": [
                  "yard",
                  "backyard"
                ]
              },
              {
                "id": "balcony",
                "english": "balcony",
                "portuguese": "varanda / sacada",
                "accepted": [
                  "balcony"
                ]
              },
              {
                "id": "hallway",
                "english": "hallway",
                "portuguese": "corredor",
                "accepted": [
                  "hallway",
                  "hall"
                ]
              },
              {
                "id": "stairs",
                "english": "stairs",
                "portuguese": "escadas",
                "accepted": [
                  "stairs",
                  "staircase"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "roof",
                "english": "roof",
                "portuguese": "telhado",
                "accepted": [
                  "roof"
                ]
              },
              {
                "id": "wall",
                "english": "wall",
                "portuguese": "parede",
                "accepted": [
                  "wall"
                ]
              },
              {
                "id": "floor",
                "english": "floor",
                "portuguese": "piso / chão",
                "accepted": [
                  "floor"
                ]
              },
              {
                "id": "ceiling",
                "english": "ceiling",
                "portuguese": "teto",
                "accepted": [
                  "ceiling"
                ]
              },
              {
                "id": "door",
                "english": "door",
                "portuguese": "porta",
                "accepted": [
                  "door"
                ]
              },
              {
                "id": "window",
                "english": "window",
                "portuguese": "janela",
                "accepted": [
                  "window"
                ]
              },
              {
                "id": "garden",
                "english": "garden",
                "portuguese": "jardim",
                "accepted": [
                  "garden"
                ]
              },
              {
                "id": "driveway",
                "english": "driveway",
                "portuguese": "entrada de carros",
                "accepted": [
                  "driveway"
                ]
              },
              {
                "id": "fence",
                "english": "fence",
                "portuguese": "cerca",
                "accepted": [
                  "fence"
                ]
              },
              {
                "id": "entryway",
                "english": "entryway",
                "portuguese": "entrada / hall de entrada",
                "accepted": [
                  "entryway",
                  "entry way"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "basement",
                "english": "basement",
                "portuguese": "porão / subsolo",
                "accepted": [
                  "basement"
                ]
              },
              {
                "id": "attic",
                "english": "attic",
                "portuguese": "sótão",
                "accepted": [
                  "attic"
                ]
              },
              {
                "id": "pantry",
                "english": "pantry",
                "portuguese": "despensa",
                "accepted": [
                  "pantry"
                ]
              },
              {
                "id": "laundry-room",
                "english": "laundry room",
                "portuguese": "lavanderia",
                "accepted": [
                  "laundry room"
                ]
              },
              {
                "id": "porch",
                "english": "porch",
                "portuguese": "varanda de entrada",
                "accepted": [
                  "porch"
                ]
              },
              {
                "id": "foyer",
                "english": "foyer",
                "portuguese": "hall de entrada",
                "accepted": [
                  "foyer"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "mudroom",
                "english": "mudroom",
                "portuguese": "área de entrada / mudroom",
                "accepted": [
                  "mudroom",
                  "mud room"
                ]
              },
              {
                "id": "sunroom",
                "english": "sunroom",
                "portuguese": "varanda fechada / sala de sol",
                "accepted": [
                  "sunroom",
                  "sun room"
                ]
              },
              {
                "id": "crawl-space",
                "english": "crawl space",
                "portuguese": "espaço rasteiro sob a casa",
                "accepted": [
                  "crawl space"
                ]
              },
              {
                "id": "loft",
                "english": "loft",
                "portuguese": "mezanino / sótão aberto",
                "accepted": [
                  "loft"
                ]
              },
              {
                "id": "guest-room",
                "english": "guest room",
                "portuguese": "quarto de hóspedes",
                "accepted": [
                  "guest room"
                ]
              },
              {
                "id": "utility-room",
                "english": "utility room",
                "portuguese": "área de serviço técnica",
                "accepted": [
                  "utility room"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "bathroom": {
    "id": "bathroom",
    "title": "Bathroom Objects",
    "icon": "images/topics/bathroom.png",
    "description": "Everyday objects commonly found in the bathroom",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "toilet",
                "english": "toilet",
                "portuguese": "vaso sanitário",
                "accepted": [
                  "toilet"
                ]
              },
              {
                "id": "bathroom-sink",
                "english": "sink",
                "portuguese": "pia",
                "accepted": [
                  "sink"
                ],
                "recognitionAliases": [
                  "sync"
                ]
              },
              {
                "id": "shower",
                "english": "shower",
                "portuguese": "chuveiro",
                "accepted": [
                  "shower"
                ]
              },
              {
                "id": "bathtub",
                "english": "bathtub",
                "portuguese": "banheira",
                "accepted": [
                  "bathtub",
                  "tub"
                ]
              },
              {
                "id": "bathroom-mirror",
                "english": "mirror",
                "portuguese": "espelho",
                "accepted": [
                  "mirror"
                ]
              },
              {
                "id": "towel",
                "english": "towel",
                "portuguese": "toalha",
                "accepted": [
                  "towel"
                ]
              },
              {
                "id": "toothbrush",
                "english": "toothbrush",
                "portuguese": "escova de dentes",
                "accepted": [
                  "toothbrush"
                ]
              },
              {
                "id": "toothpaste",
                "english": "toothpaste",
                "portuguese": "pasta de dente",
                "accepted": [
                  "toothpaste"
                ]
              },
              {
                "id": "soap",
                "english": "soap",
                "portuguese": "sabonete",
                "accepted": [
                  "soap"
                ]
              },
              {
                "id": "toilet-paper",
                "english": "toilet paper",
                "portuguese": "papel higiênico",
                "accepted": [
                  "toilet paper"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "shampoo",
                "english": "shampoo",
                "portuguese": "xampu",
                "accepted": [
                  "shampoo"
                ]
              },
              {
                "id": "conditioner",
                "english": "conditioner",
                "portuguese": "condicionador",
                "accepted": [
                  "conditioner"
                ]
              },
              {
                "id": "hairbrush",
                "english": "hairbrush",
                "portuguese": "escova de cabelo",
                "accepted": [
                  "hairbrush",
                  "hair brush"
                ]
              },
              {
                "id": "comb",
                "english": "comb",
                "portuguese": "pente",
                "accepted": [
                  "comb"
                ]
              },
              {
                "id": "hair-dryer",
                "english": "hair dryer",
                "portuguese": "secador de cabelo",
                "accepted": [
                  "hair dryer",
                  "blow dryer"
                ]
              },
              {
                "id": "trash-can",
                "english": "trash can",
                "portuguese": "lixeira",
                "accepted": [
                  "trash can",
                  "garbage can"
                ]
              },
              {
                "id": "scale",
                "english": "scale",
                "portuguese": "balança",
                "accepted": [
                  "scale",
                  "bathroom scale"
                ]
              },
              {
                "id": "mouthwash",
                "english": "mouthwash",
                "portuguese": "enxaguante bucal",
                "accepted": [
                  "mouthwash",
                  "mouth wash"
                ]
              },
              {
                "id": "dental-floss",
                "english": "dental floss",
                "portuguese": "fio dental",
                "accepted": [
                  "dental floss",
                  "floss"
                ]
              },
              {
                "id": "washcloth",
                "english": "washcloth",
                "portuguese": "toalhinha de banho",
                "accepted": [
                  "washcloth",
                  "wash cloth"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "faucet",
                "english": "faucet",
                "portuguese": "torneira",
                "accepted": [
                  "faucet",
                  "tap"
                ]
              },
              {
                "id": "bath-mat",
                "english": "bath mat",
                "portuguese": "tapete de banheiro",
                "accepted": [
                  "bath mat"
                ]
              },
              {
                "id": "shower-curtain",
                "english": "shower curtain",
                "portuguese": "cortina de chuveiro",
                "accepted": [
                  "shower curtain"
                ]
              },
              {
                "id": "plunger",
                "english": "plunger",
                "portuguese": "desentupidor",
                "accepted": [
                  "plunger"
                ]
              },
              {
                "id": "razor",
                "english": "razor",
                "portuguese": "aparelho de barbear",
                "accepted": [
                  "razor"
                ]
              },
              {
                "id": "toilet-brush",
                "english": "toilet brush",
                "portuguese": "escova sanitária",
                "accepted": [
                  "toilet brush"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "medicine-cabinet",
                "english": "medicine cabinet",
                "portuguese": "armário de remédios",
                "accepted": [
                  "medicine cabinet"
                ]
              },
              {
                "id": "towel-rack",
                "english": "towel rack",
                "portuguese": "toalheiro",
                "accepted": [
                  "towel rack"
                ]
              },
              {
                "id": "showerhead",
                "english": "showerhead",
                "portuguese": "chuveiro / ducha",
                "accepted": [
                  "showerhead",
                  "shower head"
                ]
              },
              {
                "id": "soap-dispenser",
                "english": "soap dispenser",
                "portuguese": "dispenser de sabonete",
                "accepted": [
                  "soap dispenser"
                ]
              },
              {
                "id": "bidet",
                "english": "bidet",
                "portuguese": "bidê",
                "accepted": [
                  "bidet"
                ]
              },
              {
                "id": "vanity",
                "english": "vanity",
                "portuguese": "gabinete com pia / penteadeira",
                "accepted": [
                  "vanity",
                  "bathroom vanity"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "bedroom": {
    "id": "bedroom",
    "title": "Bedroom Objects",
    "icon": "images/topics/bedroom.png",
    "description": "Furniture and objects commonly found in a bedroom",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "bed",
                "english": "bed",
                "portuguese": "cama",
                "accepted": [
                  "bed"
                ]
              },
              {
                "id": "pillow",
                "english": "pillow",
                "portuguese": "travesseiro",
                "accepted": [
                  "pillow"
                ]
              },
              {
                "id": "blanket",
                "english": "blanket",
                "portuguese": "cobertor",
                "accepted": [
                  "blanket"
                ]
              },
              {
                "id": "sheet",
                "english": "sheet",
                "portuguese": "lençol",
                "accepted": [
                  "sheet",
                  "bed sheet"
                ]
              },
              {
                "id": "dresser",
                "english": "dresser",
                "portuguese": "cômoda",
                "accepted": [
                  "dresser"
                ]
              },
              {
                "id": "nightstand",
                "english": "nightstand",
                "portuguese": "criado-mudo / mesa de cabeceira",
                "accepted": [
                  "nightstand",
                  "bedside table"
                ]
              },
              {
                "id": "bedroom-lamp",
                "english": "lamp",
                "portuguese": "abajur / luminária",
                "accepted": [
                  "lamp"
                ]
              },
              {
                "id": "closet",
                "english": "closet",
                "portuguese": "armário / closet",
                "accepted": [
                  "closet"
                ]
              },
              {
                "id": "alarm-clock",
                "english": "alarm clock",
                "portuguese": "despertador",
                "accepted": [
                  "alarm clock"
                ]
              },
              {
                "id": "bedroom-rug",
                "english": "rug",
                "portuguese": "tapete",
                "accepted": [
                  "rug"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "desk",
                "english": "desk",
                "portuguese": "escrivaninha",
                "accepted": [
                  "desk"
                ]
              },
              {
                "id": "chair",
                "english": "chair",
                "portuguese": "cadeira",
                "accepted": [
                  "chair"
                ]
              },
              {
                "id": "bedroom-mirror",
                "english": "mirror",
                "portuguese": "espelho",
                "accepted": [
                  "mirror"
                ]
              },
              {
                "id": "bedroom-curtains",
                "english": "curtains",
                "portuguese": "cortinas",
                "accepted": [
                  "curtains",
                  "curtain"
                ]
              },
              {
                "id": "ceiling-fan",
                "english": "ceiling fan",
                "portuguese": "ventilador de teto",
                "accepted": [
                  "ceiling fan"
                ]
              },
              {
                "id": "laundry-basket",
                "english": "laundry basket",
                "portuguese": "cesto de roupa",
                "accepted": [
                  "laundry basket",
                  "hamper"
                ]
              },
              {
                "id": "pajamas",
                "english": "pajamas",
                "portuguese": "pijama",
                "accepted": [
                  "pajamas",
                  "pyjamas"
                ]
              },
              {
                "id": "slippers",
                "english": "slippers",
                "portuguese": "chinelos de quarto",
                "accepted": [
                  "slippers"
                ]
              },
              {
                "id": "bedroom-bookshelf",
                "english": "bookshelf",
                "portuguese": "estante de livros",
                "accepted": [
                  "bookshelf",
                  "bookcase"
                ]
              },
              {
                "id": "drawer",
                "english": "drawer",
                "portuguese": "gaveta",
                "accepted": [
                  "drawer"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "headboard",
                "english": "headboard",
                "portuguese": "cabeceira da cama",
                "accepted": [
                  "headboard"
                ]
              },
              {
                "id": "mattress",
                "english": "mattress",
                "portuguese": "colchão",
                "accepted": [
                  "mattress"
                ]
              },
              {
                "id": "comforter",
                "english": "comforter",
                "portuguese": "edredom",
                "accepted": [
                  "comforter"
                ]
              },
              {
                "id": "pillowcase",
                "english": "pillowcase",
                "portuguese": "fronha",
                "accepted": [
                  "pillowcase"
                ]
              },
              {
                "id": "clothes-hanger",
                "english": "clothes hanger",
                "portuguese": "cabide",
                "accepted": [
                  "clothes hanger",
                  "hanger"
                ]
              },
              {
                "id": "bed-frame",
                "english": "bed frame",
                "portuguese": "estrutura da cama",
                "accepted": [
                  "bed frame"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "fitted-sheet",
                "english": "fitted sheet",
                "portuguese": "lençol com elástico",
                "accepted": [
                  "fitted sheet"
                ]
              },
              {
                "id": "top-sheet",
                "english": "top sheet",
                "portuguese": "lençol de cima",
                "accepted": [
                  "top sheet",
                  "flat sheet"
                ]
              },
              {
                "id": "duvet-cover",
                "english": "duvet cover",
                "portuguese": "capa de edredom",
                "accepted": [
                  "duvet cover"
                ]
              },
              {
                "id": "blackout-curtains",
                "english": "blackout curtains",
                "portuguese": "cortinas blackout",
                "accepted": [
                  "blackout curtains",
                  "blackout curtain"
                ]
              },
              {
                "id": "vanity-table",
                "english": "vanity table",
                "portuguese": "penteadeira",
                "accepted": [
                  "vanity table",
                  "dressing table"
                ]
              },
              {
                "id": "bedside-lamp",
                "english": "bedside lamp",
                "portuguese": "abajur de cabeceira",
                "accepted": [
                  "bedside lamp"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "livingRoom": {
    "id": "livingRoom",
    "title": "Living Room Objects",
    "icon": "images/topics/living-room.png",
    "description": "Furniture and objects used in the living room",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "sofa",
                "english": "sofa",
                "portuguese": "sofá",
                "accepted": [
                  "sofa",
                  "couch"
                ]
              },
              {
                "id": "armchair",
                "english": "armchair",
                "portuguese": "poltrona",
                "accepted": [
                  "armchair"
                ]
              },
              {
                "id": "coffee-table",
                "english": "coffee table",
                "portuguese": "mesa de centro",
                "accepted": [
                  "coffee table"
                ]
              },
              {
                "id": "television",
                "english": "television",
                "portuguese": "televisão",
                "accepted": [
                  "television",
                  "tv"
                ]
              },
              {
                "id": "remote-control",
                "english": "remote control",
                "portuguese": "controle remoto",
                "accepted": [
                  "remote control",
                  "remote"
                ]
              },
              {
                "id": "living-room-rug",
                "english": "rug",
                "portuguese": "tapete",
                "accepted": [
                  "rug"
                ]
              },
              {
                "id": "curtain",
                "english": "curtain",
                "portuguese": "cortina",
                "accepted": [
                  "curtain",
                  "curtains"
                ]
              },
              {
                "id": "bookshelf",
                "english": "bookshelf",
                "portuguese": "estante de livros",
                "accepted": [
                  "bookshelf",
                  "bookcase"
                ]
              },
              {
                "id": "living-room-lamp",
                "english": "lamp",
                "portuguese": "luminária / abajur",
                "accepted": [
                  "lamp"
                ]
              },
              {
                "id": "cushion",
                "english": "cushion",
                "portuguese": "almofada",
                "accepted": [
                  "cushion",
                  "pillow"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "fireplace",
                "english": "fireplace",
                "portuguese": "lareira",
                "accepted": [
                  "fireplace"
                ]
              },
              {
                "id": "tv-stand",
                "english": "TV stand",
                "portuguese": "rack de TV",
                "accepted": [
                  "tv stand",
                  "television stand"
                ]
              },
              {
                "id": "wall-clock",
                "english": "wall clock",
                "portuguese": "relógio de parede",
                "accepted": [
                  "wall clock"
                ]
              },
              {
                "id": "picture-frame",
                "english": "picture frame",
                "portuguese": "porta-retrato",
                "accepted": [
                  "picture frame"
                ]
              },
              {
                "id": "houseplant",
                "english": "plant",
                "portuguese": "planta",
                "accepted": [
                  "plant",
                  "houseplant"
                ]
              },
              {
                "id": "speaker",
                "english": "speaker",
                "portuguese": "caixa de som",
                "accepted": [
                  "speaker"
                ]
              },
              {
                "id": "living-room-fan",
                "english": "fan",
                "portuguese": "ventilador",
                "accepted": [
                  "fan"
                ]
              },
              {
                "id": "floor-lamp",
                "english": "floor lamp",
                "portuguese": "luminária de chão",
                "accepted": [
                  "floor lamp"
                ]
              },
              {
                "id": "cabinet",
                "english": "cabinet",
                "portuguese": "armário",
                "accepted": [
                  "cabinet"
                ]
              },
              {
                "id": "living-room-window",
                "english": "window",
                "portuguese": "janela",
                "accepted": [
                  "window"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "recliner",
                "english": "recliner",
                "portuguese": "poltrona reclinável",
                "accepted": [
                  "recliner"
                ]
              },
              {
                "id": "ottoman",
                "english": "ottoman",
                "portuguese": "pufe / apoio para os pés",
                "accepted": [
                  "ottoman"
                ]
              },
              {
                "id": "side-table",
                "english": "side table",
                "portuguese": "mesa lateral",
                "accepted": [
                  "side table",
                  "end table"
                ]
              },
              {
                "id": "entertainment-center",
                "english": "entertainment center",
                "portuguese": "rack / móvel de TV",
                "accepted": [
                  "entertainment center"
                ]
              },
              {
                "id": "throw-blanket",
                "english": "throw blanket",
                "portuguese": "manta decorativa",
                "accepted": [
                  "throw blanket",
                  "throw"
                ]
              },
              {
                "id": "sectional-sofa",
                "english": "sectional sofa",
                "portuguese": "sofá modular / de canto",
                "accepted": [
                  "sectional sofa",
                  "sectional"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "media-console",
                "english": "media console",
                "portuguese": "console / rack de mídia",
                "accepted": [
                  "media console"
                ]
              },
              {
                "id": "mantel",
                "english": "mantel",
                "portuguese": "prateleira da lareira",
                "accepted": [
                  "mantel",
                  "mantelpiece"
                ]
              },
              {
                "id": "accent-chair",
                "english": "accent chair",
                "portuguese": "poltrona decorativa",
                "accepted": [
                  "accent chair"
                ]
              },
              {
                "id": "nesting-tables",
                "english": "nesting tables",
                "portuguese": "mesas encaixáveis",
                "accepted": [
                  "nesting tables"
                ]
              },
              {
                "id": "window-blinds",
                "english": "window blinds",
                "portuguese": "persianas",
                "accepted": [
                  "window blinds",
                  "blinds"
                ]
              },
              {
                "id": "wall-sconce",
                "english": "wall sconce",
                "portuguese": "arandela",
                "accepted": [
                  "wall sconce",
                  "sconce"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "body": {
    "id": "body",
    "title": "Body Parts",
    "icon": "images/topics/body.png",
    "description": "Basic and useful vocabulary for parts of the body",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "head",
                "english": "head",
                "portuguese": "cabeça",
                "accepted": [
                  "head"
                ]
              },
              {
                "id": "face",
                "english": "face",
                "portuguese": "rosto",
                "accepted": [
                  "face"
                ]
              },
              {
                "id": "eye",
                "english": "eye",
                "portuguese": "olho",
                "accepted": [
                  "eye"
                ]
              },
              {
                "id": "ear",
                "english": "ear",
                "portuguese": "orelha",
                "accepted": [
                  "ear"
                ]
              },
              {
                "id": "nose",
                "english": "nose",
                "portuguese": "nariz",
                "accepted": [
                  "nose"
                ]
              },
              {
                "id": "mouth",
                "english": "mouth",
                "portuguese": "boca",
                "accepted": [
                  "mouth"
                ]
              },
              {
                "id": "hand",
                "english": "hand",
                "portuguese": "mão",
                "accepted": [
                  "hand"
                ]
              },
              {
                "id": "arm",
                "english": "arm",
                "portuguese": "braço",
                "accepted": [
                  "arm"
                ]
              },
              {
                "id": "leg",
                "english": "leg",
                "portuguese": "perna",
                "accepted": [
                  "leg"
                ]
              },
              {
                "id": "foot",
                "english": "foot",
                "portuguese": "pé",
                "accepted": [
                  "foot"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "hair",
                "english": "hair",
                "portuguese": "cabelo",
                "accepted": [
                  "hair"
                ]
              },
              {
                "id": "neck",
                "english": "neck",
                "portuguese": "pescoço",
                "accepted": [
                  "neck"
                ]
              },
              {
                "id": "back",
                "english": "back",
                "portuguese": "costas",
                "accepted": [
                  "back"
                ]
              },
              {
                "id": "chest",
                "english": "chest",
                "portuguese": "peito",
                "accepted": [
                  "chest"
                ]
              },
              {
                "id": "stomach",
                "english": "stomach",
                "portuguese": "barriga / estômago",
                "accepted": [
                  "stomach"
                ]
              },
              {
                "id": "finger",
                "english": "finger",
                "portuguese": "dedo da mão",
                "accepted": [
                  "finger"
                ]
              },
              {
                "id": "thumb",
                "english": "thumb",
                "portuguese": "polegar",
                "accepted": [
                  "thumb"
                ]
              },
              {
                "id": "toe",
                "english": "toe",
                "portuguese": "dedo do pé",
                "accepted": [
                  "toe"
                ]
              },
              {
                "id": "teeth",
                "english": "teeth",
                "portuguese": "dentes",
                "accepted": [
                  "teeth"
                ]
              },
              {
                "id": "tongue",
                "english": "tongue",
                "portuguese": "língua",
                "accepted": [
                  "tongue"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "wrist",
                "english": "wrist",
                "portuguese": "pulso",
                "accepted": [
                  "wrist"
                ]
              },
              {
                "id": "ankle",
                "english": "ankle",
                "portuguese": "tornozelo",
                "accepted": [
                  "ankle"
                ]
              },
              {
                "id": "elbow",
                "english": "elbow",
                "portuguese": "cotovelo",
                "accepted": [
                  "elbow"
                ]
              },
              {
                "id": "knee",
                "english": "knee",
                "portuguese": "joelho",
                "accepted": [
                  "knee"
                ]
              },
              {
                "id": "shoulder",
                "english": "shoulder",
                "portuguese": "ombro",
                "accepted": [
                  "shoulder"
                ]
              },
              {
                "id": "forearm",
                "english": "forearm",
                "portuguese": "antebraço",
                "accepted": [
                  "forearm"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "palm",
                "english": "palm",
                "portuguese": "palma da mão",
                "accepted": [
                  "palm"
                ]
              },
              {
                "id": "heel",
                "english": "heel",
                "portuguese": "calcanhar",
                "accepted": [
                  "heel"
                ]
              },
              {
                "id": "shin",
                "english": "shin",
                "portuguese": "canela",
                "accepted": [
                  "shin"
                ]
              },
              {
                "id": "calf",
                "english": "calf",
                "portuguese": "panturrilha",
                "accepted": [
                  "calf"
                ]
              },
              {
                "id": "thigh",
                "english": "thigh",
                "portuguese": "coxa",
                "accepted": [
                  "thigh"
                ]
              },
              {
                "id": "hip",
                "english": "hip",
                "portuguese": "quadril",
                "accepted": [
                  "hip"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "summerClothes": {
    "id": "summerClothes",
    "title": "Summer Clothes",
    "icon": "images/topics/summer-clothes.png",
    "description": "Clothes and accessories commonly worn in hot weather",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "t-shirt",
                "english": "T-shirt",
                "portuguese": "camiseta",
                "accepted": [
                  "t-shirt",
                  "t shirt",
                  "tee shirt"
                ]
              },
              {
                "id": "shorts",
                "english": "shorts",
                "portuguese": "shorts",
                "accepted": [
                  "shorts"
                ]
              },
              {
                "id": "tank-top",
                "english": "tank top",
                "portuguese": "regata",
                "accepted": [
                  "tank top"
                ]
              },
              {
                "id": "swimsuit",
                "english": "swimsuit",
                "portuguese": "maiô / roupa de banho",
                "accepted": [
                  "swimsuit",
                  "bathing suit"
                ]
              },
              {
                "id": "sandals",
                "english": "sandals",
                "portuguese": "sandálias",
                "accepted": [
                  "sandals"
                ]
              },
              {
                "id": "flip-flops",
                "english": "flip-flops",
                "portuguese": "chinelos",
                "accepted": [
                  "flip-flops",
                  "flip flops"
                ]
              },
              {
                "id": "cap",
                "english": "cap",
                "portuguese": "boné",
                "accepted": [
                  "cap",
                  "baseball cap"
                ]
              },
              {
                "id": "sunglasses",
                "english": "sunglasses",
                "portuguese": "óculos de sol",
                "accepted": [
                  "sunglasses"
                ]
              },
              {
                "id": "summer-dress",
                "english": "dress",
                "portuguese": "vestido",
                "accepted": [
                  "dress"
                ]
              },
              {
                "id": "skirt",
                "english": "skirt",
                "portuguese": "saia",
                "accepted": [
                  "skirt"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "polo-shirt",
                "english": "polo shirt",
                "portuguese": "camisa polo",
                "accepted": [
                  "polo shirt"
                ]
              },
              {
                "id": "sleeveless-shirt",
                "english": "sleeveless shirt",
                "portuguese": "camisa sem mangas",
                "accepted": [
                  "sleeveless shirt"
                ]
              },
              {
                "id": "denim-shorts",
                "english": "denim shorts",
                "portuguese": "short jeans",
                "accepted": [
                  "denim shorts",
                  "jean shorts"
                ]
              },
              {
                "id": "sundress",
                "english": "sundress",
                "portuguese": "vestido de verão",
                "accepted": [
                  "sundress",
                  "sun dress"
                ]
              },
              {
                "id": "straw-hat",
                "english": "straw hat",
                "portuguese": "chapéu de palha",
                "accepted": [
                  "straw hat"
                ]
              },
              {
                "id": "canvas-shoes",
                "english": "canvas shoes",
                "portuguese": "tênis de lona",
                "accepted": [
                  "canvas shoes"
                ]
              },
              {
                "id": "beach-shirt",
                "english": "beach shirt",
                "portuguese": "camisa de praia",
                "accepted": [
                  "beach shirt"
                ]
              },
              {
                "id": "beach-shorts",
                "english": "beach shorts",
                "portuguese": "shorts de praia",
                "accepted": [
                  "beach shorts"
                ]
              },
              {
                "id": "light-blouse",
                "english": "light blouse",
                "portuguese": "blusa leve",
                "accepted": [
                  "light blouse"
                ]
              },
              {
                "id": "cotton-pants",
                "english": "cotton pants",
                "portuguese": "calça de algodão",
                "accepted": [
                  "cotton pants"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "swim-trunks",
                "english": "swim trunks",
                "portuguese": "shorts de banho masculino",
                "accepted": [
                  "swim trunks",
                  "swimming trunks"
                ]
              },
              {
                "id": "bikini",
                "english": "bikini",
                "portuguese": "biquíni",
                "accepted": [
                  "bikini"
                ]
              },
              {
                "id": "sun-hat",
                "english": "sun hat",
                "portuguese": "chapéu de sol",
                "accepted": [
                  "sun hat"
                ]
              },
              {
                "id": "linen-shirt",
                "english": "linen shirt",
                "portuguese": "camisa de linho",
                "accepted": [
                  "linen shirt"
                ]
              },
              {
                "id": "romper",
                "english": "romper",
                "portuguese": "macaquinho",
                "accepted": [
                  "romper"
                ]
              },
              {
                "id": "rash-guard",
                "english": "rash guard",
                "portuguese": "camisa de proteção UV",
                "accepted": [
                  "rash guard"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "board-shorts",
                "english": "board shorts",
                "portuguese": "bermuda de surfe",
                "accepted": [
                  "board shorts"
                ]
              },
              {
                "id": "cover-up",
                "english": "cover-up",
                "portuguese": "saída de praia",
                "accepted": [
                  "cover up",
                  "cover-up",
                  "beach cover up"
                ]
              },
              {
                "id": "sarong",
                "english": "sarong",
                "portuguese": "canga / sarongue",
                "accepted": [
                  "sarong"
                ]
              },
              {
                "id": "espadrilles",
                "english": "espadrilles",
                "portuguese": "alpargatas",
                "accepted": [
                  "espadrilles"
                ]
              },
              {
                "id": "halter-top",
                "english": "halter top",
                "portuguese": "blusa frente única",
                "accepted": [
                  "halter top"
                ]
              },
              {
                "id": "bucket-hat",
                "english": "bucket hat",
                "portuguese": "chapéu bucket",
                "accepted": [
                  "bucket hat"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "winterClothes": {
    "id": "winterClothes",
    "title": "Winter Clothes",
    "icon": "images/topics/winter-clothes.png",
    "description": "Clothes and accessories used to stay warm in cold weather",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "coat",
                "english": "coat",
                "portuguese": "casaco",
                "accepted": [
                  "coat"
                ]
              },
              {
                "id": "jacket",
                "english": "jacket",
                "portuguese": "jaqueta",
                "accepted": [
                  "jacket"
                ]
              },
              {
                "id": "sweater",
                "english": "sweater",
                "portuguese": "suéter",
                "accepted": [
                  "sweater"
                ]
              },
              {
                "id": "scarf",
                "english": "scarf",
                "portuguese": "cachecol",
                "accepted": [
                  "scarf"
                ]
              },
              {
                "id": "gloves",
                "english": "gloves",
                "portuguese": "luvas",
                "accepted": [
                  "gloves"
                ]
              },
              {
                "id": "beanie",
                "english": "beanie",
                "portuguese": "gorro",
                "accepted": [
                  "beanie"
                ]
              },
              {
                "id": "boots",
                "english": "boots",
                "portuguese": "botas",
                "accepted": [
                  "boots"
                ]
              },
              {
                "id": "winter-pants",
                "english": "pants",
                "portuguese": "calças",
                "accepted": [
                  "pants",
                  "trousers"
                ]
              },
              {
                "id": "winter-socks",
                "english": "socks",
                "portuguese": "meias",
                "accepted": [
                  "socks"
                ]
              },
              {
                "id": "hoodie",
                "english": "hoodie",
                "portuguese": "moletom com capuz",
                "accepted": [
                  "hoodie"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "parka",
                "english": "parka",
                "portuguese": "parka",
                "accepted": [
                  "parka"
                ]
              },
              {
                "id": "wool-socks",
                "english": "wool socks",
                "portuguese": "meias de lã",
                "accepted": [
                  "wool socks"
                ]
              },
              {
                "id": "fleece-jacket",
                "english": "fleece jacket",
                "portuguese": "jaqueta de fleece",
                "accepted": [
                  "fleece jacket"
                ]
              },
              {
                "id": "sweatpants",
                "english": "sweatpants",
                "portuguese": "calça de moletom",
                "accepted": [
                  "sweatpants",
                  "sweat pants"
                ]
              },
              {
                "id": "long-coat",
                "english": "long coat",
                "portuguese": "casaco longo",
                "accepted": [
                  "long coat"
                ]
              },
              {
                "id": "snow-boots",
                "english": "snow boots",
                "portuguese": "botas de neve",
                "accepted": [
                  "snow boots"
                ]
              },
              {
                "id": "knit-hat",
                "english": "knit hat",
                "portuguese": "gorro de tricô",
                "accepted": [
                  "knit hat",
                  "knitted hat"
                ]
              },
              {
                "id": "warm-pajamas",
                "english": "warm pajamas",
                "portuguese": "pijama quente",
                "accepted": [
                  "warm pajamas",
                  "warm pyjamas"
                ]
              },
              {
                "id": "wool-sweater",
                "english": "wool sweater",
                "portuguese": "suéter de lã",
                "accepted": [
                  "wool sweater"
                ]
              },
              {
                "id": "neck-warmer",
                "english": "neck warmer",
                "portuguese": "protetor de pescoço",
                "accepted": [
                  "neck warmer"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "thermal-underwear",
                "english": "thermal underwear",
                "portuguese": "roupa térmica",
                "accepted": [
                  "thermal underwear"
                ]
              },
              {
                "id": "earmuffs",
                "english": "earmuffs",
                "portuguese": "protetores de orelha",
                "accepted": [
                  "earmuffs"
                ]
              },
              {
                "id": "mittens",
                "english": "mittens",
                "portuguese": "luvas sem separação dos dedos",
                "accepted": [
                  "mittens"
                ]
              },
              {
                "id": "turtleneck",
                "english": "turtleneck",
                "portuguese": "gola alta",
                "accepted": [
                  "turtleneck"
                ]
              },
              {
                "id": "puffer-jacket",
                "english": "puffer jacket",
                "portuguese": "jaqueta acolchoada",
                "accepted": [
                  "puffer jacket"
                ]
              },
              {
                "id": "balaclava",
                "english": "balaclava",
                "portuguese": "balaclava / touca ninja",
                "accepted": [
                  "balaclava"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "base-layer",
                "english": "base layer",
                "portuguese": "camada térmica de base",
                "accepted": [
                  "base layer"
                ]
              },
              {
                "id": "ski-jacket",
                "english": "ski jacket",
                "portuguese": "jaqueta de esqui",
                "accepted": [
                  "ski jacket"
                ]
              },
              {
                "id": "snow-pants",
                "english": "snow pants",
                "portuguese": "calça de neve",
                "accepted": [
                  "snow pants"
                ]
              },
              {
                "id": "gaiters",
                "english": "gaiters",
                "portuguese": "polainas impermeáveis",
                "accepted": [
                  "gaiters"
                ]
              },
              {
                "id": "fleece-lined-leggings",
                "english": "fleece-lined leggings",
                "portuguese": "legging forrada com fleece",
                "accepted": [
                  "fleece lined leggings",
                  "fleece-lined leggings"
                ]
              },
              {
                "id": "wool-overcoat",
                "english": "wool overcoat",
                "portuguese": "sobretudo de lã",
                "accepted": [
                  "wool overcoat"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "transitionalClothes": {
    "id": "transitionalClothes",
    "title": "Spring / Autumn Clothes",
    "icon": "images/topics/spring-autumn-clothes.png",
    "description": "Light layers for mild and changing weather",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "light-jacket",
                "english": "light jacket",
                "portuguese": "jaqueta leve",
                "accepted": [
                  "light jacket"
                ]
              },
              {
                "id": "cardigan",
                "english": "cardigan",
                "portuguese": "cardigã",
                "accepted": [
                  "cardigan"
                ]
              },
              {
                "id": "jeans",
                "english": "jeans",
                "portuguese": "calça jeans",
                "accepted": [
                  "jeans"
                ]
              },
              {
                "id": "long-sleeve-shirt",
                "english": "long-sleeve shirt",
                "portuguese": "camisa de manga comprida",
                "accepted": [
                  "long-sleeve shirt",
                  "long sleeve shirt"
                ]
              },
              {
                "id": "sneakers",
                "english": "sneakers",
                "portuguese": "tênis",
                "accepted": [
                  "sneakers",
                  "sneaker"
                ]
              },
              {
                "id": "raincoat",
                "english": "raincoat",
                "portuguese": "capa de chuva",
                "accepted": [
                  "raincoat"
                ]
              },
              {
                "id": "ankle-boots",
                "english": "ankle boots",
                "portuguese": "botas de cano curto",
                "accepted": [
                  "ankle boots"
                ]
              },
              {
                "id": "blouse",
                "english": "blouse",
                "portuguese": "blusa",
                "accepted": [
                  "blouse"
                ]
              },
              {
                "id": "sweatshirt",
                "english": "sweatshirt",
                "portuguese": "moletom",
                "accepted": [
                  "sweatshirt"
                ]
              },
              {
                "id": "vest",
                "english": "vest",
                "portuguese": "colete",
                "accepted": [
                  "vest"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "chinos",
                "english": "chinos",
                "portuguese": "calça chino",
                "accepted": [
                  "chinos"
                ]
              },
              {
                "id": "transitional-polo-shirt",
                "english": "polo shirt",
                "portuguese": "camisa polo",
                "accepted": [
                  "polo shirt"
                ]
              },
              {
                "id": "light-scarf",
                "english": "light scarf",
                "portuguese": "cachecol leve",
                "accepted": [
                  "light scarf"
                ]
              },
              {
                "id": "leggings",
                "english": "leggings",
                "portuguese": "legging",
                "accepted": [
                  "leggings"
                ]
              },
              {
                "id": "light-sweater",
                "english": "light sweater",
                "portuguese": "suéter leve",
                "accepted": [
                  "light sweater"
                ]
              },
              {
                "id": "casual-dress",
                "english": "casual dress",
                "portuguese": "vestido casual",
                "accepted": [
                  "casual dress"
                ]
              },
              {
                "id": "flats",
                "english": "flats",
                "portuguese": "sapatilhas",
                "accepted": [
                  "flats",
                  "flat shoes"
                ]
              },
              {
                "id": "waterproof-shoes",
                "english": "waterproof shoes",
                "portuguese": "sapatos impermeáveis",
                "accepted": [
                  "waterproof shoes"
                ]
              },
              {
                "id": "baseball-cap",
                "english": "baseball cap",
                "portuguese": "boné",
                "accepted": [
                  "baseball cap"
                ]
              },
              {
                "id": "overshirt",
                "english": "overshirt",
                "portuguese": "sobrecamisa",
                "accepted": [
                  "overshirt",
                  "over shirt"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "trench-coat",
                "english": "trench coat",
                "portuguese": "sobretudo impermeável",
                "accepted": [
                  "trench coat"
                ]
              },
              {
                "id": "windbreaker",
                "english": "windbreaker",
                "portuguese": "jaqueta corta-vento",
                "accepted": [
                  "windbreaker"
                ]
              },
              {
                "id": "flannel-shirt",
                "english": "flannel shirt",
                "portuguese": "camisa de flanela",
                "accepted": [
                  "flannel shirt"
                ]
              },
              {
                "id": "loafers",
                "english": "loafers",
                "portuguese": "mocassins",
                "accepted": [
                  "loafers"
                ]
              },
              {
                "id": "denim-jacket",
                "english": "denim jacket",
                "portuguese": "jaqueta jeans",
                "accepted": [
                  "denim jacket",
                  "jean jacket"
                ]
              },
              {
                "id": "quilted-vest",
                "english": "quilted vest",
                "portuguese": "colete matelassê",
                "accepted": [
                  "quilted vest"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "chore-jacket",
                "english": "chore jacket",
                "portuguese": "jaqueta utilitária",
                "accepted": [
                  "chore jacket"
                ]
              },
              {
                "id": "field-jacket",
                "english": "field jacket",
                "portuguese": "jaqueta de campo",
                "accepted": [
                  "field jacket"
                ]
              },
              {
                "id": "rain-boots",
                "english": "rain boots",
                "portuguese": "botas de chuva",
                "accepted": [
                  "rain boots"
                ]
              },
              {
                "id": "chelsea-boots",
                "english": "Chelsea boots",
                "portuguese": "botas Chelsea",
                "accepted": [
                  "chelsea boots"
                ]
              },
              {
                "id": "shawl",
                "english": "shawl",
                "portuguese": "xale",
                "accepted": [
                  "shawl"
                ]
              },
              {
                "id": "knit-blazer",
                "english": "knit blazer",
                "portuguese": "blazer de malha",
                "accepted": [
                  "knit blazer"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "airport": {
    "id": "airport",
    "title": "Airport Vocabulary",
    "icon": "images/topics/airport.png",
    "description": "Essential words for navigating an airport and taking a flight",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "airport",
                "english": "airport",
                "portuguese": "aeroporto",
                "accepted": [
                  "airport"
                ]
              },
              {
                "id": "flight",
                "english": "flight",
                "portuguese": "voo",
                "accepted": [
                  "flight"
                ]
              },
              {
                "id": "boarding-pass",
                "english": "boarding pass",
                "portuguese": "cartão de embarque",
                "accepted": [
                  "boarding pass"
                ]
              },
              {
                "id": "passport",
                "english": "passport",
                "portuguese": "passaporte",
                "accepted": [
                  "passport"
                ]
              },
              {
                "id": "gate",
                "english": "gate",
                "portuguese": "portão de embarque",
                "accepted": [
                  "gate"
                ]
              },
              {
                "id": "luggage",
                "english": "luggage",
                "portuguese": "bagagem",
                "accepted": [
                  "luggage",
                  "baggage"
                ]
              },
              {
                "id": "suitcase",
                "english": "suitcase",
                "portuguese": "mala",
                "accepted": [
                  "suitcase"
                ]
              },
              {
                "id": "check-in",
                "english": "check-in",
                "portuguese": "check-in / despacho",
                "accepted": [
                  "check-in",
                  "check in"
                ]
              },
              {
                "id": "security",
                "english": "security",
                "portuguese": "segurança / inspeção",
                "accepted": [
                  "security"
                ]
              },
              {
                "id": "terminal",
                "english": "terminal",
                "portuguese": "terminal",
                "accepted": [
                  "terminal"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "airline",
                "english": "airline",
                "portuguese": "companhia aérea",
                "accepted": [
                  "airline"
                ]
              },
              {
                "id": "ticket",
                "english": "ticket",
                "portuguese": "passagem / bilhete",
                "accepted": [
                  "ticket",
                  "plane ticket"
                ]
              },
              {
                "id": "departure",
                "english": "departure",
                "portuguese": "partida",
                "accepted": [
                  "departure"
                ]
              },
              {
                "id": "arrival",
                "english": "arrival",
                "portuguese": "chegada",
                "accepted": [
                  "arrival"
                ]
              },
              {
                "id": "seat",
                "english": "seat",
                "portuguese": "assento",
                "accepted": [
                  "seat"
                ]
              },
              {
                "id": "aisle",
                "english": "aisle",
                "portuguese": "corredor",
                "accepted": [
                  "aisle"
                ]
              },
              {
                "id": "carry-on",
                "english": "carry-on",
                "portuguese": "bagagem de mão",
                "accepted": [
                  "carry on",
                  "carry-on",
                  "carry-on bag"
                ]
              },
              {
                "id": "backpack",
                "english": "backpack",
                "portuguese": "mochila",
                "accepted": [
                  "backpack"
                ]
              },
              {
                "id": "flight-attendant",
                "english": "flight attendant",
                "portuguese": "comissário de bordo",
                "accepted": [
                  "flight attendant"
                ]
              },
              {
                "id": "pilot",
                "english": "pilot",
                "portuguese": "piloto",
                "accepted": [
                  "pilot"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "layover",
                "english": "layover",
                "portuguese": "conexão / escala",
                "accepted": [
                  "layover"
                ]
              },
              {
                "id": "customs",
                "english": "customs",
                "portuguese": "alfândega",
                "accepted": [
                  "customs"
                ]
              },
              {
                "id": "immigration",
                "english": "immigration",
                "portuguese": "imigração",
                "accepted": [
                  "immigration"
                ]
              },
              {
                "id": "baggage-claim",
                "english": "baggage claim",
                "portuguese": "retirada de bagagem",
                "accepted": [
                  "baggage claim",
                  "luggage claim"
                ]
              },
              {
                "id": "boarding",
                "english": "boarding",
                "portuguese": "embarque",
                "accepted": [
                  "boarding"
                ]
              },
              {
                "id": "connecting-flight",
                "english": "connecting flight",
                "portuguese": "voo de conexão",
                "accepted": [
                  "connecting flight"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "departure-board",
                "english": "departure board",
                "portuguese": "painel de partidas",
                "accepted": [
                  "departure board"
                ]
              },
              {
                "id": "arrival-board",
                "english": "arrival board",
                "portuguese": "painel de chegadas",
                "accepted": [
                  "arrival board"
                ]
              },
              {
                "id": "overhead-bin",
                "english": "overhead bin",
                "portuguese": "compartimento de bagagem superior",
                "accepted": [
                  "overhead bin"
                ]
              },
              {
                "id": "jet-bridge",
                "english": "jet bridge",
                "portuguese": "ponte de embarque / finger",
                "accepted": [
                  "jet bridge"
                ]
              },
              {
                "id": "travel-document",
                "english": "travel document",
                "portuguese": "documento de viagem",
                "accepted": [
                  "travel document"
                ]
              },
              {
                "id": "baggage-allowance",
                "english": "baggage allowance",
                "portuguese": "franquia de bagagem",
                "accepted": [
                  "baggage allowance"
                ]
              }
            ]
          }
        ]
      }
    }
  },
  "linkingWords": {
    "id": "linkingWords",
    "title": "Linking Words",
    "icon": "images/topics/linking-words.png",
    "description": "Connect ideas and make sentences flow more naturally",
    "englishVariant": "en-US",
    "levels": {
      "common": {
        "id": "common",
        "label": "Common",
        "volumeSize": 10,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "and",
                "english": "and",
                "portuguese": "e",
                "accepted": [
                  "and"
                ]
              },
              {
                "id": "but",
                "english": "but",
                "portuguese": "mas",
                "accepted": [
                  "but"
                ]
              },
              {
                "id": "because",
                "english": "because",
                "portuguese": "porque",
                "accepted": [
                  "because"
                ]
              },
              {
                "id": "so",
                "english": "so",
                "portuguese": "então / por isso",
                "accepted": [
                  "so"
                ]
              },
              {
                "id": "or",
                "english": "or",
                "portuguese": "ou",
                "accepted": [
                  "or"
                ]
              },
              {
                "id": "then",
                "english": "then",
                "portuguese": "então / depois",
                "accepted": [
                  "then"
                ]
              },
              {
                "id": "also",
                "english": "also",
                "portuguese": "também",
                "accepted": [
                  "also"
                ]
              },
              {
                "id": "first",
                "english": "first",
                "portuguese": "primeiro",
                "accepted": [
                  "first"
                ]
              },
              {
                "id": "next",
                "english": "next",
                "portuguese": "em seguida",
                "accepted": [
                  "next"
                ]
              },
              {
                "id": "finally",
                "english": "finally",
                "portuguese": "finalmente",
                "accepted": [
                  "finally"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "before",
                "english": "before",
                "portuguese": "antes",
                "accepted": [
                  "before"
                ]
              },
              {
                "id": "after",
                "english": "after",
                "portuguese": "depois",
                "accepted": [
                  "after"
                ]
              },
              {
                "id": "when",
                "english": "when",
                "portuguese": "quando",
                "accepted": [
                  "when"
                ]
              },
              {
                "id": "while",
                "english": "while",
                "portuguese": "enquanto",
                "accepted": [
                  "while"
                ]
              },
              {
                "id": "if",
                "english": "if",
                "portuguese": "se",
                "accepted": [
                  "if"
                ]
              },
              {
                "id": "since-linker",
                "english": "since",
                "portuguese": "já que / desde que",
                "accepted": [
                  "since"
                ]
              },
              {
                "id": "for-example",
                "english": "for example",
                "portuguese": "por exemplo",
                "accepted": [
                  "for example"
                ]
              },
              {
                "id": "in-addition",
                "english": "in addition",
                "portuguese": "além disso",
                "accepted": [
                  "in addition"
                ]
              },
              {
                "id": "instead",
                "english": "instead",
                "portuguese": "em vez disso",
                "accepted": [
                  "instead"
                ]
              },
              {
                "id": "otherwise",
                "english": "otherwise",
                "portuguese": "caso contrário",
                "accepted": [
                  "otherwise"
                ]
              }
            ]
          }
        ]
      },
      "advanced": {
        "id": "advanced",
        "label": "Advanced",
        "volumeSize": 6,
        "volumes": [
          {
            "id": "volume-1",
            "label": "Volume 1",
            "words": [
              {
                "id": "therefore",
                "english": "therefore",
                "portuguese": "portanto",
                "accepted": [
                  "therefore"
                ]
              },
              {
                "id": "although",
                "english": "although",
                "portuguese": "embora",
                "accepted": [
                  "although"
                ]
              },
              {
                "id": "moreover",
                "english": "moreover",
                "portuguese": "além disso",
                "accepted": [
                  "moreover"
                ]
              },
              {
                "id": "nevertheless",
                "english": "nevertheless",
                "portuguese": "no entanto",
                "accepted": [
                  "nevertheless"
                ]
              },
              {
                "id": "meanwhile",
                "english": "meanwhile",
                "portuguese": "enquanto isso",
                "accepted": [
                  "meanwhile"
                ]
              },
              {
                "id": "consequently",
                "english": "consequently",
                "portuguese": "consequentemente",
                "accepted": [
                  "consequently"
                ]
              }
            ]
          },
          {
            "id": "volume-2",
            "label": "Volume 2",
            "words": [
              {
                "id": "furthermore",
                "english": "furthermore",
                "portuguese": "além disso",
                "accepted": [
                  "furthermore"
                ]
              },
              {
                "id": "nonetheless",
                "english": "nonetheless",
                "portuguese": "ainda assim / apesar disso",
                "accepted": [
                  "nonetheless"
                ]
              },
              {
                "id": "whereas",
                "english": "whereas",
                "portuguese": "enquanto que / ao passo que",
                "accepted": [
                  "whereas"
                ]
              },
              {
                "id": "despite",
                "english": "despite",
                "portuguese": "apesar de",
                "accepted": [
                  "despite"
                ]
              },
              {
                "id": "conversely",
                "english": "conversely",
                "portuguese": "por outro lado / inversamente",
                "accepted": [
                  "conversely"
                ]
              },
              {
                "id": "subsequently",
                "english": "subsequently",
                "portuguese": "posteriormente",
                "accepted": [
                  "subsequently"
                ]
              }
            ]
          }
        ]
      }
    }
  }
});
