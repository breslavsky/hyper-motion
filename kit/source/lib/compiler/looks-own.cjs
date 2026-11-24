// Build-time catalogue data. Provenance: SOURCE.json.
module.exports = {
  "metal": require('./metal.cjs').METAL_LOOK,
  "liquid": {
    "id": "liquid",
    "name": "Liquid",
    "hint": "Liquid glass: clear panels that bend the light behind them, bright rims, soft colour drifting under the glass",
    "palette": {
      "paper": "#f2f4fb",
      "ink": "#070a14",
      "lime": "#7fe7ff",
      "sage": "#0e1630",
      "peach": "#ff9fc4",
      "electric": "#3d7bff",
      "coral": "#ff5f9e",
      "sky": "#070a14",
      "lilac": "#a48bff",
      "butter": "#ffd98a"
    },
    "rhythm": [
      "ink",
      "sage",
      "ink",
      "electric",
      "ink",
      "sage",
      "ink"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "zoom",
      "glide",
      "open",
      "iris",
      "glide",
      "push"
    ],
    "text": "blur",
    "feel": {
      "snap": 0.8,
      "bounce": 0.25,
      "trLength": 1.4,
      "camera": "float"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 620,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 1,
      "accent": "serif"
    },
    "typeScale": 0.7,
    "deco": {
      "grain": 0.02,
      "mesh": true,
      "glow": true
    },
    "track": "air",
    "bpm": 106
  },
  "frost": {
    "id": "frost",
    "name": "Frost",
    "hint": "Liquid glass by day: white light, pale blue depth, clear panels with bright rims",
    "palette": {
      "paper": "#f3f6fc",
      "ink": "#0b1020",
      "lime": "#6fd3ff",
      "sage": "#e6edf9",
      "peach": "#ffb7a0",
      "electric": "#2f7bff",
      "coral": "#ff6f91",
      "sky": "#f3f6fc",
      "lilac": "#9a8cff",
      "butter": "#ffe19a"
    },
    "rhythm": [
      "paper",
      "sage",
      "paper",
      "paper",
      "sage",
      "paper"
    ],
    "opener": "paper",
    "closer": "paper",
    "transitions": [
      "glide",
      "zoom",
      "open",
      "glide",
      "iris"
    ],
    "text": "mask",
    "feel": {
      "snap": 0.85,
      "bounce": 0.3,
      "trLength": 1.3,
      "camera": "settle"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 600,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 1.02,
      "accent": "serif"
    },
    "typeScale": 0.66,
    "deco": {
      "grain": 0,
      "aurora": true
    },
    "track": "air",
    "bpm": 108
  },
  "ocean": {
    "id": "ocean",
    "name": "Ocean",
    "hint": "Deep navy and aqua: calm water light, white type, one coral spark",
    "palette": {
      "paper": "#eaf6ff",
      "ink": "#04121f",
      "lime": "#5ff0e0",
      "sage": "#0a2740",
      "peach": "#ffb199",
      "electric": "#1fa2ff",
      "coral": "#ff6b6b",
      "sky": "#04121f",
      "lilac": "#8fb8ff",
      "butter": "#ffe7a3"
    },
    "rhythm": [
      "ink",
      "sage",
      "electric",
      "ink",
      "sage",
      "ink"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "flood",
      "glide",
      "zoom",
      "open",
      "push"
    ],
    "text": "mask",
    "feel": {
      "snap": 0.85,
      "bounce": 0.5,
      "trLength": 1.3,
      "camera": "float"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 700,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 0.96,
      "accent": "serif"
    },
    "deco": {
      "grain": 0.05,
      "mesh": true
    },
    "track": "air",
    "bpm": 108
  },
  "sunset": {
    "id": "sunset",
    "name": "Sunset",
    "hint": "Warm dusk: plum, orange and rose light, soft type that comes into focus",
    "palette": {
      "paper": "#fff3ea",
      "ink": "#1a0b1e",
      "lime": "#ffd166",
      "sage": "#3a1436",
      "peach": "#ff9a6b",
      "electric": "#ff5d8f",
      "coral": "#ff7043",
      "sky": "#1a0b1e",
      "lilac": "#c68bff",
      "butter": "#ffe5a8"
    },
    "rhythm": [
      "ink",
      "sage",
      "coral",
      "ink",
      "sage",
      "electric",
      "ink"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "glide",
      "flood",
      "zoom",
      "iris",
      "glide"
    ],
    "text": "blur",
    "feel": {
      "snap": 0.8,
      "bounce": 0.5,
      "trLength": 1.4,
      "camera": "float"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 660,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 0.96,
      "accent": "serif"
    },
    "post": {
      "vignette": 0.4,
      "grade": "saturate(1.08) brightness(1.02)"
    },
    "deco": {
      "grain": 0.06,
      "aurora": true,
      "particles": "bokeh"
    },
    "track": "air",
    "bpm": 102
  },
  "forest": {
    "id": "forest",
    "name": "Forest",
    "hint": "Deep green, cream and gold: quiet, natural, a serif headline",
    "palette": {
      "paper": "#f3efe2",
      "ink": "#0d1f17",
      "lime": "#c9e265",
      "sage": "#17382a",
      "peach": "#e8b27a",
      "electric": "#2f8f5b",
      "coral": "#e2725b",
      "sky": "#0d1f17",
      "lilac": "#a9c7b0",
      "butter": "#f1d27a"
    },
    "rhythm": [
      "ink",
      "paper",
      "sage",
      "ink",
      "paper",
      "sage"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "wipe",
      "glide",
      "circle",
      "push",
      "glide"
    ],
    "text": "mask",
    "feel": {
      "snap": 0.9,
      "bounce": 0.5,
      "trLength": 1.2,
      "camera": "settle"
    },
    "display": {
      "family": "\"Instrument Serif\", Georgia, serif",
      "weight": 400,
      "stretch": 100,
      "tracking": -0.02,
      "upper": false,
      "lineHeight": 0.98,
      "accent": "color"
    },
    "deco": {
      "grain": 0.1
    },
    "track": "air",
    "bpm": 104
  },
  "sand": {
    "id": "sand",
    "name": "Sand",
    "hint": "Warm paper and terracotta: an editorial serif, soft shadows, slow moves",
    "palette": {
      "paper": "#f4ecdf",
      "ink": "#2a1d14",
      "lime": "#d9c7a3",
      "sage": "#eadcc6",
      "peach": "#e9a178",
      "electric": "#c4552d",
      "coral": "#d9603f",
      "sky": "#f4ecdf",
      "lilac": "#b9a6c9",
      "butter": "#f0cf7c"
    },
    "rhythm": [
      "paper",
      "sage",
      "paper",
      "electric",
      "paper",
      "sage"
    ],
    "opener": "paper",
    "closer": "paper",
    "transitions": [
      "glide",
      "wipe",
      "push",
      "circle",
      "glide"
    ],
    "text": "spring",
    "feel": {
      "snap": 0.9,
      "bounce": 0.6,
      "trLength": 1.2,
      "camera": "push"
    },
    "display": {
      "family": "\"Instrument Serif\", Georgia, serif",
      "weight": 400,
      "stretch": 100,
      "tracking": -0.02,
      "upper": false,
      "lineHeight": 0.96,
      "accent": "color"
    },
    "deco": {
      "grain": 0.12
    },
    "track": "air",
    "bpm": 110
  },
  "mint": {
    "id": "mint",
    "name": "Mint",
    "hint": "Fresh mint and dark green with a coral accent: friendly product film",
    "palette": {
      "paper": "#eafbf3",
      "ink": "#0b2a22",
      "lime": "#8ef0c0",
      "sage": "#d4f5e6",
      "peach": "#ffc2a8",
      "electric": "#12b886",
      "coral": "#ff6b6b",
      "sky": "#eafbf3",
      "lilac": "#a8c8ff",
      "butter": "#ffe58f"
    },
    "rhythm": [
      "paper",
      "sage",
      "electric",
      "paper",
      "sage",
      "paper"
    ],
    "opener": "paper",
    "closer": "paper",
    "transitions": [
      "zoom",
      "push",
      "glide",
      "open",
      "circle"
    ],
    "text": "gather",
    "feel": {
      "snap": 1,
      "bounce": 0.8,
      "trLength": 1.1,
      "camera": "settle"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 680,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 0.96,
      "accent": "color"
    },
    "typeScale": 0.8,
    "deco": {
      "grain": 0.03,
      "mesh": true
    },
    "track": "bounce",
    "bpm": 112
  },
  "grape": {
    "id": "grape",
    "name": "Grape",
    "hint": "Night violet with lilac and lime: a bold launch with a glow",
    "palette": {
      "paper": "#f3ecff",
      "ink": "#12071f",
      "lime": "#c8ff4d",
      "sage": "#241238",
      "peach": "#ff9ec7",
      "electric": "#8a4dff",
      "coral": "#ff4d9d",
      "sky": "#12071f",
      "lilac": "#c9a6ff",
      "butter": "#ffe066"
    },
    "rhythm": [
      "ink",
      "sage",
      "electric",
      "ink",
      "lime",
      "sage",
      "ink"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "zoom",
      "flash",
      "push",
      "shutter",
      "circle"
    ],
    "text": "flip",
    "feel": {
      "snap": 1.2,
      "bounce": 0.9,
      "trLength": 0.9,
      "camera": "punch"
    },
    "display": {
      "family": "\"Archivo\", \"Geist\", sans-serif",
      "weight": 860,
      "stretch": 112,
      "tracking": -0.02,
      "upper": true,
      "lineHeight": 0.88,
      "accent": "color"
    },
    "post": {
      "bloom": 0.45,
      "vignette": 0.55
    },
    "deco": {
      "grain": 0.07,
      "glow": true,
      "particles": "stars"
    },
    "track": "drive",
    "bpm": 124
  },
  "ember": {
    "id": "ember",
    "name": "Ember",
    "hint": "Black with orange and amber: sparks, heavy condensed type that slams",
    "palette": {
      "paper": "#fff1e6",
      "ink": "#0c0806",
      "lime": "#ffb703",
      "sage": "#1f120b",
      "peach": "#ff8a4c",
      "electric": "#ff4d1a",
      "coral": "#ff2e2e",
      "sky": "#0c0806",
      "lilac": "#ffd6a5",
      "butter": "#ffe08a"
    },
    "rhythm": [
      "ink",
      "sage",
      "ink",
      "electric",
      "ink",
      "sage"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "whip",
      "flash",
      "zoom",
      "cut",
      "push"
    ],
    "text": "slam",
    "feel": {
      "snap": 1.4,
      "bounce": 1.1,
      "trLength": 0.8,
      "camera": "punch"
    },
    "display": {
      "family": "\"Archivo\", \"Geist\", sans-serif",
      "weight": 900,
      "stretch": 76,
      "tracking": -0.01,
      "upper": true,
      "lineHeight": 0.86,
      "accent": "color"
    },
    "post": {
      "vignette": 0.6,
      "grade": "contrast(1.08)"
    },
    "deco": {
      "grain": 0.1,
      "particles": "sparks",
      "glow": true
    },
    "track": "drive",
    "bpm": 126
  },
  "ice": {
    "id": "ice",
    "name": "Ice",
    "hint": "Cold white and blue: clear, precise, thin light type",
    "palette": {
      "paper": "#f5f9ff",
      "ink": "#081425",
      "lime": "#7fe3ff",
      "sage": "#e3eefb",
      "peach": "#ffc6b0",
      "electric": "#1d6bff",
      "coral": "#ff5e7a",
      "sky": "#f5f9ff",
      "lilac": "#9db4ff",
      "butter": "#ffe7a0"
    },
    "rhythm": [
      "paper",
      "sage",
      "paper",
      "electric",
      "paper",
      "sage"
    ],
    "opener": "paper",
    "closer": "paper",
    "transitions": [
      "glide",
      "open",
      "zoom",
      "iris",
      "glide"
    ],
    "text": "mask",
    "feel": {
      "snap": 0.8,
      "bounce": 0.3,
      "trLength": 1.3,
      "camera": "settle"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 560,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 1.02,
      "accent": "serif"
    },
    "typeScale": 0.7,
    "deco": {
      "grain": 0,
      "aurora": true,
      "crosshair": true
    },
    "track": "air",
    "bpm": 110
  },
  "candy": {
    "id": "candy",
    "name": "Candy",
    "hint": "Pink, yellow and sky blue: playful shapes and bouncy round type",
    "palette": {
      "paper": "#fff5fb",
      "ink": "#2b1038",
      "lime": "#ffe14d",
      "sage": "#ffd6ec",
      "peach": "#ffa66b",
      "electric": "#3aa8ff",
      "coral": "#ff4f9a",
      "sky": "#8fd3ff",
      "lilac": "#c79bff",
      "butter": "#fff08a"
    },
    "rhythm": [
      "paper",
      "sage",
      "electric",
      "butter",
      "coral",
      "paper",
      "lilac"
    ],
    "opener": "sky",
    "closer": "paper",
    "transitions": [
      "circle",
      "whip",
      "push",
      "zoom",
      "wipe"
    ],
    "text": "wave",
    "feel": {
      "snap": 1.3,
      "bounce": 1.5,
      "trLength": 0.9,
      "camera": "punch"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 820,
      "stretch": 100,
      "tracking": -0.035,
      "upper": false,
      "lineHeight": 0.92,
      "accent": "color"
    },
    "deco": {
      "grain": 0.04,
      "shapes": true,
      "particles": "confetti"
    },
    "track": "bounce",
    "bpm": 116
  },
  "noir": {
    "id": "noir",
    "name": "Noir",
    "hint": "Black and white with one yellow accent: hard light, strict grotesk",
    "palette": {
      "paper": "#f2f2f0",
      "ink": "#0a0a0a",
      "lime": "#ffe500",
      "sage": "#1a1a1a",
      "peach": "#d9d9d9",
      "electric": "#ffe500",
      "coral": "#ffffff",
      "sky": "#0a0a0a",
      "lilac": "#bdbdbd",
      "butter": "#ffe500"
    },
    "rhythm": [
      "ink",
      "paper",
      "ink",
      "sage",
      "ink",
      "paper"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "cut",
      "wipe",
      "cut",
      "push",
      "shutter",
      "cut"
    ],
    "text": "mask",
    "feel": {
      "snap": 1.1,
      "bounce": 0.2,
      "trLength": 0.8,
      "camera": "still"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 800,
      "stretch": 100,
      "tracking": -0.05,
      "upper": false,
      "lineHeight": 0.9,
      "accent": "color"
    },
    "post": {
      "vignette": 0.6,
      "grade": "contrast(1.1) saturate(0.88)"
    },
    "deco": {
      "grain": 0.14
    },
    "track": "pulse",
    "bpm": 120
  },
  "royal": {
    "id": "royal",
    "name": "Royal",
    "hint": "Navy and gold: a serif headline in a soft spotlight, slow and sure",
    "palette": {
      "paper": "#f6f1e4",
      "ink": "#0a1030",
      "lime": "#e9c46a",
      "sage": "#141d4a",
      "peach": "#e6b89c",
      "electric": "#3555ff",
      "coral": "#d9a441",
      "sky": "#0a1030",
      "lilac": "#b9b4ff",
      "butter": "#f3d98b"
    },
    "rhythm": [
      "ink",
      "sage",
      "ink",
      "paper",
      "ink",
      "sage"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "glide",
      "iris",
      "zoom",
      "open",
      "glide"
    ],
    "text": "blur",
    "feel": {
      "snap": 0.75,
      "bounce": 0.3,
      "trLength": 1.5,
      "camera": "dolly"
    },
    "display": {
      "family": "\"Instrument Serif\", Georgia, serif",
      "weight": 400,
      "stretch": 100,
      "tracking": -0.02,
      "upper": false,
      "lineHeight": 0.98,
      "accent": "color"
    },
    "post": {
      "vignette": 0.5
    },
    "deco": {
      "grain": 0.05,
      "spotlight": true,
      "glow": true
    },
    "track": "air",
    "bpm": 98
  },
  "lava": {
    "id": "lava",
    "name": "Lava",
    "hint": "Magenta into orange on black: hot gradients, big type, a bloom",
    "palette": {
      "paper": "#fff0f3",
      "ink": "#0d0508",
      "lime": "#ffb347",
      "sage": "#260a16",
      "peach": "#ff8a5c",
      "electric": "#ff2e88",
      "coral": "#ff5a1f",
      "sky": "#0d0508",
      "lilac": "#ff9ad5",
      "butter": "#ffd166"
    },
    "rhythm": [
      "ink",
      "sage",
      "electric",
      "ink",
      "coral",
      "sage",
      "ink"
    ],
    "opener": "ink",
    "closer": "ink",
    "transitions": [
      "flood",
      "zoom",
      "flash",
      "push",
      "glide"
    ],
    "text": "flip",
    "feel": {
      "snap": 1.2,
      "bounce": 0.9,
      "trLength": 1,
      "camera": "punch"
    },
    "display": {
      "family": "\"Archivo\", \"Geist\", sans-serif",
      "weight": 860,
      "stretch": 112,
      "tracking": -0.02,
      "upper": true,
      "lineHeight": 0.88,
      "accent": "color"
    },
    "post": {
      "bloom": 0.45,
      "vignette": 0.5,
      "grade": "saturate(1.1)"
    },
    "deco": {
      "grain": 0.06,
      "mesh": true,
      "glow": true
    },
    "track": "drive",
    "bpm": 124
  },
  "clay": {
    "id": "clay",
    "name": "Clay",
    "hint": "Muted terracotta, olive and cream: hand-made warmth, soft bounce",
    "palette": {
      "paper": "#f3ead9",
      "ink": "#2b2118",
      "lime": "#b5c26a",
      "sage": "#e6d8bf",
      "peach": "#e7a57b",
      "electric": "#c66a3d",
      "coral": "#d9774f",
      "sky": "#f3ead9",
      "lilac": "#b8a6c9",
      "butter": "#edc96b"
    },
    "rhythm": [
      "paper",
      "sage",
      "electric",
      "paper",
      "lime",
      "sage",
      "paper"
    ],
    "opener": "paper",
    "closer": "paper",
    "transitions": [
      "wipe",
      "circle",
      "push",
      "whip",
      "glide"
    ],
    "text": "spring",
    "feel": {
      "snap": 1,
      "bounce": 1.1,
      "trLength": 1.1,
      "camera": "push"
    },
    "display": {
      "family": "\"Geist\", system-ui, sans-serif",
      "weight": 760,
      "stretch": 100,
      "tracking": -0.04,
      "upper": false,
      "lineHeight": 0.92,
      "accent": "serif"
    },
    "deco": {
      "grain": 0.13
    },
    "track": "bounce",
    "bpm": 112
  }
};
