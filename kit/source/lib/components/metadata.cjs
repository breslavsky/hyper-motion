// Canonical component metadata and action timing. Browser metadata.mjs is generated from this file.
const spread=(n,from,to)=>Array.from({length:n},(_,i)=>n<2?from:from+(to-from)*i/(n-1));
// Media sources resolve against the project's source/ directory in both the
// native composition and the preview.
function projectPathProblems(path,field){
  if(typeof path!=='string')return [`${field} must be text`];
  let decoded;try{decoded=decodeURIComponent(path);}catch{return [`${field} must be a valid project-relative path`];}
  if(/[\\\x00-\x1f]/.test(decoded))return [`${field} contains an invalid character`];
  decoded=decoded.trim();
  return !decoded||/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(decoded)||decoded.split('/').includes('..')
    ? [`${field} must be project-relative, without a scheme, absolute path or parent traversal`] : [];
}
const registryMediaProblems=paths=>{
  if(!Array.isArray(paths))return ['images must be a list of project-relative paths'];
  return paths.flatMap((path,i)=>projectPathProblems(path,`image path ${i+1}`));
};
function glassBackgroundProblems({background}){
  if(background===undefined)return [];
  if(!background||typeof background!=='object'||Array.isArray(background))return ['background must contain either an image or a video'];
  const keys=Object.keys(background),kind=keys[0];
  if(keys.length!==1||!['image','video'].includes(kind))return ['background must contain exactly one of image or video'];
  const src=background[kind];
  // A fragment or query on its own refers to the composition HTML.
  const path=typeof src==='string'?src.split(/[?#]/,1)[0]:src;
  return projectPathProblems(path,`background.${kind}`);
}
function hasAuthoredTiming(scene){
  return (scene.speed != null && scene.speed !== 1) || Object.keys(scene.timing ?? {}).length > 0;
}
// The editable text renderer counts code points. Reveal complete graphemes
// together so combining marks and joined emoji appear on one keystroke.
function typingKeys(text,marks){
  const events=[];
  let count=0,weight=0;
  for(const {segment} of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)){
    if(events.length)weight+=1;
    count+=[...segment].length;
    events.push({count,weight});
  }
  return events.map(key=>({count:key.count,at:marks.type+(marks.typed-marks.type)*key.weight/(weight||1)}));
}
function cueTypingKeys(keys,cue){
  // Keep long inputs musical while placing each tap on a visible keystroke.
  const taps=Math.min(14,keys.length);
  for(let i=0;i<taps;i++){
    const key=keys[Math.round(i*(keys.length-1)/Math.max(1,taps-1))];
    cue(key.at,'type',.35);
  }
}
// Stops pair a time in the original choreography with a time on the local
// timeline. Rendering and sound use opposite directions of the same map.
function retimeGlass(definition,scene,len,beat){
  const timing=scene.timing===undefined?{}:scene.timing;
  const speed=scene.speed===undefined?1:scene.speed;
  if(!Number.isFinite(speed)||speed<.25||speed>4)throw new Error('speed must be a number from 0.25 to 4');
  if(!timing||typeof timing!=='object'||Array.isArray(timing))throw new Error('timing must be an object of beat positions');
  const entries=Object.entries(timing);
  if(!entries.length&&speed===1)return null;
  if(!(len>0&&Number.isFinite(len))||(entries.length&&!(beat>0&&Number.isFinite(beat))))throw new Error('timing needs a positive scene duration and beat length');
  const marks=entries.length?definition.anchors(scene,len):{};
  const stops=[];
  function pin(name,origin,position){
    if(!Number.isFinite(position)||position<0||position*beat>len+1e-9)throw new Error(`timing.${name} needs a beat from 0 to ${Number((len/beat).toFixed(6))}`);
    stops.push({name,origin,target:Math.min(len,position*beat)});
  }
  for(const [name,value] of entries){
    if(!Object.hasOwn(marks,name))throw new Error(`timing.${name} is not an action supported by ${scene.type}`);
    const origin=marks[name];
    if(origin===undefined)throw new Error(`timing.${name} requires its action to be enabled on ${scene.type}`);
    if(Array.isArray(origin)){
      if(!Array.isArray(value)||value.length!==origin.length)throw new Error(`timing.${name} needs one beat for each of its ${origin.length} actions`);
      origin.forEach((time,i)=>pin(`${name}[${i}]`,time,value[i]));
    }else pin(name,origin,value);
  }
  stops.sort((a,b)=>a.origin-b.origin);
  for(let i=1;i<stops.length;i++){
    const previous=stops[i-1],next=stops[i];
    if(previous.origin===next.origin||previous.target>=next.target)throw new Error(`timing.${next.name} must follow timing.${previous.name} in choreography order`);
  }
  const first=stops[0],last=stops.at(-1);
  if(!first||first.target>0)stops.unshift({origin:0,target:0});
  if(last&&speed===1&&last.target<len&&last.origin<len)stops.push({origin:len,target:len});
  // A short slot can explicitly pull a normally clipped completion into view.
  const sourceEnd=last&&last.origin>len ? last.origin+(len-last.target)*speed : len;
  function map(value,from,to,tailSlope){
    for(let i=1;i<stops.length;i++){
      const a=stops[i-1],b=stops[i];
      if(value===b[from])return b[to];
      if(value<b[from])return a[to]+(value-a[from])/(b[from]-a[from])*(b[to]-a[to]);
    }
    const tail=stops.at(-1);
    return tail[to]+(value-tail[from])*tailSlope;
  }
  return {
    motionTime:time=>Math.max(0,Math.min(sourceEnd,map(time,'target','origin',speed))),
    cueTime:time=>time>sourceEnd+1e-9?Infinity:map(time,'origin','target',1/speed),
  };
}
// Where a Glass panel stands over the picture and how large it is: the names
// of glass/grid.mjs (GLASS_PLACES, GLASS_SIZES). A scene that is not one panel
// seen by a camera at rest has neither (`placed:false`): one laid out by the
// page, one whose camera travels, one whose text is not on the glass.
const GLASS_PLACES=['top-left','top','top-right','left','middle','right','bottom-left','bottom','bottom-right'];
const GLASS_SIZES=['normal','small'];
// A small panel is the whole panel at six tenths, laid out as the normal one:
// nothing in it can run off that does not run off at full size. What a small
// panel loses is size of type, so a scene may give measured limits for it
// (`small`: a field's characters, a list's count and characters). Only what a
// scene has measured is refused: a guess would refuse panels that are fine.
function smallGlassProblems(definition,scene){
  if(scene.size!=='small'||!definition.small)return [];
  const errors=[];
  for(const [name,limit] of Object.entries(definition.small)){
    const value=scene[name];if(value===undefined)continue;
    if(typeof limit==='number'){
      if(typeof value==='string'&&[...value].length>limit)errors.push(`${name}: ${[...value].length} characters; a small panel takes ${limit} at most`);
    }else if(Array.isArray(value)){
      if(value.length>limit.count)errors.push(`${name}: ${value.length} of them; a small panel takes ${limit.count} at most`);
      value.forEach((text,k)=>{if(typeof text==='string'&&[...text].length>limit.chars)errors.push(`${name}[${k}]: ${[...text].length} characters; a small panel takes ${limit.chars} at most`);});
    }
  }
  return errors;
}
function glassComponent(definition){
  const path={kind:'string',min:1,optional:true};
  const beat={kind:'number',min:0,optional:true};
  const actions=Object.entries(definition.anchors(definition.sample,4)).map(([key,mark])=>[
    key,Array.isArray(mark)?{kind:'array',of:{kind:'number',min:0},optional:true}:beat,
  ]);
  const names=actions.map(([key,spec])=>key+(spec.kind==='array'?'[]':''));
  const guideTiming=`Optional speed (0.25–4×) and action positions in local beats from 0. timing supports ${names.join(', ')}.`;
  return {...definition,
    guide:definition.guide.replace(/(\d+(?:-\d+)? beats\.)$/,guideTiming+' $1'),
    hasAuthoredTiming,
    fields:{...definition.fields,background:{kind:'object',optional:true,fields:{image:path,video:path}},
      ...(definition.placed===false?{}:{place:{kind:'enum',values:GLASS_PLACES,optional:true},size:{kind:'enum',values:GLASS_SIZES,optional:true}}),
      timing:{kind:'object',optional:true,fields:Object.fromEntries(actions)},speed:{kind:'number',min:.25,max:4,optional:true}},
    retime(scene,len,beat){return retimeGlass(definition,scene,len,beat);},
    sounds(scene,len,cue,beat){
      const clock=retimeGlass(definition,scene,len,beat);
      if(!clock)return definition.sounds(scene,len,cue,beat);
      definition.sounds(scene,len,(at,...sound)=>{
        const time=clock.cueTime(at);
        if(time>=-1e-9&&time<=len+1e-9)cue(Math.max(0,Math.min(len,time)),...sound);
      },beat);
    },
    validateMedia:glassBackgroundProblems,
    validate(scene){return [...glassBackgroundProblems(scene),...(definition.placed===false?[]:smallGlassProblems(definition,scene)),...(definition.validate?.(scene)??[])];},
  };
}
const definitions={
  'thinking-orb': {
    opener:true,
    signature:true,
    copyFields:['title','body'],
    previewVariants:['state'],
    fields:{
      state:{kind:'enum',values:['working','searching','solving','listening','connecting','weaving','composing','breathing','shaping']},
      title:{kind:'string',min:1,max:48,optional:true},
      body:{kind:'string',min:1,max:100,optional:true},
      orbSpeed:{kind:'number',min:0,max:4,optional:true},
      size:{kind:'number',min:.25,max:1,optional:true},
      tint:{kind:'colour',optional:true},
    },
    guide:'thinking-orb {state, title?, body?, orbSpeed?, size?, tint?}: the original Thinking Orbs particle motion for an AI assistant or process, with optional supplied title (48 characters) and body (100). Choose the semantic action: working = processing, searching = research, solving = reasoning, listening = voice input, connecting = linking, weaving = synthesis, composing = writing/music, breathing = idle/ready, shaping = creation. Use when that action belongs in the story, not as generic decoration or evidence that a task really ran. orbSpeed = 0-4 (default 1); size = .25-1 of available space (default 1); tint = palette name or opaque #RGB/#RRGGBB (default brand accent). 4-6 beats.',
    sample:{type:'thinking-orb',state:'searching',title:'Find the signal',body:'One question. Connected answers.',beats:5},
    validate(s){
      const errors=[];
      if(!this.fields.state.values.includes(s.state))errors.push('state must name one of the nine Thinking Orbs states');
      for(const [key,min,max] of [['orbSpeed',0,4],['size',.25,1]])if(s[key]!==undefined&&!(Number.isFinite(s[key])&&s[key]>=min&&s[key]<=max))errors.push(`${key} must be from ${min} to ${max}`);
      const colors=['paper','ink','lime','sage','peach','electric','coral','sky','lilac','butter','brand','brand2'];
      if(s.tint!==undefined&&!(colors.includes(s.tint)||typeof s.tint==='string'&&/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(s.tint)))errors.push('tint must be a palette name or opaque #RGB/#RRGGBB');
      return errors;
    },
    validateResolved(s,{palette,accent}){
      const color=s.tint===undefined?accent:(palette[s.tint]??s.tint);
      return typeof color==='string'&&/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)?[]:[
        `tint resolves to ${JSON.stringify(color)}; use an opaque #RGB/#RRGGBB in tint or its palette/brand.colors source`,
      ];
    },
    times(s,len){return {title:Math.min(.14,len*.12),body:Math.min(.32,len*.25),arrival:Math.min(.4,len*.3)};},
    sounds(s,len,cue){
      const t=this.times(s,len);cue(Math.min(.03,len*.03),'pop',.35);
      if(s.title)cue(t.title,'tick',.3);
      if(s.body)cue(t.body,'tick',.22);
    },
  },
"island":glassComponent({
anchors(s,len){
  const collapse=s.exit==='collapse';
  const open=.3*(hasAuthoredTiming(s)?Math.min(1,len/1.25):1);
  return {open,opened:Math.min(1.16,len*.52),collapse:collapse?len*.72:undefined,exit:collapse?len*.89:undefined};
},
"opener":true,
"copyFields":["title","body","icon"],
"previewVariants":["camera","exit"],
validate(s){return [['camera',['static','orbit']],['exit',['hold','collapse']]].flatMap(([key,values])=>s[key]!==undefined&&!values.includes(s[key])?[`${key} must be ${values.join(' or ')}`]:[]);},
"fields":{
  "camera":{"kind":"enum","values":["static","orbit"],"optional":true},
  "exit":{"kind":"enum","values":["hold","collapse"],"optional":true},
  "title": {
    "kind": "string",
    "min": 1,
    "max": 36
  },
  "body": {
    "kind": "string",
    "min": 1,
    "max": 70,
    "optional": true
  },
  "icon": {
    "kind": "string",
    "min": 1,
    "max": 24,
    "optional": true
  }
},
"guide":"island {title, body?, icon?, camera?, exit?, background?}: an optical glass capsule opens into a dimensional card; its editable title follows the surface. camera = orbit (default: gentle push and arc) or static. exit = hold (default) or collapse (fold to a capsule and leave the frame). Optional icon uses a monochrome SVG: check, info, alert, close, plus, star, heart, bell, sparkles, or arrow-right. Existing emoji input remains supported. Glass, Dark Glass and Metal share the same layout and camera. For continuous travel between two cards use glass-flow. 3-4 beats.",
"sample":{
  "type": "island",
  "beats": 4,
  "title": "Class is full",
  "body": "12 of 12 booked, 3 on the waitlist",
  "icon": "check",
  "camera":"orbit",
  "exit":"hold"
},
"sounds":function sounds(s, len, cue) {
			const {open}=this.anchors(s,len);
			cue(open, "pop", 0.9);
			cue(0.75*(open/.3), "chime", 0.8);
		}
}),
"glass-steps":glassComponent({
// A glass panel that explains a process in numbered steps (glass/components.mjs).
anchors(s,len){
  const count=s.items.length,open=.05,title=Math.min(.38,len*.12);
  // 0.34 s between steps: the family's `between` (glass/grid.mjs GLASS_TIME).
  const first=Math.min(.62,len*.2),last=Math.min(len*.58,first+(count-1)*.34);
  const items=spread(count,first,last);
  // A collapsing panel leaves in the scene's last quarter: the steps hop, then it folds.
  const wave=Math.max(items.at(-1)+.6,len*.74),collapse=Math.max(wave+.18,len*.84);
  return {open,title,items,wave,collapse};
},
// A step must be read before the scene ends (or the panel folds): half a
// second and three tenths a word from when it comes in. In beats at 120 bpm.
needs(s){
  const marks=this.anchors(s,60),leaves=(s.exit??'hold')==='collapse'?.84:1;
  const seconds=Math.max(...s.items.map((text,i)=>marks.items[i]+.1+.5+.3*String(text).trim().split(/\s+/u).filter(Boolean).length))/leaves;
  return Math.ceil(seconds/.5);
},
validate(s){
  if(!Array.isArray(s.items)||!s.items.every(text=>typeof text==='string'))return [];
  const errors=[];
  s.items.forEach((text,i)=>{const words=text.trim().split(/\s+/u).filter(Boolean).length;if(words>8)errors.push(`items[${i}]: ${words} words; a step is a phrase of 8 words at most`);});
  const needs=this.needs(s);
  if(!errors.length&&Number.isFinite(s.beats)&&s.beats<needs)errors.push(`beats: these steps need at least ${needs} beats to be read (shorter phrases need fewer)`);
  return errors;
},
"signature":true,
"copyFields":["title","items"],
// In a small panel: three steps of 32 characters and a title of 24.
"small":{"title":24,"items":{"count":3,"chars":32}},
"fields":{
  "items":{"kind":"array","of":{"kind":"string","min":1,"max":48},"min":2,"max":4},
  "title":{"kind":"string","min":1,"max":32,"optional":true},
  "camera":{"kind":"enum","values":["orbit","static"],"optional":true},
  "exit":{"kind":"enum","values":["hold","collapse"],"optional":true}
},
"previewVariants":["camera","exit"],
"guide":"glass-steps {items[2-4], title?, camera?, exit?, background?}: an optical glass panel explains a process: it grows out of a pill, its title comes in, then the steps one after another, each a numbered badge that pops and a line that settles under it (\"Upload your footage\", \"Pick a style\", \"Export in 4K\"). items: what happens at each step, a short phrase of up to 48 characters and 8 words, in order; the numbers are drawn for you. Columns in a wide frame, rows in a square or tall one, and rows too when the phrases are long. camera = orbit (default) or static. exit = hold (default) or collapse (the steps hop in a wave and the panel folds away). Keep a step to a few words: every step must be read before the scene ends, about a beat for each two words after the last step comes in, and a scene too short for its steps is refused with the beats it needs. Over a photo or a video of the user's it is a slide of a presentation or an overlay for b-roll. 6-12 beats.",
"sample":{"type":"glass-steps","beats":8,"title":"How it works","items":["Upload your footage","Pick a style","Export in 4K"],"camera":"orbit","exit":"hold"},
"sounds":function sounds(s,len,cue){
      const marks=this.anchors(s,len);
      cue(marks.open,"pop",.8);
      marks.items.forEach((at,i)=>cue(at,"tick",i===marks.items.length-1?.7:.55));
      if((s.exit??"hold")==="collapse")cue(marks.collapse,"whoosh",.5);
      else cue(marks.items.at(-1)+.42,"chime",.6);
    }
}),
"widgets":glassComponent({
placed:false,
anchors(s,len){
  const first=hasAuthoredTiming(s)?Math.min(.15,len*.3):.15;
  const items=spread(s.items.length,first,Math.min(len*.45,.15+s.items.length*.16));
  return {items,settled:items.at(-1)+.1+Math.min(1.1,len*.5)};
},
"fields":{
  "items": {
    "kind": "array",
    "of": {
      "kind": "object",
      "fields": {
        "label": {
          "kind": "string",
          "min": 1,
          "max": 20
        },
        "value": {
          "kind": "string",
          "min": 1,
          "max": 10
        }
      }
    },
    "min": 2,
    "max": 4
  },
  "title": {
    "kind": "string",
    "min": 1,
    "max": 40,
    "optional": true
  }
},
"guide":"widgets {items[{label, value} x2-4], title?, background?}: glass tiles, each a label and a big figure that counts up (\"Bookings\" \"1,240\", \"Rating\" \"4.9\", \"Faster\" \"3x\"). ONLY real figures the user gave. 4 beats.",
"sample":{
  "type": "widgets",
  "beats": 4,
  "title": "This week",
  "items": [
    {
      "label": "Bookings",
      "value": "1,240"
    },
    {
      "label": "Rating",
      "value": "4.9"
    },
    {
      "label": "No-shows",
      "value": "2%"
    }
  ]
},
"sounds":function sounds(s, len, cue) {
			const marks=this.anchors(s,len);
			marks.items.forEach((at) => cue(at, "pop", 0.8));
			cue(s.timing?.settled === undefined ? Math.min(len*.8,1.5) : marks.settled,"ping",.7);
		}
}),
"controls":glassComponent({
anchors(s,len){
  const slider=s.slider?Math.max(.7,len*.66):undefined;
  return {open:.02,toggles:this.times(s,len),slider,sliderEnd:slider===undefined?undefined:slider+.7};
},
"copyFields":["title","toggles","slider"],
"previewVariants":["camera"],
validate(s){return s.camera!==undefined&&!['static','orbit'].includes(s.camera)?['camera must be static or orbit']:[];},
"fields":{
  "camera":{"kind":"enum","values":["static","orbit"],"optional":true},
  "title": {
    "kind": "string",
    "min": 1,
    "max": 30,
    "optional": true
  },
  "toggles": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 24
    },
    "min": 2,
    "max": 4
  },
  "slider": {
    "kind": "string",
    "min": 1,
    "max": 24,
    "optional": true
  }
},
"guide":"controls {title?, toggles[2-4], slider?, camera?, background?}: an optical glass control panel whose switches turn on one after another and whose slider fills. Its title, labels and controls follow the same 3D surface, with the shared card typography, padding and gaps used by island and glass-flow. camera = orbit (default: gentle push and arc) or static. Glass, Dark Glass and Metal use the same control geometry and timing. 4 beats.",
"sample":{
  "type": "controls",
  "beats": 4,
  "title": "Autopilot",
  "toggles": [
    "Reminders",
    "Waitlist",
    "Payments"
  ],
  "slider": "Capacity",
  "camera": "orbit"
},
"times":(s, len) => spread(s.toggles.length, 0.5, Math.max(0.6, len * 0.62)),
"sounds":function sounds(s, len, cue) {
			this.times(s, len).forEach((at) => cue(at, "click", 0.8));
			if (s.slider) cue(Math.max(0.7, len * 0.66), "sparkle", 0.6);
		}
}),
"sheet":glassComponent({
placed:false,
anchors(s,len){return {open:.05,...this.times(s,len)};},
"fields":{
  "title": {
    "kind": "string",
    "min": 1,
    "max": 36
  },
  "rows": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 34
    },
    "min": 2,
    "max": 4
  },
  "cta": {
    "kind": "string",
    "min": 1,
    "max": 22
  }
},
"guide":"sheet {title, rows[2-4], cta, background?}: a glass sheet rises from the bottom with a title, a few rows that tick themselves and a button that is pressed (\"Book a class\", \"Pick a time\", \"Pay in one tap\", cta \"Confirm\"). A flow in one screen. 4-5 beats.",
"sample":{
  "type": "sheet",
  "beats": 5,
  "title": "Book a class",
  "rows": [
    "Pick a time",
    "Bring a friend",
    "Pay in one tap"
  ],
  "cta": "Confirm"
},
"times":(s, len) => ({ rows: spread(s.rows.length, 0.55, Math.max(0.7, len * 0.55)), press: Math.max(0.9, len * 0.74) }),
"sounds":function sounds(s, len, cue) {
			const t = this.times(s, len);
			cue(s.timing?.open === undefined ? .1 : .05, "whoosh", 0.6);
			t.rows.forEach((at) => cue(at, "tick", 0.9));
			cue(t.press, "click", 1);
		}
}),
"ask":glassComponent({
anchors(s,len){
  const marks=this.times(s,len);
  return {open:.32,...marks,reply:s.reply?marks.reply:undefined};
},
"opener":true,
"signature":true,
"copyFields":["text","reply"],
"previewVariants":["camera"],
validate(s){return s.camera!==undefined&&!['static','orbit'].includes(s.camera)?['camera must be static or orbit']:[];},
"from":"0670c6b0-25b8-4082-b7e3-15910602e1af-1-3",
"fields":{
  "camera":{"kind":"enum","values":["static","orbit"],"optional":true},
  "text": {
    "kind": "string",
    "min": 1,
    "max": 60
  },
  "reply": {
    "kind": "string",
    "min": 1,
    "max": 80,
    "optional": true
  }
},
"guide":"ask {text, reply?, camera?, background?}: a round icon opens into a 3D prompt bar. The request types, the send button presses and the same panel expands below the prompt for an optional reply. Both texts follow the panel. The camera defaults to orbit and can also be static. 5-6 beats.",
"sample":{
  "type": "ask",
  "beats": 6,
  "camera":"orbit",
  "text": "Fill my Tuesday class",
  "reply": "Done. 12 of 12 booked, 3 on the waitlist."
},
"times":function times(s, len) {
			// A one-beat slot may end before the original keyboard starts. Keep
			// a real typing interval for the clock to land on each authored beat.
			const typingLimit = hasAuthoredTiming(s) ? Math.max(len * .5, .55) : len * .5;
			const typed = Math.min(typingLimit, 0.5 + [...s.text].length / 27);
			return { type: 0.5, typed, send: typed + 0.2, reply: typed + 0.45 };
		},
"sounds":function sounds(s, len, cue) {
			const t = this.times(s, len);
			cue(0.2, "click", 0.8);
			cue(0.32, "pop", 0.9);
			const n = [...s.text].length;
			for (let c = 0; c < n; c += 2) cue(t.type + ((t.typed - t.type) * c) / n, "type", 0.8);
			cue(t.send, "click", 0.9);
			if (s.reply) cue(t.reply + (s.timing?.reply === undefined ? .1 : 0), "chime", 0.8);
		}
}),
"lens":glassComponent({
// The headline is the page's own type behind the lens: only the lens would move.
placed:false,
anchors(s,len){return {sweep:len*.2,sweepEnd:len*.85};},
"copyFields":["text","sub"],
"previewVariants":["camera"],
validate(s){return s.camera!==undefined&&!['static','orbit'].includes(s.camera)?['camera must be static or orbit']:[];},
"signature":true,
"typeOnly":true,
"fields":{
  "camera":{"kind":"enum","values":["static","orbit"],"optional":true},
  "text": {
    "kind": "string",
    "min": 1,
    "max": 34
  },
  "sub": {
    "kind": "string",
    "min": 1,
    "max": 50,
    "optional": true
  }
},
"guide":"lens {text, sub?, camera?, background?}: a lens glides across the fitted headline. Glass and Dark Glass refract the lettering. Dark Glass adds a smoked tint. Metal covers the lettering as it passes. camera = static (default) or orbit for a gentle changing angle. Copy stays editable through the component fields. 3-4 beats.",
"sample":{
  "type": "lens",
  "beats": 4,
  "text": "Every class, full.",
  "sub": "Without the chasing",
  "camera":"static"
},
"sounds":function sounds(s, len, cue) {
			const marks=this.anchors(s,len);
			cue(s.timing?.sweep === undefined ? Math.max(.3,len*.22) : marks.sweep,"whoosh",.7);
			cue(s.timing?.sweepEnd === undefined ? len*.8 : marks.sweepEnd,"sparkle",.6);
		}
}),
search:glassComponent({
  opener:true,signature:true,copyFields:['query','placeholder'],
  fields:{
    query:{kind:'string',min:1,max:80},
    placeholder:{kind:'string',min:0,optional:true,default:'Search...'},
  },
  guide:'search {query, placeholder?, background?, speed?, timing?}: use when a user enters and submits a search query. The empty field displays "Search..." until typing begins. Set placeholder to your own hint or to an empty string to leave it blank. The cursor clicks the field, types the query and clicks Enter (↵) inside its right edge. Each click sends a light wave through the field that bends its glass and the text under it. A wave runs for up to 1.2 seconds: the first has left by the search beat and the second by checked, so pinning those sets its pace. A spinner turns while the field folds into the round button. Pin collapse to the start of the fold, collapsed to its end and checked to the beat when the spinner becomes a checkmark. The checkmark holds through the end of the scene. 4-8 beats.',
  sample:{type:'search',beats:6,query:'Tuesday classes'},
  anchors(s,len){return {focus:.22*len,type:.28*len,typed:.54*len,search:.68*len,collapse:.80*len,collapsed:.90*len,checked:.96*len};},
  keys(s,marks){return typingKeys(s.query,marks);},
  sounds(s,len,cue){
    const marks=this.anchors(s,len);
    cue(marks.focus,'click',.65);
    cueTypingKeys(this.keys(s,marks),cue);
    cue(marks.search,'click',.9);
  },
}),
'send-prompt':glassComponent({
// The camera stands close on the caret and pulls back: a moved picture is cut by the frame.
placed:false,
  opener:true,signature:true,copyFields:['text','chips'],
  fields:{
    text:{kind:'string',min:1,max:90},
    chips:{kind:'array',of:{kind:'string',min:1,max:18},max:3,optional:true},
  },
  guide:'send-prompt {text, chips?[], background?, speed?, timing?}: a user types and sends a prompt. The camera tracks the caret and pulls back to reveal the glass composer. An @mention in the prompt is highlighted once it is typed. Use chips for up to three author-supplied context labels above the prompt, such as the sections covered by a report. Omit chips to show just the prompt and controls. Pin pull and landed to music beats to set the duration of the camera move. The send beat launches a distortion wave from the button. The wave clears the composer by sent. 6-14 beats.',
  sample:{type:'send-prompt',beats:14,text:'Summarize sales in @Nook',chips:['Sales','Subscriptions']},
  anchors(s,len){
    // Hold the established typing and camera pace in a longer slot. Short
    // compositions reserve part of their duration for the wave as well.
    const approach=Math.min(len*8/(s.beats??8),len*.72);
    return {type:approach*.035,typed:approach*.395,pull:approach*.43,
      chips:s.chips?.length ? spread(s.chips.length,approach*.54,approach*.68) : undefined,
      landed:approach*.79,send:approach*.86,sent:len*.98};
  },
  mention(s){
    const match=/(?<![\p{L}\p{M}\p{N}_@])@[\p{L}\p{N}_][\p{L}\p{M}\p{N}_-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}\p{N}_-]*)*/u.exec(s.text);
    if(!match)return null;
    const start=[...s.text.slice(0,match.index)].length;
    return {text:match[0],start,end:start+[...match[0]].length};
  },
  keys(s,marks){return typingKeys(s.text,marks);},
  sounds(s,len,cue){
    const marks=this.anchors(s,len),keys=this.keys(s,marks);
    cueTypingKeys(keys,cue);
    cue(marks.pull,'whoosh',.65);
    for(const at of marks.chips??[])cue(at,'pop',.42);
    cue(marks.send,'click',.9);
  },
}),
"glass-flow":glassComponent({
// The camera flies from one card through to the next: there is no one place for it.
placed:false,
  anchors(s,len){
    const marks=this.times(s,len);
    // At this point in the smootherstep dive the camera reaches the first
    // card's plane (z/distance goes from .96 to -.43). Preserve legacy cues.
    if(s.timing?.cross!==undefined)marks.cross=marks.flight+(marks.land-marks.flight)*.60469891898916;
    return marks;
  },
  "opener":true,
  "signature":true,
  "copyFields":["title","body","nextTitle","nextBody"],
  "fields":{
    "title":{"kind":"string","min":1,"max":36},
    "body":{"kind":"string","min":1,"max":70,"optional":true},
    "nextTitle":{"kind":"string","min":1,"max":36},
    "nextBody":{"kind":"string","min":1,"max":70,"optional":true}
  },
  "guide":"glass-flow {title, body?, nextTitle, nextBody?, background?}: two optical glass cards in one persistent 3D world. A capsule opens into the first card, the camera pushes in with a small orbit and flies through its glass toward the second card. Both editable titles follow their surfaces. A continuous two-message reveal; use instead of joining separate island scenes when a single camera must travel between cards. 14-20 beats.",
  "sample":{"type":"glass-flow","beats":16,"title":"Liquid clarity.","body":"Layers move together.","nextTitle":"Pure motion.","nextBody":"One world. One continuous move."},
  times(s,len){return {open:len*.045,opened:len*.175,title:len*.135,titleShown:len*.195,flight:len*.465,cross:len*.63,land:len*.75,nextTitle:len*.685,nextTitleShown:len*.755};},
  sounds(s,len,cue){const t=this.anchors(s,len);cue(t.open,'pop',.5);cue(t.title,'chime',.5);cue(t.flight,'whoosh',.7);cue(t.cross,'sparkle',.5);cue(t.nextTitle,'chime',.5);}
}),
"stack":{
"typeOnly":true,
"from":"ace667de-e7cf-4888-93b6-d40efe86f74d-1-1",
"fields":{
  "words": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 14
    },
    "min": 2,
    "max": 4
  }
},
"guide":"stack {words[2-4]}: big single words stacked down the frame, one per beat; as each lands the ones above dim, so only the newest is lit (\"FASTER\", \"CALMER\", \"FULL\"). Three values, verbs or steps as a triad. 3-4 beats.",
"sample":{
  "type": "stack",
  "beats": 4,
  "words": [
    "FASTER",
    "CALMER",
    "FULL"
  ]
},
"times":(s, len, beat) => s.words.map((_, i) => 0.06 + i * Math.min(beat, (len * 0.8) / s.words.length)),
"sounds":function sounds(s, len, cue, beat) {
			this.times(s, len, beat).forEach((at, i, all) => cue(at, i === all.length - 1 ? "hit" : "tick", 1));
		}
},
"beatwords":{
"opener":true,
"typeOnly":true,
"from":"47117432-873c-4435-a2f1-674ea1498bd2-1-0",
"fields":{
  "words": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 12
    },
    "min": 3,
    "max": 6
  }
},
"guide":"beatwords {words[3-6]}: one word a beat, each alone and filling the frame, the ground flipping on every cut and each word with another entrance (\"NO\", \"MORE\", \"EMPTY\", \"CLASSES\"). A hook or a slogan said one word at a time. One beat a word: 3-6 beats.",
"sample":{
  "type": "beatwords",
  "beats": 4,
  "words": [
    "NO",
    "MORE",
    "EMPTY",
    "CLASSES"
  ]
},
"sounds":function sounds(s, len, cue) {
			s.words.forEach((_, i, all) => cue((len * i) / all.length, i === all.length - 1 ? "hit" : "tick", 1));
		}
},
"underline":{
"typeOnly":true,
"from":"ef29a917-1518-4e1f-9df5-5fe7b6cf5052-1-0",
"fields":{
  "text": {
    "kind": "string",
    "min": 1,
    "max": 14
  },
  "tag": {
    "kind": "string",
    "min": 1,
    "max": 24,
    "optional": true
  }
},
"guide":"underline {text, tag?}: ONE word, huge; its letters rise from behind the baseline one after another and an underline draws under it; tag = a small label in brackets above it (\"FULL\", tag \"every class\"). The one-word punch after a build. 2-3 beats.",
"sample":{
  "type": "underline",
  "beats": 3,
  "text": "FULL",
  "tag": "every class"
},
"sounds":function sounds(s, len, cue) {
			cue(0.05, "whoosh", 0.6);
			cue(0.12 + [...s.text].length * 0.035 + 0.2, "hit", 0.8);
		}
},
"rundown":{
"typeOnly":true,
"from":"ace667de-e7cf-4888-93b6-d40efe86f74d-1-5",
"fields":{
  "items": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 26
    },
    "min": 2,
    "max": 5
  },
  "punch": {
    "kind": "string",
    "min": 1,
    "max": 22
  }
},
"guide":"rundown {items[2-5], punch}: a list builds one line a beat, each new line the only lit one, then the whole list steps back and a big punch line lands under it (\"Chasing invoices\", \"Copying numbers\", \"Fixing typos\" then \"All gone.\"). The busywork a product removes, or what comes in the box, with the verdict. 4-6 beats.",
"sample":{
  "type": "rundown",
  "beats": 5,
  "items": [
    "Chasing invoices",
    "Copying numbers",
    "Fixing typos"
  ],
  "punch": "All gone."
},
"times":function times(s, len, beat) {
			const step = Math.min(beat, (len * 0.62) / (s.items.length + 1));
			return { lines: s.items.map((_, i) => 0.08 + i * step), punch: 0.08 + s.items.length * step };
		},
"sounds":function sounds(s, len, cue, beat) {
			const at = this.times(s, len, beat);
			for (const t of at.lines) cue(t, "tick", 1);
			cue(at.punch, "hit", 1);
		}
},
"winner":{
"signature":true,
"from":"6b3f5087-1c64-4c05-869b-e87f8c4fe873-1-5",
"fields":{
  "title": {
    "kind": "string",
    "min": 1,
    "max": 30
  },
  "value": {
    "kind": "string",
    "min": 1,
    "max": 10
  },
  "options": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 16
    },
    "min": 3,
    "max": 3
  },
  "pick": {
    "kind": "number",
    "int": true,
    "min": 1,
    "max": 3,
    "optional": true
  }
},
"guide":"winner {title, value, options[3], pick?}: a card counts its figure up and draws its curve, then three options rise under it and the product picks one: two fade, the winner lifts with a tick (title \"Best time to post\", value \"9:40\", options \"Mon 8:00\", \"Wed 9:40\", \"Fri 18:00\", pick 2). The product compares and chooses. ONLY a real figure. 5 beats.",
"sample":{
  "type": "winner",
  "beats": 5,
  "title": "Best time for a class",
  "value": "18:30",
  "options": [
    "Mon 8:00",
    "Wed 18:30",
    "Sat 11:00"
  ],
  "pick": 2
},
"times":function times(s, len) {
			const tiles = Math.max(0.6, len * 0.3);
			const lose = Math.max(tiles + 0.43, Math.max(1.3, len * 0.66) - 0.39);
			return { tiles, lose: [lose, lose + 0.13], pick: lose + 0.39 };
		},
"sounds":function sounds(s, len, cue) {
			const t = this.times(s, len);
			cue(0.1, "pop", 0.8);
			[0, 1, 2].forEach((i) => cue(t.tiles + i * 0.065, "tick", 0.9));
			t.lose.forEach((at) => cue(at, "click", 0.6));
			cue(t.pick, "chime", 1);
		}
},
"connect":{
"signature":true,
"from":"c8af3fb3-c765-49e9-b5d4-bd52713c3629-1-4",
"fields":{
  "sources": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 18
    },
    "min": 2,
    "max": 4
  },
  "target": {
    "kind": "string",
    "min": 1,
    "max": 18
  }
},
"guide":"connect {sources[2-4], target}: pills on the left (what goes in) each joined to one tile on the right (the product) by a dotted curve that draws itself, with a light running along it (\"Instagram\", \"WhatsApp\", \"Email\" into \"Nook\"). Everything flows into one place. 4-5 beats.",
"sample":{
  "type": "connect",
  "beats": 5,
  "sources": [
    "Instagram",
    "WhatsApp",
    "Email"
  ],
  "target": "Nook"
},
"times":(s) => s.sources.map((_, i) => ({ pill: 0.1 + 0.25 * i, line: 0.22 + 0.25 * i, run: 0.27 + 0.25 * i, lands: 0.82 + 0.25 * i })),
"sounds":function sounds(s, len, cue) {
			for (const at of this.times(s, len)) {
				cue(at.pill, "pop", 0.7);
				cue(at.lands, "ping", 0.6);
			}
		}
},
"chips":{
"opener":true,
"signature":true,
"from":"d9ab24e8-49da-47b9-9647-b56bdfd79d0f-1-6",
"fields":{
  "text": {
    "kind": "string",
    "min": 1,
    "max": 30
  },
  "chips": {
    "kind": "array",
    "of": {
      "kind": "string",
      "min": 1,
      "max": 14
    },
    "min": 5,
    "max": 12
  }
},
"guide":"chips {text, chips[5-12]}: a headline with labelled chips all around it at different depths; they come into focus one by one, then fly past the camera and clear the frame (\"All of it, handled\", chips \"Bookings\", \"Waitlist\", \"Payments\", \"Reminders\", \"Reviews\"...). Everything at once around one line. 4-5 beats.",
"sample":{
  "type": "chips",
  "beats": 5,
  "text": "All of it, *handled*",
  "chips": [
    "Bookings",
    "Waitlist",
    "Payments",
    "Reminders",
    "Reviews",
    "Refunds",
    "Calendar",
    "Messages"
  ]
},
"sounds":function sounds(s, len, cue) {
			s.chips.forEach((_, i) => cue(0.15 + i * Math.min(0.07, (len * 0.4) / s.chips.length), "pop", 0.5));
			cue(Math.max(len - 0.3, len * 0.6), "whoosh", 1);
		}
},
"tabs":{
"from":"014039e9-ee0a-4ddb-a89c-12f506467809-1-4",
"signature":true,
"fields":{
  "items": {
    "kind": "array",
    "of": {
      "kind": "object",
      "fields": {
        "label": {
          "kind": "string",
          "min": 1,
          "max": 16
        },
        "value": {
          "kind": "string",
          "min": 1,
          "max": 8
        }
      }
    },
    "min": 3,
    "max": 3
  }
},
"guide":"tabs {items[{label, value} x3]}: a card with three figures in a row; a lit panel hops from one to the next, each figure counts up as it is reached and the chart under them bends into another shape (\"Booked\" \"92%\", \"Waitlist\" \"38\", \"Saved\" \"6h\"). Three numbers of a product in one shot. ONLY real figures. 5-6 beats.",
"sample":{
  "type": "tabs",
  "beats": 6,
  "items": [
    {
      "label": "Booked",
      "value": "92%"
    },
    {
      "label": "Waitlist",
      "value": "38"
    },
    {
      "label": "Saved a week",
      "value": "6h"
    }
  ]
},
"times":(s, len) => spread(3, 0.35, Math.max(1.2, len * 0.68)),
"sounds":function sounds(s, len, cue) {
			cue(0.08, "pop", 0.8);
			this.times(s, len).forEach((at, i) => cue(at, i ? "click" : "tick", 0.9));
		}
},
"dial":{
"from":"6492ce46-c249-4634-887e-1ae334031c57-1-2",
"fields":{
  "label": {
    "kind": "string",
    "min": 1,
    "max": 30
  },
  "value": {
    "kind": "number",
    "min": 1,
    "max": 100
  },
  "unit": {
    "kind": "string",
    "max": 4,
    "optional": true
  }
},
"guide":"dial {label, value, unit?, timing?:{slide:{startBeat,endBeat}}}: a slider whose knob is dragged to a value out of 100 with a bubble above it counting as it moves; the ticks it passes light up (label \"Classes full\", value 92, unit \"%\"). timing.slide stretches the same gesture between musical beats counted from this scene's start; its arrival chime lands on endBeat. Without timing the original gesture is unchanged. One share or score, shown as something moved. ONLY a real figure, 1-100. 3-4 beats.",
"sample":{
  "type": "dial",
  "beats": 4,
  "label": "Classes full",
  "value": 92,
  "unit": "%"
},
"times":function times(s, len, beat) {
			if (!s.timing?.slide) return { from: 0.45, to: Math.max(1.1, len * 0.72) };
			const { startBeat, endBeat } = s.timing.slide;
			if (!Number.isFinite(beat) || beat <= 0 || !Number.isFinite(startBeat) || startBeat < 0 || !Number.isFinite(endBeat) || endBeat <= startBeat) throw new Error("dial timing.slide requires a positive beat length and 0 <= startBeat < endBeat");
			return { from: startBeat * beat, to: endBeat * beat };
		},
"sounds":function sounds(s, len, cue, beat) {
			const t = this.times(s, len, beat);
			cue(0.3, "pop", 0.7);
			// The knob goes off fast and slows (quartOut): a tick as it passes each sixth of its way, the
			// original chime follows the perceptual settle; an explicit beat span ends with its chime.
			for (let i = 1; i <= 5; i++) cue(t.from + (t.to - t.from) * (1 - (1 - i / 6) ** 0.25), "tick", 0.5);
			cue(s.timing?.slide ? t.to : t.from + (t.to - t.from) * 0.7, "chime", 0.9);
		}
},
"gather":{
"signature":true,
"typeOnly":true,
"from":"c1dceba4-2b0f-49a5-8372-960b5f30bfff-1-4",
"fields":{
  "word": {
    "kind": "string",
    "min": 1,
    "max": 14
  }
},
"guide":"gather {word}: some fifteen hundred dots drifting over the frame fly together and become ONE big word (\"IDEAS\", \"Nook\"), it holds solid, then bursts: the word swells and every dot is flung clear of the frame. The name, or the one word the film is about; as an opener or right before the end card. One word, two short ones at most. 4-5 beats.",
"sample":{
  "type": "gather",
  "beats": 5,
  "word": "IDEAS"
},
"times":(s, len) => ({ gather: 0.12, word: 0.72, burst: Math.max(1.2, len - 0.36) }),
"sounds":function sounds(s, len, cue) {
			const at = this.times(s, len);
			cue(at.gather, "whoosh", 1);
			cue(at.word, "hit", 1);
			cue(at.burst, "whoosh", 1.2);
		}
},
"impact":{
"opener":true,
"signature":true,
"typeOnly":true,
"from":"7130241b-163d-4b81-8f55-a4d3bb3f9e33-1-5",
"fields":{
  "text": {
    "kind": "string",
    "min": 1,
    "max": 18
  },
  "lead": {
    "kind": "string",
    "min": 1,
    "max": 28,
    "optional": true
  }
},
"guide":"impact {text, lead?}: the drop. A ring of speed lines flies outward and the word slams in behind it, overshoots small and springs to rest (\"SHIPPED\", \"50% OFF\", the name). lead: a small line that waits before the drop (\"Introducing\", \"And now\"); without it the slam is the first thing seen. One or two words. As the opener, or for the one thing the film announces. 3-4 beats.",
"sample":{
  "type": "impact",
  "beats": 4,
  "lead": "Introducing",
  "text": "NOOK"
},
"times":(s, len, beat) => ({ drop: s.lead ? Math.min(Math.max(0.5, beat), len * 0.4) : 0.14 }),
"sounds":function sounds(s, len, cue, beat) {
			if (s.lead) cue(0.05, "tick", 0.8);
			cue(this.times(s, len, beat).drop, "hit", 1.2);
		}
},
"polar":{"from":"87cedc30-8f77-450e-a6cb-633a1934d9b0-1-3",
"signature":true,
"fields":{"shapes":{"kind":"array",
"of":{"kind":"enum",
"values":["circle","triangle","star","square"]},
"min":2,
"max":5,
"optional":true},
"label":{"kind":"string",
"min":1,
"max":28,
"optional":true},
"satellites":{"kind":"bool",
"optional":true}},
"guide":"polar {shapes?[circle|triangle|star|square x2-5], label?, satellites?}: one springy shape morphs through a sequence with turning echo outlines and smaller orbiting copies. A change of state or an abstract product identity. Optional label is the user's message; satellites defaults to true. 3-5 beats.",
"sample":{"type":"polar",
"beats":4,
"shapes":["circle","triangle","star","square"],
"label":"Made to adapt"},
"times":function times(s, len, beat) {
      const count = (s.shapes ?? ['circle', 'triangle', 'star', 'square']).length - 1;
      const logicalBeat = Number.isFinite(beat) && beat > 0 ? beat : len / 4;
      const gap = count > 1 ? len * 0.48 / (count - 1) : len * 0.48;
      const duration = Math.min(logicalBeat * 0.55, len * 0.13, gap * 0.62);
      return {
        reveal: Math.min(logicalBeat * 0.1, len * 0.03),
        grow: Math.min(logicalBeat * 0.7, len * 0.17),
        changes: Array.from({length: count}, (_, i) => ({at: len * 0.22 + i * gap, duration})),
      };
    },
"sounds":function sounds(s, len, cue, beat) {
      const schedule = this.times(s, len, beat);
      cue(schedule.reveal, 'pop', 0.7);
      for (const change of schedule.changes) {
        cue(change.at, 'whoosh', 0.45);
        cue(change.at + change.duration, 'tick', 0.75);
      }
    }},
"letterflip":{"from":"6491e897-ac71-41b4-b464-51f6113078d6-1-3",
"opener":true,
"typeOnly":true,
"fields":{"text":{"kind":"string",
"min":1,
"max":36}},
"guide":"letterflip {text}: a short headline reveals letter by letter, each turning 450 degrees in perspective and flashing the accent on its back before landing flat. The brand font is preserved; joined scripts turn as whole words. A punchy opener or feature name. 3-4 beats.",
"sample":{"type":"letterflip",
"beats":4,
"text":"A fresh turn"},
"times":function times(s, len, beat) {
      const joined = /[\u0590-\u08ff\u0900-\u0dff\ufb1d-\ufdff\ufe70-\ufeff]/u;
      const segmenter = new Intl.Segmenter('und', {granularity: 'grapheme'});
      const groups = String(s.text).trim().split(/\s+/u).filter(Boolean).map(word => joined.test(word) ? [word] : Array.from(segmenter.segment(word), part => part.segment));
      const count = groups.reduce((n, group) => n + group.length, 0);
      const logicalBeat = Number.isFinite(beat) && beat > 0 ? beat : len / 4;
      const start = Math.min(logicalBeat * 0.18, len * 0.06);
      const duration = Math.min(logicalBeat * 0.6, len * 0.22);
      const span = count < 2 ? 0 : Math.min(logicalBeat * 0.95, len * 0.25);
      const letters = Array.from({length: count}, (_, i) => ({at: start + (count < 2 ? 0 : i * span / (count - 1)), duration}));
      return {groups, letters, end: start + span + duration};
    },
"sounds":function sounds(s, len, cue, beat) {
      const schedule = this.times(s, len, beat);
      for (const letter of schedule.letters) cue(letter.at + letter.duration, 'tick', 0.42);
      cue(schedule.end, 'chime', 0.7);
    }},
"accordion":{"from":"dc2072ce-3dab-4322-bb56-56b13ffea542-1-3",
"fields":{"items":{"kind":"array",
"of":{"kind":"string",
"min":1,
"max":24},
"min":3,
"max":5},
"images":{"kind":"array",
"of":{"kind":"string",
"min":1},
"min":3,
"max":5,
"optional":true}},
"guide":"accordion {items, images?}: 3-5 named picture cards breathe like an accordion: a travelling focus enlarges each card, then a staggered wave moves the stack. Dashed bounds and curved tethers follow the real card handles. items: short feature or process names, up to 24 characters; optional local images replace the abstract artwork in order. A horizontal row in landscape, a vertical stack with side labels in square and portrait. 5-7 beats.",
"sample":{"type":"accordion",
"beats":6,
"items":["Discover","Arrange","Create","Review","Release"]},
"validate":function validate(s) {
      return s.images&&s.images.length!==s.items?.length?['images must contain exactly one local image for each item']:[];
    },
"times":function times(s,len,beat) {
      const start=len*.04, focusEnd=len*.42, waveEnd=len*.82, end=len*.96;
      const n=s.items.length;
      return {start,focusEnd,waveEnd,end,period:Math.max(.24,Math.min(beat>0?beat*1.5:len*.24,len*.35)),focus:s.items.map((_,i)=>start+(focusEnd-start)*(i+1.6)/(n+2.2))};
    },
"sounds":function sounds(s,len,cue,beat) {
      const t=this.times(s,len,beat);
      for(const at of t.focus)cue(at,'tick',.55);
      cue(t.focusEnd,'whoosh',.6);
      cue(t.end,'chime',.65);
    }},
"explode":{"from":"7dede976-cde5-4f3d-a8e0-83a125a9967b-1-5",
"fields":{"layers":{"kind":"array",
"of":{"kind":"string",
"min":1,
"max":24},
"min":3,
"max":5},
"title":{"kind":"string",
"min":1,
"max":36,
"optional":true}},
"guide":"explode {layers, title?}: one flat card tilts into depth and separates into 3-5 named planes, turns slowly while held apart, then closes into one card again. Flat labels and fine leaders explain each plane without tilting the words. layers: short names of actual parts or stages, up to 24 characters; title: optional heading. 5-7 beats.",
"sample":{"type":"explode",
"beats":6,
"title":"Built in layers",
"layers":["Foundation","Structure","Content","Interaction","Finish"]},
"times":function times(s,len) {
      return {tilt:len*.125,tilted:len*.2,spread:len*.1675,separated:len*.2425,hold:len*.65,collapse:len*.7,collapsed:len*.85,flat:len*.95};
    },
"sounds":function sounds(s,len,cue,beat) {
      const t=this.times(s,len,beat);
      cue(t.tilt,'whoosh',.65);
      cue(t.separated,'tick',.65);
      cue(t.collapse,'whoosh',.6);
      cue(t.flat,'pop',.75);
    }},
"scan":{"from":"c8af3fb3-c765-49e9-b5d4-bd52713c3629-1-6",
"signature":true,
"fields":{"items":{"kind":"array",
"min":3,
"max":6,
"of":{"kind":"object",
"fields":{"label":{"kind":"string",
"min":1,
"max":18},
"category":{"kind":"number",
"int":true,
"min":1,
"max":4,
"optional":true}}}},
"categories":{"kind":"array",
"min":2,
"max":4,
"of":{"kind":"string",
"min":1,
"max":24}},
"image":{"kind":"string",
"min":1,
"max":300,
"optional":true},
"title":{"kind":"string",
"min":1,
"max":48,
"optional":true},
"scanning":{"kind":"string",
"min":1,
"max":32,
"optional":true},
"complete":{"kind":"string",
"min":1,
"max":32,
"optional":true}},
"guide":"scan {items[{label, category?} x3-6], categories[2-4], image?, title?, scanning?, complete?}: a luminous band scans a sheet of objects; a label and corner brackets appear exactly when the band crosses each object, then the crops lift and fly into category cards, filling their badges. category is a 1-based index into categories; omit it to distribute objects in order. image is an optional supplied sheet/photo divided into the same object crops; without it, the objects are brand-coloured geometry. scanning and complete are optional user-written status lines. Use short 1-2-word item labels. At normal pace, allow more time for longer labels, longer status lines or faster music, and check readability after changing the timing. 7-9 beats.",
"sample":{"type":"scan",
"beats":7,
"title":"Everything in its place",
"categories":["Ideas","Tasks","Files"],
"items":[{"label":"Launch notes",
"category":1},{"label":"Follow up",
"category":2},{"label":"Moodboard",
"category":1},{"label":"Brand assets",
"category":3},{"label":"Schedule",
"category":2},{"label":"References",
"category":3}],
"scanning":"Reading the board",
"complete":"Ready to use"},
"validate":function validate(s){
      const errors=[];
      if(!Array.isArray(s?.categories)||s.categories.length<2||s.categories.length>4)return ['categories must contain 2 to 4 labels'];
      if(!Array.isArray(s?.items)||s.items.length<3||s.items.length>6)return ['items must contain 3 to 6 objects'];
      s.categories.forEach((name,i)=>{if(typeof name!=='string'||!name.trim()||[...name].length>24)errors.push(`categories[${i}] must be a non-empty label of at most 24 characters`);});
      s.items.forEach((item,i)=>{
        if(!item||typeof item!=='object'||typeof item.label!=='string'||!item.label.trim()||[...item.label].length>18)errors.push(`items[${i}].label must be non-empty text of at most 18 characters`);
        if(item?.category!==undefined&&(!Number.isInteger(item.category)||item.category<1||item.category>s.categories.length))errors.push(`items[${i}].category must be an integer from 1 to categories.length (${s.categories.length})`);
      });
      return errors;
    },
"times":function times(s,len,beat){
      const rows=Math.ceil(s.items.length/2),counts=Array(s.categories.length).fill(0);
      const scanStart=len*.12,scanEnd=len*.42;
      const items=s.items.map((item,i)=>{
        const row=Math.floor(i/2),col=i%2,cell=.86/rows;
        const box={x:i===s.items.length-1&&s.items.length%2?.3:.06+col*.47,
          y:.065+row*cell+(col?.017:0),w:.4,h:cell-.065};
        const scan=scanStart+(scanEnd-scanStart)*(box.y+box.h/2);
        const category=item.category===undefined?i%s.categories.length:item.category-1;
        // Tags remain through the lift. Compact the flight train so the final
        // three-word status has over a second to read in the 7-beat sample.
        const lift=scan+len*.05,fly=Math.max(lift+len*.07,len*(.38+i*.034));
        return {box,category,slot:counts[category]++,scan,lift,fly,land:fly+len*.075};
      });
      return {enter:len*.02,scanStart,scanEnd,bandGone:len*.455,items,counts,
        complete:Math.max(...items.map(item=>item.land))+len*.025,beat};
    },
"sounds":function sounds(s,len,cue,beat){
      const t=this.times(s,len,beat);
      cue(t.scanStart,'whoosh',.55);
      t.items.forEach(item=>{cue(item.scan,'tick',.55);cue(item.fly,'whoosh',.45);cue(item.land,'pop',.7);});
      cue(t.complete,'chime',.85);
    }}
,"before-after-wipe":{"fields":{"before":{"kind":"string",
"min":1,
"max":24},
"after":{"kind":"string",
"min":1,
"max":24},
"images":{"kind":"array",
"of":{"kind":"string",
"min":1,
"max":300},
"min":2,
"max":2,
"optional":true},
"split":{"kind":"number",
"min":10,
"max":90,
"optional":true},
"title":{"kind":"string",
"min":1,
"max":48,
"optional":true}},
"guide":"before-after-wipe {before, after, images?[2], split?, title?}: one sine-eased divider reveals the supplied after image over the before image and holds at split (10-90%, default 50). Labels remain readable outside the wipe. Without images, shows abstract brand geometry, not a product screenshot. Use real matched before/after assets. 5-7 beats.",
"sample":{"type":"before-after-wipe",
"beats":6,
"title":"One view. Two states.",
"before":"Before",
"after":"After",
"split":55},
"validateMedia":function(s){return registryMediaProblems(s.images===undefined?[]:s.images);},
"validate":function(s){return this.validateMedia(s);},
"times":function(s,len){const scale=Math.min(1,len/1.3);return {enter:.32*scale,wipe:.25*scale,duration:1.05*scale,land:1.3*scale};},
"sounds":function(s,len,cue,beat){const t=this.times(s,len,beat);cue(t.wipe,'whoosh',.55);cue(t.land,'pop',.7);}},
"screen-flow-carousel":{"fields":{"screens":{"kind":"array",
"of":{"kind":"object",
"fields":{"label":{"kind":"string",
"min":1,
"max":32}}},
"min":2,
"max":5},
"images":{"kind":"array",
"of":{"kind":"string",
"min":1,
"max":300},
"min":2,
"max":5,
"optional":true},
"title":{"kind":"string",
"min":1,
"max":48,
"optional":true}},
"guide":"screen-flow-carousel {screens[{label} x2-5], images?, title?}: screen rail throws to the next screen and catches gently; neighbours recede. Labels are outside screen crops. images are supplied local screenshots, one per screen; omitted images use abstract brand geometry. One action per screen; allow time to read each label. 7-12 beats.",
"sample":{"type":"screen-flow-carousel",
"beats":9,
"title":"A flow that stays with you",
"screens":[{"label":"Collect ideas"},{"label":"Shape the story"},{"label":"Share your work"}]},
"validateMedia":function(s){return registryMediaProblems(s.images===undefined?[]:s.images);},
"validate":function(s){return [...this.validateMedia(s),...(s.images&&s.images.length!==s.screens.length?['images must match screens.length']:[])];},
"times":function(s,len){return {enter:Math.min(.42,len*.1),advance:Math.min(.8,len*.14),starts:spread(s.screens.length-1,len*.24,len*.72)};},
"sounds":function(s,len,cue,beat){const t=this.times(s,len,beat);t.starts.forEach(at=>{cue(at,'whoosh',.45);cue(at+t.advance,'tick',.55);});}},
"chart-story":{"fields":{"chart":{"kind":"enum",
"values":["bars","line","donut","progress"],
"optional":true},
"items":{"kind":"array",
"of":{"kind":"object",
"fields":{"label":{"kind":"string",
"min":1,
"max":20},
"value":{"kind":"number",
"min":0,
"max":1000000}}},
"min":2,
"max":5},
"unit":{"kind":"string",
"min":0,
"max":8,
"optional":true},
"title":{"kind":"string",
"min":1,
"max":48,
"optional":true},
"emphasize":{"kind":"number",
"min":1,
"max":5,
"optional":true,
"int":true}},
"guide":"chart-story {chart?: bars|line|donut|progress, items[{label,value} x2-5], unit?, title?, emphasize?}: chart builds, labels arrive, then one exact figure settles. emphasize is a 1-based item index, default last. Values are finite 0-1000000; donut requires a positive total. ONLY numbers supplied by the user; never invent proof. 7-10 beats.",
"sample":{"type":"chart-story",
"beats":8,
"chart":"bars",
"title":"Example data",
"unit":"%",
"items":[{"label":"Phase 1",
"value":12},{"label":"Phase 2",
"value":28},{"label":"Phase 3",
"value":45},{"label":"Phase 4",
"value":64}],
"emphasize":4},
"validate":function(s){const errors=[];if(s.emphasize!==undefined&&s.emphasize>s.items.length)errors.push('emphasize must refer to an existing item');if(s.chart==='donut'&&s.items.reduce((sum,item)=>sum+item.value,0)<=0)errors.push('donut values must have a positive total');return errors;},
"times":function chartStoryTimes(scene, len, beat) {
  const items = scene.items, n = items.length, mode = scene.chart ?? 'bars';
  const scale = Math.min(1, len / 3.3), max = Math.max(...items.map(item => item.value)) || 1;
  let arrivals;
  if (mode === 'line') {
    const points = items.map((item, i) => [80 + 840 * i / (n - 1), 470 - 350 * item.value / max]);
    const lengths = [0];
    for (let i = 1; i < n; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    arrivals = lengths.map(length => ({at: .55 + 1.5 * length / lengths[n - 1], duration: .35}));
  } else if (mode === 'donut') {
    const total = items.reduce((sum, item) => sum + item.value, 0);let cumulative = 0;
    arrivals = items.map(item => {const share = item.value / total, at = .55 + 1.6 * cumulative;cumulative += share;return {at, duration: 1.6 * share};});
  } else {
    const duration = mode === 'progress' ? .9 : .85, stagger = (1.6 - duration) / (n - 1);
    arrivals = items.map((_, i) => ({at: .55 + stagger * i, duration}));
  }
  return {scale, enter: 0, enterDuration: .5 * scale, axis: .15 * scale, axisDuration: .5 * scale,
    build: .55 * scale, buildDuration: 1.6 * scale, lineDuration: 1.5 * scale,
    labels: items.map((_, i) => (.85 + i * .12) * scale), labelDuration: .4 * scale,
    items: arrivals.map(item => ({at: item.at * scale, duration: item.duration * scale, end: (item.at + item.duration) * scale})),
    area: 2.1 * scale, areaDuration: .45 * scale,
    callout: 2.35 * scale, calloutDuration: .45 * scale, rollDuration: .7 * scale,
    settled: 3.3 * scale, driftEnd: Math.max(3.3 * scale, len - .3)};
},
"sounds":function(s,len,cue,beat){const t=this.times(s,len,beat);cue(t.build,'whoosh',.4);t.items.forEach(item=>cue(item.end,'tick',.45));cue(t.callout+t.rollDuration,'chime',.65);}},
"testimonial-proof-card":{"fields":{"quote":{"kind":"string",
"min":1,
"max":180},
"name":{"kind":"string",
"min":1,
"max":32},
"role":{"kind":"string",
"min":1,
"max":48,
"optional":true},
"company":{"kind":"string",
"min":1,
"max":32,
"optional":true},
"emphasis":{"kind":"string",
"min":1,
"max":48,
"optional":true},
"image":{"kind":"string",
"min":1,
"max":300,
"optional":true}},
"guide":"testimonial-proof-card {quote, name, role?, company?, emphasis?, image?}: measured quote lines rise through masks; author appears as they land, then a drawn underline marks emphasis. emphasis must occur verbatim within quote. image is an optional local portrait. Use only an actual supplied quote and attribution; do not invent endorsements. Long quotes need more time or separate excerpts. 8-12 beats.",
"sample":{"type":"testimonial-proof-card",
"beats":10,
"quote":"Your own words belong here. Make the message unmistakable.",
"name":"Example author",
"role":"Demonstration only",
"emphasis":"message unmistakable"},
"validateMedia":function(s){return registryMediaProblems(s.image===undefined?[]:[s.image]);},
"validate":function(s){return [...this.validateMedia(s),...(s.emphasis&&!s.quote.includes(s.emphasis)?['emphasis must occur verbatim within quote']:[])];},
"times":function(s,len){const scale=Math.min(1,len/2.2);return {enter:.5*scale,lines:.15*scale,lineDuration:.6*scale,lastLine:.87*scale,byline:1.32*scale,bylineDuration:.5*scale,draw:1.57*scale,drawDuration:.55*scale,settled:2.2*scale};},
"sounds":function(s,len,cue,beat){const t=this.times(s,len,beat);cue(t.lines,'whoosh',.4);cue(t.byline+t.bylineDuration,'pop',.5);if(s.emphasis)cue(t.draw,'sparkle',.45);}},
"modal-morph":{"fields":{"title":{"kind":"string",
"min":1,
"max":48},
"body":{"kind":"string",
"min":1,
"max":160},
"cta":{"kind":"string",
"min":1,
"max":24},
"eyebrow":{"kind":"string",
"min":1,
"max":24,
"optional":true},
"register":{"kind":"enum",
"values":["calm","snappy"],
"optional":true}},
"guide":"modal-morph {title, body, cta, eyebrow?, register?: calm|snappy}: a compact card expands into a panel with persistent keyed content; child counter-scaling preserves text while the surface morphs. Body and action arrive in the last part of the expansion. This is one continuous shared-element move, not a second camera. 6-9 beats.",
"sample":{"type":"modal-morph",
"beats":8,
"eyebrow":"Your workspace",
"title":"Room for the whole idea",
"body":"Open a thought into a focused space, with context and the next step in view.",
"cta":"Explore the idea",
"register":"calm"},
"times":function(s,len){return {enter:Math.min(.4,len*.1),expand:len*.24,morph:Math.min(s.register==='snappy'?.6:.9,len*.24)};},
"sounds":function(s,len,cue,beat){const t=this.times(s,len,beat);cue(t.expand,'whoosh',.6);cue(t.expand+t.morph,'pop',.7);}}
,"ride":{
// One ball rides through a row of real controls under one camera, never a cut.
// Grown from components/ui-world (switch, jump, slider):
// here the stops are a list, the hops and the camera are worked out from it.
"signature":true,
"copyFields":["title"],
"fields":{
  "stops":{"kind":"array","min":2,"max":6,"of":{"kind":"object","fields":{
    "kind":{"kind":"enum","values":["switch","slider","button","check","stepper"]},
    "label":{"kind":"string","min":1,"max":18},
    "value":{"kind":"number","int":true,"min":1,"max":100,"optional":true}}}},
  "title":{"kind":"string","min":1,"max":40,"optional":true}
},
"guide":"ride {stops[{kind, label, value?} x2-6], title?}: ONE white ball rides through real controls in one continuous camera move, never a cut: it drops in, becomes the thumb of a switch and flips it, hops to a slider and drags it to its value with a counting bubble, lands on a button and presses it, ticks a checkbox, bounces a stepper up to its number, then the camera pulls back and every control is seen in its new state under the title. kind is switch | slider | button | check | stepper; label is the control's own short name (\"Focus mode\", \"Brightness\", \"Start\"); value is the slider's target out of 100 (default 80) or the stepper's count 1-9 (default 3). Every landing is on a beat when the scene has the beats (with fewer it still plays, squeezed and off the beat, and fit says how many it needs): give it stops + the units of its actions + 3 (a slider is 2, a stepper of 9 is 5, of 7-8 is 4, of 5-6 is 3, of 3-4 is 2, anything else 1; three stops with one slider need 3+4+3 = 10 beats). For a product's settings, a setup in a few taps, \"it is this easy\". 8-24 beats.",
"sample":{"type":"ride","beats":12,"title":"Set up in three taps",
  "stops":[{"kind":"switch","label":"Focus mode"},{"kind":"slider","label":"Brightness","value":80},{"kind":"button","label":"Start"}]},
"units":function units(stop){
      if(stop.kind==='slider')return 2;
      if(stop.kind==='stepper')return Math.max(1,Math.ceil((stop.value??3)/2));
      return 1;
    },
"needs":function needs(s){return s.stops.length+s.stops.reduce((sum,stop)=>sum+this.units(stop),0)+3;},
"validate":function validate(s){
      const errors=[];
      if(!Array.isArray(s?.stops)||s.stops.length<2||s.stops.length>6)return ['stops must contain 2 to 6 controls'];
      s.stops.forEach((stop,i)=>{
        if(stop.kind==='stepper'&&stop.value!==undefined&&stop.value>9)errors.push(`stops[${i}].value: a stepper counts to 9 at most`);
        if(stop.value!==undefined&&!['slider','stepper'].includes(stop.kind))errors.push(`stops[${i}].value is for a slider or a stepper, not a ${stop.kind}`);
      });
      return errors;
    },
// A ride with too few beats still plays, squeezed and off the beat: fit says so.
"note":function note(s){
      const needs=this.needs(s);
      return Number.isFinite(s.beats)&&s.beats<needs?`these stops need ${needs} beats for every landing to fall on a beat (stops + the units of their actions + 3); with ${s.beats} the ride is squeezed and off the beat`:null;
    },
// Every time of the scene, from the list of stops alone. `grid` is one musical
// beat when the scene has enough of them, so landings fall on the beat; spare
// time goes to the closing view, where the title is read.
"times":function times(s,len,beat){
      const needs=this.needs(s),onBeat=Number.isFinite(beat)&&beat>0&&len/beat>=needs-1e-6;
      const grid=onBeat?beat:len/needs,hop=Math.min(grid*.82,.62);
      let cursor=0;
      const stops=s.stops.map((stop,i)=>{
        const land=cursor+grid,span=this.units(stop)*grid,end=land+span;
        const value=stop.kind==='slider'?stop.value??80:stop.kind==='stepper'?stop.value??3:1;
        const act={from:land+Math.min(.16,grid*.2),to:end-Math.min(.14,grid*.18)};
        if(stop.kind==='switch')act.to=Math.min(act.to,act.from+.42);
        if(stop.kind==='button'||stop.kind==='check'){act.from=land;act.to=land+Math.min(.3,grid*.5);}
        // A stepper counts on equal steps: the first is the landing itself.
        const steps=stop.kind==='stepper'?Array.from({length:value},(_,k)=>land+k*span/value):[];
        cursor=end;
        return {index:i,kind:stop.kind,value,leave:land-hop,land,act,steps,end};
      });
      const overview=cursor+Math.min(.12,grid*.15),settle=Math.min(overview+Math.max(.7,Math.min(1.1,grid*1.4)),len);
      return {grid,hop,onBeat,stops,overview,settle,beat};
    },
"sounds":function sounds(s,len,cue,beat){
      const t=this.times(s,len,beat);
      t.stops.forEach((stop,i)=>{
        if(i)cue(stop.leave,'whoosh',.35);
        if(stop.kind==='button')cue(stop.land,'click',.9);
        else if(stop.kind==='check'){cue(stop.land,'pop',.6);cue(stop.act.to,'ping',.7);}
        else if(stop.kind==='stepper')stop.steps.forEach((at,k)=>cue(at,k===stop.steps.length-1?'ping':'tick',k===stop.steps.length-1?.7:.6));
        else if(stop.kind==='switch'){cue(stop.land,'pop',.55);cue(stop.act.to,'click',.8);}
        else{
          cue(stop.land,'pop',.55);
          // The thumb eases out: a tick as it passes each quarter of its way.
          for(let k=1;k<4;k++)cue(stop.act.from+(stop.act.to-stop.act.from)*(1-Math.sqrt(1-k/4)),'tick',.45);
          cue(stop.act.to,'ping',.7);
        }
      });
      cue(t.overview,'whoosh',.5);
      cue(t.settle,'chime',.8);
    }}
,"lens-wall":{
// An endless wall of the film's pictures and videos under a lens, crossed by a
// camera on one of a few paths. The wall is the shared component
// components/lens-wall (lens-wall/wall.mjs here).
"signature":true,
"fields":{
  "images":{"kind":"array","of":{"kind":"string","min":1,"max":300},"min":1,"max":24,"optional":true},
  "videos":{"kind":"array","of":{"kind":"string","min":1,"max":300},"min":1,"max":7,"optional":true},
  "path":{"kind":"enum","values":["drift","orbit","wave","eight","zigzag"],"optional":true},
  "tiles":{"kind":"enum","values":["portrait","square","landscape"],"optional":true}
},
"guide":"lens-wall {images?[1-24], videos?[1-7], path?, tiles?}: an endless wall of pictures and videos under a lens: whatever is in the centre is three times larger and the rest curve away like the side of a sphere, while the camera crosses the wall and the videos play in their tiles. The wall has seven example videos of its own (a neon street, an arcade, old screens, a city, a disco ball, a dance) and plays them when the scene names no files. images and videos: the user's own files take the examples' places one by one, so three of theirs play among four examples and seven or more leave none; give every file the user has for it. path: how the camera moves, drift (a straight glide, default) | orbit (a circle) | wave (a glide that sways) | eight (a figure of eight) | zigzag. tiles: portrait (default) | square | landscape, the shape every file is cropped to. No words: put the line before or after it. Use for a gallery, a portfolio, a trip, \"everything you made this year\". 4-12 beats.",
"sample":{"type":"lens-wall","beats":8,"path":"orbit"},
"previewVariants":["path","tiles"],
// The wall's own example videos at their public address, the same list as the
// shared component's EXAMPLES and PUBLIC. A wall has seven places: the film's
// files take them one by one, the examples keep the rest, and seven files of
// the film's leave no example.
"places":7,
"examples":["a1.mp4","a2.mp4","a3.mp4","a4.mp4","a5.mp4","a6.mp4","a7.mp4"],
"public":"https://motion-fab-share.b-cdn.net/components/lens-wall",
"own":function own(path){return typeof path==='string'&&path.startsWith(this.public+'/')&&this.examples.includes(path.slice(this.public.length+1));},
// The scene as it is played: its videos followed by the examples that have a
// place left. film.json never holds them.
"filled":function filled(s){
      const mine=(Array.isArray(s.images)?s.images.length:0)+(Array.isArray(s.videos)?s.videos.length:0);
      const examples=this.examples.slice(0,Math.max(0,this.places-mine)).map(file=>`${this.public}/${file}`);
      return examples.length?{...s,videos:[...(s.videos??[]),...examples]}:s;
    },
"validateMedia":function(s){
      const videos=s.videos===undefined?[]:s.videos;
      return [...registryMediaProblems(s.images===undefined?[]:s.images),
        ...(Array.isArray(videos)?videos.flatMap((path,i)=>this.own(path)?[]:projectPathProblems(path,`video path ${i+1}`)):['videos must be a list of project-relative paths'])];
    },
"validate":function validate(s){
      const errors=[...this.validateMedia(s)];
      for(const [field,pattern,kinds] of [['images',/\.(jpe?g|png|webp|avif|gif|svg)$/i,'a picture (jpg, png, webp, avif, gif, svg)'],['videos',/\.(mp4|mov|m4v|webm)$/i,'a video (mp4, mov, m4v, webm)']]){
        (Array.isArray(s[field])?s[field]:[]).forEach((path,i)=>{if(typeof path==='string'&&!pattern.test(path.split(/[?#]/,1)[0]))errors.push(`${field}[${i}] must be ${kinds}`);});
      }
      return errors;
    },
"sounds":function sounds(s,len,cue){cue(Math.min(.08,len*.02),'whoosh',.35);}}
,"comic":{
// Comic Glitch Text, ported from Pixel UI with the author's permission
// (scenes/text.mjs, SOURCE.json): a paragraph glitches in word by word through
// comic panels, torn colour slices and print misregistration, at 24 frames a second.
"typeOnly":true,
"copyFields":["text"],
"fields":{"text":{"kind":"string","min":8,"max":180}},
"guide":"comic {text}: a paragraph (4-28 words) glitches in word by word like a comic still on the press: each word flickers through tilted colour panels with a patch of red halftone dots and torn slices of itself in cyan, magenta and yellow, stands bold with its colours out of register, then settles into the line; now and then a word that has settled glitches again. It moves in steps, 24 a second. For a quote, a manifesto line, a punchy statement that should be read whole; not for a headline of two words. Two words a beat read well, three at most: 4-10 beats.",
"sample":{"type":"comic","beats":8,"text":"Every great launch starts as a rough sketch that somebody refused to throw away."},
"count":function count(s){return String(s.text??'').trim().split(/\s+/u).filter(Boolean).length;},
"validate":function validate(s){
      const n=this.count(s),errors=[];
      if(n<4||n>28)errors.push(`text: ${n} words; the scene reads 4 to 28`);
      if(!errors.length&&Number.isFinite(s.beats)&&n>s.beats*3)errors.push(`beats: ${n} words need at least ${Math.ceil(n/3)} beats to be read`);
      return errors;
    },
// Every time of the scene in frames of a 24th of a second, as the original
// counts them. A word enters `stagger` frames after the one before (3 in the
// original; here as many as bring the words on the half beat, when the scene
// has room, and leave the last one time to settle); its glitch is 17 frames.
"times":function times(s,len,beat){
      const n=this.count(s),tick=1/24,first=Math.round(Math.min(.12,len*.03)/tick);
      const room=Math.max(1,Math.floor((len/tick-first-17)*.9/Math.max(1,n-1)));
      const half=Number.isFinite(beat)&&beat>0?Math.max(1,Math.round(beat/2/tick)):room;
      const stagger=Math.min(half,room);
      const enter=Array.from({length:n},(_,i)=>first+i*stagger);
      return {tick,stagger,enter,words:enter.map(frame=>frame*tick),entered:first+n*stagger+16};
    },
"sounds":function sounds(s,len,cue,beat){
      const t=this.times(s,len,beat);
      t.words.forEach((at,i)=>cue(at,'tick',i%4===0?.5:.32));
      cue(Math.min(len*.96,t.entered*t.tick),'pop',.6);
    }}
};
module.exports = definitions;
