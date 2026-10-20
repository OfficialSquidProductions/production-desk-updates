// DOM regression shared by the native Mac and browser harnesses. Synthetic data only.
module.exports = async function runBreakdownEditingChecks() {
  const $=s=>document.querySelector(s), checks=[];
  const expect=(value,message)=>{if(!value)throw Error(message);};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const wait=async check=>{for(let i=0;i<200&&!check();i++)await new Promise(r=>setTimeout(r,25));expect(check(),'Breakdown import timed out: '+$('#toast').textContent);};
  const read=async()=>{
    expect(await window.slateDesktop.flush(),'Breakdown save failed');
    const w=window.webkit?.messageHandlers?.scheduler
      ? await window.webkit.messageHandlers.scheduler.postMessage({operation:'load'})
      : await(await fetch('/api/workspace')).json();
    return w.projects.find(p=>p.id===w.activeProject);
  };
  $('[data-view="workspace"]').click();window.slateDesktop.importScript();
  $('#paste-script').value='1 INT. FIRST ROOM - DAY\n\nLeave this scene alone.\n\n2 EXT. SECOND ROOM - NIGHT\n\n'+Array.from({length:150},(_,i)=>`The camera passes the copper lantern at marker ${i}.`).join('\n\n');
  $('#import-submit').click();await wait(()=>!$('#modal').open);
  const picker=$('#scene-picker');picker.value=picker.options[1].value;picker.dispatchEvent(new Event('change',{bubbles:true}));
  const scene=$('#scene-picker').value, script=$('#script-text'), shell=$('#workspace-shell');
  const show=pane=>{
    const tab=$(`[data-workspace-pane="${pane}"]`);if(tab)tab.click();
  };
  show('script');
  const text=script.querySelectorAll('p')[80].firstChild, range=document.createRange();
  const start=text.textContent.indexOf('copper lantern');range.setStart(text,start);range.setEnd(text,start+14);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  script.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  const scriptScroll=$('.script-scroll'), sheet=$('.breakdown-scroll');
  scriptScroll.scrollTop=1300;sheet.scrollTop=650;
  $('#tag-category').value='104';
  $('[data-add-category="106"] input').value='Unsubmitted wardrobe draft';
  const scroll=scriptScroll.scrollTop, top=sheet.scrollTop;
  expect(scroll>0&&top>0,'Regression fixture must overflow both panes');
  $('#tag-selection').click();await frame();
  expect($('#script-text')===script,'Tagging replaced the script DOM');
  expect($('#scene-picker').value===scene,'Tagging changed the selected scene');
  expect($('#tag-category').value==='104','Tagging reset the category to cast');
  expect(getSelection().toString()==='copper lantern','Tagging lost the script selection');
  expect(Math.abs(scriptScroll.scrollTop-scroll)<2&&Math.abs(sheet.scrollTop-top)<2,'Tagging reset a scroll position');
  expect($('[data-add-category="106"] input').value==='Unsubmitted wardrobe draft','Tagging discarded another entry draft');
  expect($('[data-add-category="104"]').previousElementSibling.textContent.includes('copper lantern'),'Tag did not appear');
  $('#tag-selection').click();
  let p=await read(), b=p.breakdowns.find(b=>b.id===scene);
  const prop=p.elements.find(e=>e.name==='copper lantern');
  expect(prop&&b.elements.filter(id=>id===prop.id).length===1,'Repeated tag created duplicate assignments');
  expect(!p.breakdowns[0].elements.includes(prop.id),'Tag was assigned to the first scene');
  checks.push('Tagging retains script nodes, text range, category, non-first scene, drafts and both pane scroll offsets');
  show('breakdown');await frame();
  const form=$('[data-add-category="100"]'), input=form.querySelector('input'), notes=$('[data-field="comments"]');
  for(const name of ['Regression Actor One','Regression Actor Two']) {
    input.focus({preventScroll:true});input.value=name;input.setSelectionRange(4,10);
    sheet.scrollTop=520;const before=sheet.scrollTop;
    form.requestSubmit();await frame();
    expect(form.isConnected&&$('[data-add-category="100"] input')===input,'Actor add replaced the entry field');
    expect(document.activeElement===input&&input.value==='','Actor entry lost focus or was not cleared');
    expect(Math.abs(sheet.scrollTop-before)<2,'Actor entry reset sheet scroll');
    expect($('#scene-picker').value===scene&&$('#script-text')===script,'Actor entry changed scene or script');
    expect(!shell||$('#workspace-shell')===shell,'Actor entry replaced the iPad workspace panes');
  }
  input.value='Unsubmitted third actor';input.setSelectionRange(3,9);
  notes.value='Focused production notes';notes.dispatchEvent(new Event('input',{bubbles:true}));
  notes.focus({preventScroll:true});notes.setSelectionRange(2,7);
  const remove=$('[data-add-category="100"]').previousElementSibling.querySelector('[data-remove-element]');
  const actorID=remove.dataset.removeElement;sheet.scrollTop=580;const before=sheet.scrollTop;
  remove.click();await frame();
  expect(document.activeElement===notes&&notes.selectionStart===2&&notes.selectionEnd===7,'Removal disturbed editing focus or caret');
  expect(input.value==='Unsubmitted third actor'&&input.selectionStart===3&&input.selectionEnd===9,'Removal lost an actor draft or caret');
  expect(Math.abs(sheet.scrollTop-before)<2,'Removal reset sheet scroll');
  expect($('#tag-category').value==='104','Actor edits reset tagging category');
  p=await read();b=p.breakdowns.find(b=>b.id===scene);
  expect(!b.elements.includes(actorID)&&b.comments==='Focused production notes','Element removal or inline notes did not persist');
  expect(p.elements.some(e=>e.id===actorID),'Removal deleted the reusable production element');
  checks.push('Repeated actor entry keeps the same input and focus; removal preserves other drafts, caret, notes and scroll');
  const remaining=$('[data-add-category="100"]').previousElementSibling.querySelector('[data-remove-element]');
  remaining.focus({preventScroll:true});remaining.click();
  expect(document.activeElement===input,'Focused removal did not return focus to its category entry');
  // A previously hidden category must become usable without rebinding the page.
  const extra=$('#extra-category');expect(extra.options.length>0,'Missing additional category');
  const category=extra.value;
  $('[data-action="extra-element"]').click();$('[data-field="modal-value"]').value='Extra category item';$('#modal-ok').click();await frame();
  const extraForm=$(`[data-add-category="${category}"]`);expect(extraForm,'Additional category was not displayed');
  extraForm.querySelector('input').value='Second extra item';extraForm.requestSubmit();
  expect(extraForm.previousElementSibling.textContent.includes('Second extra item'),'New category form was not bound');
  expect($('#script-text')===script,'Additional category replaced the script');
  p=await read();b=p.breakdowns.find(b=>b.id===scene);
  const second=p.elements.find(e=>e.name==='Second extra item');expect(b.elements.includes(second.id),'New category assignment did not save');
  $('#undo').click();p=await read();expect(!p.breakdowns.find(b=>b.id===scene).elements.includes(second.id),'Undo did not remove the assignment');
  $('#redo').click();p=await read();expect(p.breakdowns.find(b=>b.id===scene).elements.includes(second.id),'Redo did not restore the assignment');
  checks.push('Additional categories bind without page replacement; saves, reusable elements and Undo/Redo remain valid');
  // Cached selections must not tag text from a previous scene after navigation.
  $('#scene-picker').value=$('#scene-picker').options[0].value;$('#scene-picker').dispatchEvent(new Event('change',{bubbles:true}));
  $('#tag-selection').click();expect($('#toast').textContent.includes('Select a name'),'Stale text selection leaked into another scene');
  checks.push('Scene navigation clears stale tag text');
  return checks;
};
