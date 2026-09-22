'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../docs/play.js'),'utf8');
const studio=fs.readFileSync(require('node:path').join(__dirname,'../docs/studio.js'),'utf8');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('Leaving native fullscreen removes focus mode and restores navigation',()=>{
  const classes=new Set(['play-focus']),button={setAttribute(k,v){this[k]=v;}};
  const c=vm.createContext({document:{fullscreenEnabled:true,fullscreenElement:null,body:{classList:{contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}}}},fullscreen:button});
  vm.runInContext(source.slice(source.indexOf('function updateFullscreen()'),source.indexOf("document.addEventListener('fullscreenchange'")),c);
  c.updateFullscreen();assert.equal(classes.has('play-focus'),false);assert.equal(button['aria-pressed'],'false');assert.match(button.textContent,/Fuldskærm/);
  c.document.fullscreenElement={};c.updateFullscreen();assert.equal(classes.has('play-focus'),true);
  c.document.fullscreenEnabled=false;c.document.fullscreenElement=null;c.updateFullscreen();assert.equal(classes.has('play-focus'),true);
});
test('Typing intermediate field counts preserves all content until committed',()=>{
  const model=vm.createContext({window:{},structuredClone});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../docs/studio-model.js'),'utf8'),model);
  const M=model.window.NeonStudioModel,draft={config:M.blank()},input={value:'50'};M.resizeFaces(draft.config.dice[0],50);draft.config.dice[0].faces[29].text='Retain this';
  const c=vm.createContext({M,draft,editing:0,pending:false,$:()=>input,dirtyDraft(){},paintFields(){},toast(){}});
  vm.runInContext(studio.slice(studio.indexOf("$('studio-face-count').onchange="),studio.indexOf("$('studio-add-face').onclick=")),c);
  input.value='3';input.oninput();assert.equal(draft.config.dice[0].faces.length,50);
  input.value='30';input.oninput();assert.equal(draft.config.dice[0].faces.length,50);input.onchange();assert.equal(draft.config.dice[0].faces.length,30);assert.equal(draft.config.dice[0].faces[29].text,'Retain this');
});
console.log(`${passed} play regression tests passed.`);
