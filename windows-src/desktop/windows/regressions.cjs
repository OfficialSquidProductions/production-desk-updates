const assert = require('node:assert/strict');

// Shared by the packaged Windows smoke check and the local browser check.
module.exports = async ({js, flush, readWorkspace, post, reload, waitFor}) => {
  const original = await readWorkspace();
  const active = workspace => workspace.projects.find(p => p.id === workspace.activeProject);
  const checks = [];
  try {
    await js(`document.querySelector('[data-view="elements"]').click()`);
    const element = await js(`(() => {
      const input=document.querySelector('[data-element-name]');
      const result={id:input.dataset.elementName,name:input.value};
      input.focus();
      for(const value of ['Review name','Review renamed element']){
        input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      return result;
    })()`);
    assert.equal(await flush(), true);
    assert.equal(active(await readWorkspace()).elements.find(e=>e.id===element.id).name, 'Review renamed element');
    await reload();
    assert.equal(active(await readWorkspace()).elements.find(e=>e.id===element.id).name, 'Review renamed element');
    await js(`document.querySelector('[data-view="elements"]').click();
      const input=document.querySelector('[data-element-id]');input.focus();input.value='REVIEW42';
      input.dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await flush(), true);
    assert.equal(active(await readWorkspace()).elements[0].elementId, 'REVIEW42');
    await js(`document.querySelector('#undo').click()`);
    assert.equal(await flush(), true);
    assert.notEqual(active(await readWorkspace()).elements[0].elementId, 'REVIEW42');
    await js(`document.querySelector('#redo').click()`);
    assert.equal(await flush(), true);
    assert.equal(active(await readWorkspace()).elements[0].elementId, 'REVIEW42');
    checks.push('Focused element name/board-ID edits survive native flush and reload; Undo/Redo works');

    await js(`document.querySelector('[data-view="shots"]').click()`);
    for(const number of ['REVIEW1','REVIEW2']) {
      await js(`document.querySelector('#add-scene').click();
        document.querySelector('#new-shot-number').value=${JSON.stringify(number)};
        document.querySelector('#new-shot-description').value='Synthetic shot regression';
        document.querySelector('#new-shot-save').click();`);
    }
    assert.equal(await flush(), true);
    const selected = active(await readWorkspace())._shots.find(s=>s.number==='REVIEW2').id;
    for(const invalid of [' ', ' review1 ']) {
      await js(`(() => {const input=document.querySelector('[data-shot-field="number"]');
        input.focus();input.value=${JSON.stringify(invalid)};
        input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      assert.equal(await flush(), true);
      assert.equal(active(await readWorkspace())._shots.find(s=>s.id===selected).number, 'REVIEW2');
    }
    await js(`(() => {const input=document.querySelector('[data-shot-field="number"]');
      input.value=' REVIEW3 ';input.dispatchEvent(new Event('input',{bubbles:true}));
      const notes=document.querySelector('[data-shot-field="notes"]');notes.value='Saves still work';
      notes.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.equal(await flush(), true);
    const shot=active(await readWorkspace())._shots.find(s=>s.id===selected);
    assert.equal(shot.number, 'REVIEW3');assert.equal(shot.notes, 'Saves still work');
    checks.push('Whitespace/duplicate shot numbers retain the last valid value and never block saves');

    for(const value of [[], null, 1, 'bad']) {
      const response=await post('/api/import',JSON.stringify(value),{'X-Filename':'invalid.json'});
      assert.equal(response.status,400);assert.equal(typeof (await response.json()).error,'string');
    }
    checks.push('Malformed JSON imports return structured errors while the server remains usable');

    const parsed=await (await post('/api/import','INT. REVIEW ROOM - DAY\n\nA synthetic scene.',{'X-Filename':'review.txt'})).json();
    const project=parsed.project;project.project='Review restored backup';project.stripboards=[];
    const backup={version:1,projects:[project],activeProject:project.id};
    await js(`document.querySelector('#import-open').click();
      const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(backup))}], 'review-backup.json',{type:'application/json'}));
      document.querySelector('#import-file').files=transfer.files;
      document.querySelector('#import-submit').click();`);
    await waitFor(`!document.querySelector('#modal').open && document.querySelector('#project-title').textContent==='Review restored backup'`);
    await js(`document.querySelector('[data-view="schedule"]').click();
      document.querySelector('[data-action="add-day"]').click();`);
    assert.equal(await js(`document.querySelectorAll('.day-block').length`),1);
    await js(`document.querySelector('#add-scene').click();
      document.querySelector('[data-field="modal-value"]').value='2';document.querySelector('#modal-ok').click();`);
    assert.equal(await flush(),true);
    const restored=active(await readWorkspace());
    assert.equal(restored.breakdowns.length,2);
    assert.equal(restored.stripboards[0].boards[0].breakdownIds.length,1);
    await reload();
    assert.equal(active(await readWorkspace()).breakdowns.length,2);
    checks.push('Backups without scenarios can add shooting days/scenes, save and reload');
  } finally {
    await flush();
    const response=await post('/api/workspace',JSON.stringify(original));
    assert.equal(response.status,200);
    await reload();
  }
  return checks;
};
