export const LINED_ACTIONS={select:'Select tool',coverage:'Coverage tool',pen:'Pen tool',highlighter:'Highlighter tool',arrow:'Arrow tool',text:'Note tool',style:'Toggle straight / wavy',continuous:'Toggle continuous scroll',previous:'Previous page',next:'Next page',zoomIn:'Zoom in',zoomOut:'Zoom out',newShot:'Create shot',linkShot:'Link existing shot',renumber:'Renumber selected shot',delete:'Delete selected annotation',attach:'Attach PDF',export:'Export lined PDF'};
export const DEFAULT_BINDS={select:'v',coverage:'c',pen:'p',highlighter:'h',arrow:'a',text:'t',style:'w',continuous:'Shift+c',previous:'[',next:']',zoomIn:'=',zoomOut:'-',newShot:'Shift+n',linkShot:'l',renumber:'r',delete:'Delete',attach:'Shift+o',export:'Mod+e'};
export function isEditing(target=document.activeElement){return !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]');}
export function eventBinding(event){
  if(event.isComposing||event.key==='Dead'||event.key==='Process'||['Meta','Control','Alt','Shift'].includes(event.key))return '';
  let key=event.key.length===1?event.key.toLowerCase():event.key;
  // Option on Mac and shifted punctuation can change event.key into a glyph.
  const physical=/^Key[A-Z]$/.test(event.code)?event.code.slice(3).toLowerCase():/^Digit[0-9]$/.test(event.code)?event.code.slice(5):({BracketLeft:'[',BracketRight:']',Equal:'=',Minus:'-'})[event.code];
  if(physical&&(event.altKey||!/^([a-z0-9\[\]=\-]|[A-Z][a-zA-Z]+)$/.test(key)))key=physical;
  return [...(event.metaKey||event.ctrlKey?['Mod']:[]),...(event.altKey?['Alt']:[]),...(event.shiftKey?['Shift']:[]),key].join('+');
}
export function bindingError(binds){
  const seen=new Map();
  for(const [action,name] of Object.entries(LINED_ACTIONS)){
    const binding=binds[action];if(!binding)continue;
    if(/^(?:Mod\+)?(?:Alt\+)?(?:Shift\+)?(?:[a-z0-9\[\]=\-]|Arrow(?:Up|Down|Left|Right)|Delete|Backspace|F(?:[1-9]|1[0-2]))$/.test(binding)===false)return 'Choose a letter, number, arrow, function key, Delete, [, ], = or -.';
    if(/^(?:Mod\+(?:Shift\+)?[zsyqwxrvacptnfohm]|(?:Shift\+)?F(?:5|10|11)|(?:Shift\+)?Backspace)$/.test(binding))return binding+' is reserved for editing, navigation or application commands.';
    if(seen.has(binding))return name+' conflicts with '+LINED_ACTIONS[seen.get(binding)]+'. Clear or change one binding.';
    seen.set(binding,action);
  }
  return '';
}
