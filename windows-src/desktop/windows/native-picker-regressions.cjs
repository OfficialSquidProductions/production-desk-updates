const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {clipboard}=require('electron');

// Runs only in the explicitly enabled disposable Windows Actions desktop.
module.exports=async({win,output,flush,js,waitFor})=>{
  assert.equal(process.platform,'win32');
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  const helper=path.join(output,'native-picker-escape.ps1');
  fs.writeFileSync(helper, String.raw`param([int]$TargetPid,[string]$Evidence)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Windows.Forms,System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class PickerNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
'@
$condition=[System.Windows.Automation.AndCondition]::new(
  [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$TargetPid),
  [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770'))
$deadline=[DateTime]::UtcNow.AddSeconds(20)
$dialog=$null
while([DateTime]::UtcNow -lt $deadline){
  $dialog=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition)
  if($dialog -and -not $dialog.Current.IsOffscreen){break}
  Start-Sleep -Milliseconds 100
}
if(-not $dialog){throw 'No native #32770 file picker owned by the smoke process appeared'}
$handle=[IntPtr]$dialog.Current.NativeWindowHandle
$record=@{processId=$dialog.Current.ProcessId;className=$dialog.Current.ClassName;name=$dialog.Current.Name;handle=$handle.ToInt64();interactive=[Environment]::UserInteractive;escapeSent=$false;closed=$false}
try {
  $dialog.SetFocus()
  if([PickerNative]::GetForegroundWindow() -ne $handle){throw 'Native picker is not foreground; refusing to send Escape'}
  $rect=$dialog.Current.BoundingRectangle
  $bitmap=[System.Drawing.Bitmap]::new([int]$rect.Width,[int]$rect.Height)
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  try {$graphics.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bitmap.Size);$bitmap.Save($Evidence+'.png',[System.Drawing.Imaging.ImageFormat]::Png)} finally {$graphics.Dispose();$bitmap.Dispose()}
  [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
  $record.escapeSent=$true
  $deadline=[DateTime]::UtcNow.AddSeconds(10)
  while([PickerNative]::IsWindow($handle) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
  $record.closed=-not [PickerNative]::IsWindow($handle)
  if(-not $record.closed){throw 'Escape did not close the native picker'}
} finally {$record | ConvertTo-Json | Set-Content ($Evidence+'.json') -Encoding UTF8}
`);
  const records=[];
  win.show();win.focus();
  for(const [index,text] of ['INT. OFFICE - DAY\n\nA clock ticks.','INT. CAFÉ - DAY\n\nÉlodie sees 東京.'].entries()){
    // Persist normalization before the immutable preservation baseline.
    await js(`(()=>{document.querySelector('[data-view="workspace"]').click();const m=document.querySelector('#breakdown-continuous');if(m?.checked){m.checked=false;m.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('[data-field="description"]').dispatchEvent(new Event('input',{bubbles:true}));})()`);
    assert.equal(await flush(),true);
    const before=await js(`fetch('/api/workspace').then(r=>r.json())`);
    await js(`window.slateDesktop.importScript();window.nativePickerEvents=[];document.querySelector('#import-file').addEventListener('cancel',e=>window.nativePickerEvents.push({trusted:e.isTrusted,bubbles:e.bubbles}));`);
    for(let attempt=0;attempt<3;attempt++){
      const evidence=path.join(output,`native-picker-${index}-${attempt}`);
      const done=new Promise((resolve,reject)=>{
        const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-File',helper,'-TargetPid',String(process.pid),'-Evidence',evidence],{windowsHide:true});
        let error='';child.stderr.on('data',v=>error+=v);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Native picker helper failed: '+code+' '+error)));
      });
      // userGesture opens Chromium's actual OS picker, not a mocked dialog.
      const opened=win.webContents.executeJavaScript(`document.querySelector('#import-file').click()`,true);
      await Promise.all([done,opened]);
      await waitFor(`window.nativePickerEvents.length===${attempt+1}`);
      const events=await js('window.nativePickerEvents');
      assert.equal(events[attempt].trusted,true,'Cancellation must originate from the real picker');
      assert.equal(events[attempt].bubbles,true);
      assert.equal(await js('document.querySelector("#modal").open'),true);
      assert.deepEqual(await js(`fetch('/api/workspace').then(r=>r.json())`),before,'Native cancellation changed the saved production');
    }
    clipboard.writeText(text);
    await js(`document.querySelector('#paste-script').focus()`);
    win.webContents.paste();
    await waitFor(`document.querySelector('#paste-script').value===${JSON.stringify(text)}`);
    await js(`document.querySelector('#import-submit').click()`);
    await waitFor(`!document.querySelector('#modal').open`);
    assert.equal(await flush(),true);
    const after=await js(`fetch('/api/workspace').then(r=>r.json())`);
    assert.equal(after.projects.length,before.projects.length+1);
    assert.deepEqual(after.projects.slice(0,-1),before.projects,'Paste import changed previous productions');
    assert.ok(after.projects.at(-1).breakdowns.some(b=>b._scriptText.includes(index?'東京':'clock')));
    records.push({text,events:await js('window.nativePickerEvents'),preserved:true,imported:true});
    fs.writeFileSync(path.join(output,'native-picker-result.json'),JSON.stringify({passed:true,cases:records},null,2));
  }
  return ['Actual Windows file picker opens; three Escapes produce trusted cancellation per ASCII/Unicode case; clipboard paste imports and preserves existing productions'];
};
