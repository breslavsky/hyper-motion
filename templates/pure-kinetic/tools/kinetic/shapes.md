### Ready shapes

For an open brief, adapt one of these. For explicit choreography, follow the
requested actions instead. These fictional examples are not product facts.
Replace every text with the user's own (their
product's name for Nook, what it does for the steps, their site for the
address), keep the texts as short as the ones here, and set `aspect`,
`style` (the table below) and `brand`. Plan beats from the requested length and reading time.

**A launch** (any product, no pictures): the pain, the name, the product at
work, before and after, three words, the end card.

```json
{ "aspect": "16:9", "style": "editorial", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "caption", "beats": 4, "text": "Still filling classes [by hand]?", "sub": "Every week." },
  { "type": "title", "beats": 3, "text": "Meet *Nook*.", "sub": "Introducing" },
  { "type": "agent", "beats": 7, "name": "Nook", "steps": ["Posts the class", "Fills the waitlist", "Takes the payment"], "done": "Class full." },
  { "type": "compare", "beats": 5, "before": "Chasing people in chats", "after": "A waitlist that fills itself" },
  { "type": "marquee", "beats": 3, "words": ["FULLER", "CALMER", "NOOK"] },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**A product with its screens** (the page picture of `screenshot_page`, or
uploads): the request typed into the product, the site opening, the screen with what matters called
out, a switch, a slammed line, the end card.

```json
{ "aspect": "16:9", "style": "mono", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "pullback", "beats": 7, "text": "Show me what Nook can do" },
  { "type": "browser", "beats": 4, "url": "nook.app", "image": "<the picture's path>" },
  { "type": "callouts", "beats": 5, "image": "<the picture's path>", "title": "Everything in one place", "notes": ["Classes", "Waitlist", "Payments"] },
  { "type": "toggle", "beats": 3, "label": "Waitlist on", "kind": "switch" },
  { "type": "slam", "beats": 4, "lines": ["EVERY CLASS", "FULL"] },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**A developer tool**: the command typed, the name and version, the tool at
work, what it prints, a slammed line, the end card.

```json
{ "aspect": "16:9", "style": "terminal", "brand": { "name": "Shipit", "url": "shipit.dev" }, "scenes": [
  { "type": "typewriter", "beats": 4, "text": "shipit deploy" },
  { "type": "title", "beats": 3, "text": "*Shipit*", "sub": "Deployment tool" },
  { "type": "agent", "beats": 7, "name": "Shipit", "steps": ["Builds the site", "Uploads the files", "Goes live"], "done": "Deployed." },
  { "type": "code", "beats": 5, "lines": ["$ shipit deploy", "building the site", "uploading files", "live at shipit.dev"] },
  { "type": "slam", "beats": 4, "lines": ["ONE COMMAND", "LIVE"] },
  { "type": "endcard", "beats": 5, "cta": "npm install -g shipit", "tagline": "Deploy in one command" }
] }
```

**A calm brand film** (a studio, a brand, a feeling; no features): three
quiet lines, the name last.

```json
{ "aspect": "1:1", "style": "minimal", "pace": "chill", "brand": { "name": "Bloom" }, "scenes": [
  { "type": "typewriter", "beats": 5, "text": "Every small cafe has a story." },
  { "type": "sentence", "beats": 4, "text": "We give it a face" },
  { "type": "append", "beats": 4, "base": "For", "words": ["signs", "menus", "cups"] },
  { "type": "title", "beats": 4, "text": "*Bloom*", "sub": "Identities for cafes" },
  { "type": "endcard", "beats": 5, "cta": "bloom.studio" }
] }
```

**A vertical ad** (stories, reels): the hook, the tools it replaces, a
switch, before and after, the end card.

```json
{ "aspect": "9:16", "style": "loud", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "caption", "beats": 3, "text": "Your classes are [half empty]." },
  { "type": "dock", "beats": 4, "apps": ["💬", "📅", "📝", "💳", "📧"], "open": 1, "caption": "Five tools for one class" },
  { "type": "toggle", "beats": 3, "label": "Nook on", "kind": "switch" },
  { "type": "compare", "beats": 4, "before": "Copy, paste, remind", "after": "It fills itself" },
  { "type": "endcard", "beats": 4, "cta": "nook.app", "tagline": "Fill your classes" }
] }
```

**An app in liquid glass** (a premium product film; no pictures needed):
the request, what it turns on, the result, the line under a lens, the end
card.

```json
{ "aspect": "9:16", "style": "liquid", "brand": { "name": "Nook", "url": "nook.app" }, "scenes": [
  { "type": "ask", "beats": 6, "text": "Fill my Tuesday class", "reply": "The waitlist is ready." },
  { "type": "controls", "beats": 4, "title": "Autopilot", "toggles": ["Reminders", "Waitlist", "Payments"] },
  { "type": "island", "beats": 3, "title": "Class is full", "body": "Waitlist updated", "icon": "check" },
  { "type": "stack", "beats": 3, "words": ["FULLER", "CALMER", "NOOK"] },
  { "type": "lens", "beats": 4, "text": "Every class, full." },
  { "type": "endcard", "beats": 5, "cta": "nook.app", "tagline": "Explore Nook" }
] }
```

**Explaining a topic** ("why drink water", "how sleep works", a lesson; no
product): the question, the answer in one line, the reasons one by one, what
goes wrong without it, the one thing to remember. The brand's name is the
topic in a word or two. For 30 seconds add scenes like the middle ones (one
reason each), never longer ones.

```json
{ "aspect": "9:16", "style": "explainer", "brand": { "name": "Water" }, "scenes": [
  { "type": "typewriter", "beats": 5, "text": "How does water help?" },
  { "type": "orb", "beats": 6, "lines": ["Your body is mostly water.", "It runs on it."] },
  { "type": "steps", "beats": 6, "title": "What it does", "steps": ["Carries oxygen", "Cools you down", "Clears the head"] },
  { "type": "rundown", "beats": 5, "items": ["At your desk", "With a meal", "After a walk"], "punch": "Keep water nearby" },
  { "type": "checklist", "beats": 6, "title": "Make it easy", "items": ["A glass on waking", "A bottle on the desk", "A glass with every meal"] },
  { "type": "gather", "beats": 5, "word": "WATER" },
  { "type": "endcard", "beats": 5, "cta": "One glass now", "tagline": "Then one more" }
] }
```

