// Build-time catalogue data. Provenance: SOURCE.json.
module.exports = {
  "prompt": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 90
    },
    "placeholder": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "title": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "sub": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "highlight": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 70
    },
    "mark": {
      "kind": "colour",
      "optional": true
    },
    "sub": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    }
  },
  "swap": {
    "lead": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "from": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "to": {
      "kind": "string",
      "min": 1,
      "max": 28
    },
    "pill": {
      "kind": "colour",
      "optional": true
    }
  },
  "fullbleed": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 14
    },
    "variant": {
      "kind": "enum",
      "values": [
        "solid",
        "repeat"
      ],
      "optional": true
    }
  },
  "grid": {
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 14
      },
      "min": 3,
      "max": 6
    }
  },
  "wall": {
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 12,
      "optional": true
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 16
      },
      "max": 12,
      "optional": true
    }
  },
  "ui-macro": {
    "image": {
      "kind": "string",
      "optional": true
    },
    "target": {
      "kind": "rect",
      "optional": true
    },
    "typeText": {
      "kind": "string",
      "min": 1,
      "max": 80,
      "optional": true
    },
    "click": {
      "kind": "bool",
      "optional": true
    }
  },
  "ui-float": {
    "image": {
      "kind": "string",
      "optional": true
    },
    "caption": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "counter": {
    "value": {
      "kind": "number"
    },
    "prefix": {
      "kind": "string",
      "max": 4,
      "optional": true
    },
    "suffix": {
      "kind": "string",
      "max": 6,
      "optional": true
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 40
    }
  },
  "toggle": {
    "label": {
      "kind": "string",
      "min": 1,
      "max": 30
    },
    "kind": {
      "kind": "enum",
      "values": [
        "switch",
        "checkbox",
        "slider"
      ],
      "optional": true
    }
  },
  "logo3d": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    }
  },
  "endcard": {
    "cta": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "tagline": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    }
  },
  "slam": {
    "lines": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 22
      },
      "min": 1,
      "max": 4
    },
    "crumbs": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "max": 6,
      "optional": true
    }
  },
  "morph": {
    "states": {
      "kind": "array",
      "of": {
        "kind": "enum",
        "values": [
          "button",
          "loader",
          "check",
          "toggle",
          "slider",
          "player",
          "tabs",
          "search",
          "toast"
        ]
      },
      "min": 2,
      "max": 10
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 18,
      "optional": true
    },
    "text": {
      "kind": "string",
      "min": 1,
      "max": 32,
      "optional": true
    }
  },
  "steps": {
    "title": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    },
    "steps": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 24
      },
      "min": 2,
      "max": 4
    }
  },
  "ticket": {
    "title": {
      "kind": "string",
      "min": 1,
      "max": 26
    },
    "rows": {
      "kind": "array",
      "of": {
        "kind": "tuple",
        "of": [
          {
            "kind": "string",
            "min": 1,
            "max": 14
          },
          {
            "kind": "string",
            "min": 1,
            "max": 26
          }
        ]
      },
      "min": 1,
      "max": 4
    },
    "stamp": {
      "kind": "string",
      "min": 1,
      "max": 16
    }
  },
  "marquee": {
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "min": 2,
      "max": 8
    }
  },
  "phones": {
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 3,
      "optional": true
    },
    "caption": {
      "kind": "string",
      "min": 1,
      "max": 36,
      "optional": true
    }
  },
  "caption": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 90
    },
    "sub": {
      "kind": "string",
      "min": 1,
      "max": 60,
      "optional": true
    },
    "image": {
      "kind": "string",
      "optional": true
    }
  },
  "typewriter": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 70
    },
    "erase": {
      "kind": "number",
      "int": true,
      "min": 0,
      "max": 40,
      "optional": true
    },
    "then": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    }
  },
  "sentence": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 60
    }
  },
  "append": {
    "base": {
      "kind": "string",
      "min": 1,
      "max": 16
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "min": 1,
      "max": 6
    }
  },
  "countdown": {
    "from": {
      "kind": "number",
      "int": true,
      "min": 2,
      "max": 10
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 16,
      "optional": true
    }
  },
  "stat": {
    "value": {
      "kind": "number"
    },
    "prefix": {
      "kind": "string",
      "max": 4,
      "optional": true
    },
    "suffix": {
      "kind": "string",
      "max": 6,
      "optional": true
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "trend": {
      "kind": "enum",
      "values": [
        "up",
        "down",
        "none"
      ],
      "optional": true
    }
  },
  "chart": {
    "kind": {
      "kind": "enum",
      "values": [
        "line",
        "bar",
        "pie",
        "ring"
      ]
    },
    "values": {
      "kind": "array",
      "of": {
        "kind": "number"
      },
      "min": 2,
      "max": 12
    },
    "labels": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 12
      },
      "max": 12,
      "optional": true
    },
    "title": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    },
    "unit": {
      "kind": "string",
      "max": 6,
      "optional": true
    }
  },
  "timeline": {
    "title": {
      "kind": "string",
      "min": 1,
      "max": 36,
      "optional": true
    },
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 22
      },
      "min": 2,
      "max": 6
    }
  },
  "pricing": {
    "name": {
      "kind": "string",
      "min": 1,
      "max": 20
    },
    "price": {
      "kind": "number",
      "min": 0
    },
    "period": {
      "kind": "string",
      "min": 1,
      "max": 12,
      "optional": true
    },
    "features": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 30
      },
      "min": 1,
      "max": 5
    },
    "cta": {
      "kind": "string",
      "min": 1,
      "max": 20,
      "optional": true
    }
  },
  "globe": {
    "label": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "code": {
    "title": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    },
    "lines": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 70
      },
      "min": 1,
      "max": 14
    }
  },
  "chat": {
    "messages": {
      "kind": "array",
      "of": {
        "kind": "object",
        "fields": {
          "me": {
            "kind": "bool"
          },
          "text": {
            "kind": "string",
            "min": 1,
            "max": 80
          }
        }
      },
      "min": 1,
      "max": 6
    }
  },
  "notify": {
    "items": {
      "kind": "array",
      "of": {
        "kind": "object",
        "fields": {
          "app": {
            "kind": "string",
            "min": 1,
            "max": 16
          },
          "title": {
            "kind": "string",
            "min": 1,
            "max": 40
          },
          "body": {
            "kind": "string",
            "min": 1,
            "max": 70,
            "optional": true
          }
        }
      },
      "min": 1,
      "max": 5
    }
  },
  "dock": {
    "apps": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 4
      },
      "min": 3,
      "max": 9
    },
    "open": {
      "kind": "number",
      "int": true,
      "min": 0,
      "max": 8,
      "optional": true
    },
    "caption": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "chaos": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 6,
      "optional": true
    }
  },
  "laptop": {
    "image": {
      "kind": "string",
      "optional": true
    },
    "caption": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "browser": {
    "url": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "image": {
      "kind": "string",
      "optional": true
    }
  },
  "callouts": {
    "image": {
      "kind": "string",
      "optional": true
    },
    "title": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    },
    "notes": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 36
      },
      "min": 1,
      "max": 4
    }
  },
  "compare": {
    "before": {
      "kind": "string",
      "min": 1,
      "max": 30
    },
    "after": {
      "kind": "string",
      "min": 1,
      "max": 30
    },
    "beforeLabel": {
      "kind": "string",
      "min": 1,
      "max": 12,
      "optional": true
    },
    "afterLabel": {
      "kind": "string",
      "min": 1,
      "max": 12,
      "optional": true
    }
  },
  "inline": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 60
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 6,
      "optional": true
    },
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 14
      },
      "max": 6,
      "optional": true
    }
  },
  "bubbles": {
    "questions": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 40
      },
      "min": 3,
      "max": 8
    },
    "answer": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "retype": {
    "label": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    },
    "from": {
      "kind": "string",
      "min": 1,
      "max": 16
    },
    "to": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 16
      },
      "min": 1,
      "max": 3
    }
  },
  "orbit": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50
    }
  },
  "checklist": {
    "title": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    },
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 28
      },
      "min": 2,
      "max": 5
    }
  },
  "tiles": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 12
    }
  },
  "mosaic": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 6,
      "optional": true
    },
    "notes": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 30
      },
      "max": 3,
      "optional": true
    }
  },
  "photo": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 80
    },
    "image": {
      "kind": "string",
      "optional": true
    }
  },
  "cards3d": {
    "halftone": {
      "kind": "bool",
      "optional": true
    },
    "titles": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 24
      },
      "max": 5,
      "optional": true
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 5,
      "optional": true
    }
  },
  "icon3d": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    },
    "halftone": {
      "kind": "bool",
      "optional": true
    }
  },
  "phone3d": {
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 3,
      "optional": true
    },
    "caption": {
      "kind": "string",
      "min": 1,
      "max": 36,
      "optional": true
    },
    "halftone": {
      "kind": "bool",
      "optional": true
    }
  },
  "roll": {
    "lead": {
      "kind": "string",
      "min": 1,
      "max": 30
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 16
      },
      "min": 2,
      "max": 6
    }
  },
  "stream": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 12,
      "optional": true
    },
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 14
      },
      "max": 8,
      "optional": true
    }
  },
  "journey": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 70
    },
    "wheel": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "max": 8,
      "optional": true
    }
  },
  "faces": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 9,
      "optional": true
    }
  },
  "shuffle": {
    "from": {
      "kind": "string",
      "min": 1,
      "max": 50
    },
    "to": {
      "kind": "string",
      "min": 1,
      "max": 50
    }
  },
  "trail": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 30
    },
    "warm": {
      "kind": "bool",
      "optional": true
    }
  },
  "dot": {
    "word": {
      "kind": "string",
      "min": 1,
      "max": 28
    },
    "lead": {
      "kind": "string",
      "min": 1,
      "max": 16,
      "optional": true
    },
    "ring": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 24
      },
      "max": 4,
      "optional": true
    }
  },
  "flip": {
    "lead": {
      "kind": "string",
      "min": 1,
      "max": 18
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "min": 1,
      "max": 5
    },
    "icons": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 400
      },
      "max": 5,
      "optional": true
    },
    "gather": {
      "kind": "bool",
      "optional": true
    }
  },
  "pullback": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 90
    },
    "chips": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "max": 3,
      "optional": true
    }
  },
  "between": {
    "lead": {
      "kind": "string",
      "min": 1,
      "max": 16
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 20
      },
      "min": 1,
      "max": 3
    },
    "cta": {
      "kind": "string",
      "min": 1,
      "max": 16,
      "optional": true
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 3,
      "optional": true
    },
    "ground": {
      "kind": "bool",
      "optional": true
    }
  },
  "knockout": {
    "word": {
      "kind": "string",
      "min": 1,
      "max": 28
    },
    "text": {
      "kind": "string",
      "min": 1,
      "max": 60,
      "optional": true
    },
    "image": {
      "kind": "string",
      "optional": true
    }
  },
  "assemble": {
    "word": {
      "kind": "string",
      "min": 1,
      "max": 18
    },
    "text": {
      "kind": "string",
      "min": 1,
      "max": 60,
      "optional": true
    },
    "italic": {
      "kind": "bool",
      "optional": true
    }
  },
  "hive": {
    "icons": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 16
      },
      "max": 12,
      "optional": true
    },
    "labels": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "max": 3,
      "optional": true
    },
    "word": {
      "kind": "string",
      "min": 1,
      "max": 28,
      "optional": true
    }
  },
  "particles": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50
    }
  },
  "pack": {
    "word": {
      "kind": "string",
      "min": 1,
      "max": 20
    }
  },
  "swarm": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 12,
      "optional": true
    }
  },
  "split": {
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 16
      },
      "min": 2,
      "max": 5
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 12,
      "optional": true
    },
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 16
      },
      "max": 12,
      "optional": true
    }
  },
  "montage": {
    "lines": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 50
      },
      "min": 1,
      "max": 5
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 10,
      "optional": true
    }
  },
  "web": {
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "min": 4,
      "max": 16
    },
    "keys": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 18
      },
      "max": 4,
      "optional": true
    }
  },
  "picker": {
    "items": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 16
      },
      "min": 6,
      "max": 24,
      "optional": true
    },
    "pick": {
      "kind": "number",
      "int": true,
      "min": 0,
      "max": 23,
      "optional": true
    },
    "text": {
      "kind": "string",
      "min": 1,
      "max": 30,
      "optional": true
    }
  },
  "palette": {
    "query": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "results": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 30
      },
      "min": 2,
      "max": 6,
      "optional": true
    },
    "pick": {
      "kind": "number",
      "int": true,
      "min": 0,
      "max": 5,
      "optional": true
    }
  },
  "agent": {
    "name": {
      "kind": "string",
      "min": 1,
      "max": 20,
      "optional": true
    },
    "steps": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 40
      },
      "min": 1,
      "max": 5
    },
    "done": {
      "kind": "string",
      "min": 1,
      "max": 40
    },
    "result": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    }
  },
  "wave": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 70
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    }
  },
  "arc": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 60
    },
    "words": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 20
      },
      "max": 3,
      "optional": true
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 12,
      "optional": true
    }
  },
  "orb": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 40,
      "optional": true
    },
    "lines": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 40
      },
      "max": 3,
      "optional": true
    }
  },
  "scatter": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 80
    },
    "icons": {
      "kind": "array",
      "of": {
        "kind": "string",
        "max": 16
      },
      "max": 5,
      "optional": true
    }
  },
  "drag": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50
    },
    "label": {
      "kind": "string",
      "min": 1,
      "max": 24,
      "optional": true
    },
    "button": {
      "kind": "string",
      "min": 1,
      "max": 16,
      "optional": true
    },
    "files": {
      "kind": "array",
      "of": {
        "kind": "string",
        "min": 1,
        "max": 24
      },
      "max": 3,
      "optional": true
    },
    "images": {
      "kind": "array",
      "of": {
        "kind": "string"
      },
      "max": 3,
      "optional": true
    },
    "ground": {
      "kind": "bool",
      "optional": true
    }
  },
  "field": {
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50
    },
    "values": {
      "kind": "array",
      "of": {
        "kind": "number",
        "min": 0,
        "max": 1000000000
      },
      "min": 2,
      "max": 12,
      "optional": true
    },
    "halftone": {
      "kind": "bool",
      "optional": true
    }
  },
  "overlay": {
    "image": {
      "kind": "string",
      "optional": true
    },
    "text": {
      "kind": "string",
      "min": 1,
      "max": 50,
      "optional": true
    },
    "cards": {
      "kind": "array",
      "of": {
        "kind": "object",
        "fields": {
          "label": {
            "kind": "string",
            "min": 1,
            "max": 24
          },
          "value": {
            "kind": "number"
          },
          "prefix": {
            "kind": "string",
            "max": 3,
            "optional": true
          },
          "suffix": {
            "kind": "string",
            "max": 4,
            "optional": true
          }
        }
      },
      "min": 1,
      "max": 3
    }
  }
};
