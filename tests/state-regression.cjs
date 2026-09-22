'use strict';
// Exercises production handlers in an isolated DOM/storage harness. No runtime dependencies.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = process.env.NEON_DOCS || path.resolve(__dirname, '../docs');
const CONFIG = 'neon-terninger-v1';
const MODE = 'neon-terninger-mode-v1';
const BACKUP = 'neon-terninger-custom-backup-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const makeConfig = () => ({version:2,count:4,dice:Array.from({length:4},(_,i)=>({name:`D${i+1}`,faces:Array.from({length:3},(_,j)=>({text:`D${i+1}F${j+1}`,imageId:''}))}))});
class Node {
  constructor(tag='div') {this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){}};this.open=false;this.value='';this.disabled=false;}
  addEventListener(name,fn){(this.handlers[name] ||= []).push(fn);}
  append(...nodes){this.children.push(...nodes);}
  prepend(node){this.children.unshift(node);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(){}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  querySelectorAll(selector){const tags=selector.split(',');const found=[];const visit=n=>{for(const child of n.children){if(tags.includes(child.tag))found.push(child);visit(child);}};visit(this);return found;}
  querySelector(selector){if(selector==='input:not([type=file])')return this.querySelectorAll('input').find(n=>n.type!=='file');return this.querySelectorAll(selector)[0]||null;}
  get lastElementChild(){return this.children.at(-1);}
  fire(name,event={preventDefault(){}}){return Promise.all((this.handlers[name]||[]).map(fn=>fn(event)));}
}
function makeStorage(seed=[]) {
  const values=new Map(seed);let quota=Infinity;const failures=new Set();let writes=0;
  const size=map=>[...map].reduce((total,[key,value])=>total+key.length+value.length,0);
  return {values,failures,size:()=>size(values),setQuota:value=>quota=value,get writes(){return writes;},
    api:{getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key),setItem(key,value){const proposed=new Map(values).set(key,String(value));if(failures.has(key)||size(proposed)>quota)throw new Error('QuotaExceededError');values.set(key,String(value));writes++;}}};
}
function setupApp({config=makeConfig(),raw,db,overrideMedia=true,start=true}={}) {
  const nodes=new Map(),blobStore=new Map();
  const storage=makeStorage([[CONFIG,raw===undefined?JSON.stringify(config):raw]]);
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);},createElement(tag){const node=new Node(tag);if(tag==='canvas'){node.getContext=()=>({fillRect(){},drawImage(){}});node.toBlob=fn=>queueMicrotask(()=>fn({type:'image/webp'}));}return node;},querySelectorAll:()=>[],querySelector:()=>null};
  const form=document.getElementById('editor-form');
  for(const id of ['editor-tabs','face-inputs','die-name','add-face','cancel-editor','close-editor'])form.append(document.getElementById(id));
  class FakeImage {constructor(){this.naturalWidth=100;this.naturalHeight=100;}set src(value){queueMicrotask(()=>this.onload?.());}}
  const events=[];
  const window={dispatchEvent(event){events.push(event);},NeonBoards:{create:()=>({render(){},async spin(){},reveal(){},mode:'dice'})}};if(db)window.indexedDB=db;
  const context={document,localStorage:storage.api,window,indexedDB:db,navigator:{},location:{protocol:'file:'},Image:FakeImage,URL:{createObjectURL:()=> 'blob:fake',revokeObjectURL(){}},setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};context.globalThis=context;
  let code=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  if(!start)code=code.replace('if (initializeStorage) save(); render(); void cleanupUnusedImages();','');
  code=code.replace(/\}\)\(\);\s*$/,`globalThis.audit={media,save,valid2,openEditor,cancelEditor,cleanupUnusedImages,state(){return {config,draft,editing,imageBusy,editorActive,sessionNewImages:[...sessionNewImages]};},stageImage(id,index=0){draft[editing].faces[index].imageId=id;sessionNewImages.add(id);renderEditor();}};})();`);
  context.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options.detail;}};
  vm.runInNewContext(code,context);
  if(overrideMedia){context.audit.media.get=async id=>blobStore.get(id);context.audit.media.keys=async()=>[...blobStore.keys()];context.audit.media.del=async id=>blobStore.delete(id);context.audit.media.put=async(id,blob)=>{blobStore.set(id,blob);return id;};}
  return {a:context.audit,game:window.NeonGame,nodes,storage,blobStore,events};
}
function setupModes(config=makeConfig()) {
  const storage=makeStorage([[CONFIG,JSON.stringify(config)]]),alerts=[];let reloads=0;
  const context={localStorage:storage.api,document:{body:{dataset:{}},querySelector:()=>null},location:{reload(){reloads++;}},alert:message=>alerts.push(message)};context.globalThis=context;
  const code=fs.readFileSync(path.join(ROOT,'modes.js'),'utf8').replace('if (!sidebar || !intro) return;','globalThis.auditModes={applyMode,restoreCustom,saveConfigAndMode}; return;');
  vm.runInNewContext(code,context);
  return {a:context.auditModes,storage,alerts,get reloads(){return reloads;}};
}
const removeButton=(t,index=0)=>t.nodes.get('face-inputs').children[index].children[0].children[1];
const faceInput=(t,index=0)=>t.nodes.get('face-inputs').children[index].children[1].children[1].children[1];
const uploadInput=(t,index=0)=>t.nodes.get('face-inputs').children[index].children[1].children[1].children[2].children[0].children[0];
const clearButton=(t,index=0)=>t.nodes.get('face-inputs').children[index].children[1].children[1].children[2].children[1];
const submit=t=>t.nodes.get('editor-form').fire('submit');
const dialog={close(){}};
const tests=[];const test=(name,run)=>tests.push({name,run});

test('An empty round cannot advance or produce a history entry',()=>{const t=setupApp();t.game.reset();assert.equal(t.game.snapshot().round,1);assert.equal(t.events.length,0);assert.equal(t.nodes.get('new-round').disabled,true);});
test('Round snapshots preserve results, advance once and cannot mutate live config',async()=>{const t=setupApp();await t.game.roll(0);const outcome=t.game.snapshot().results[0].text;t.game.reset();const entry=t.events.find(e=>e.type==='neon:round-end');assert.equal(entry.detail.results[0].text,outcome);assert.equal(entry.detail.round,1);assert.equal(t.game.snapshot().round,2);assert.equal(t.game.snapshot().results.every(r=>r===null),true);entry.detail.config.dice[0].name='changed';assert.notEqual(t.game.config.dice[0].name,'changed');t.game.reset();assert.equal(t.events.filter(e=>e.type==='neon:round-end').length,1);});
test('Result cards select an unplayed die and reopen completed content',async()=>{const t=setupApp();await t.nodes.get('results-list').children[1].fire('click');assert.equal(t.game.snapshot().next,1);await t.game.roll();await t.nodes.get('results-list').children[1].fire('click');assert.equal(t.events.at(-1).type,'neon:review');assert.equal(t.events.at(-1).detail.index,1);});
test('Starting a new package resets the round number and all results',async()=>{const t=setupApp();await t.game.roll(0);t.game.reset();assert.equal(t.game.snapshot().round,2);t.game.apply(makeConfig());assert.equal(t.game.snapshot().round,1);assert.equal(t.game.snapshot().results.every(r=>r===null),true);});

test('double removal cannot drop below two sides or save an invalid set',async()=>{
  const t=setupApp();t.a.openEditor();t.blobStore.set('newimg',true);t.a.stageImage('newimg');
  const remove=removeButton(t);await Promise.all([remove.fire('click'),remove.fire('click')]);
  assert.equal(t.a.state().draft[0].faces.length,2);assert.equal(t.blobStore.has('newimg'),true);
  await submit(t);await tick();const saved=JSON.parse(t.storage.values.get(CONFIG));assert.equal(saved.dice[0].faces.length,2);assert.equal(Boolean(t.a.valid2(saved)),true);assert.equal(t.blobStore.has('newimg'),false);
  const reloaded=setupApp({config:saved});assert.deepEqual(clone(reloaded.a.state().config),saved);
});
test('remove and clear target their original die when tabs change',async()=>{
  const t=setupApp();t.a.openEditor();t.blobStore.set('first',true);t.a.stageImage('first');const remove=removeButton(t);
  await remove.fire('click');await t.nodes.get('editor-tabs').children[1].fire('click');await remove.fire('click');
  assert.equal(t.a.state().draft[0].faces.length,2);assert.equal(t.a.state().draft[1].faces.length,3);
  t.blobStore.set('second',true);t.a.stageImage('second');const clear=clearButton(t);await clear.fire('click');await t.nodes.get('editor-tabs').children[2].fire('click');await clear.fire('click');
  assert.equal(t.a.state().draft[1].faces[0].imageId,'');assert.equal(t.a.state().draft[2].faces[0].text,'D3F1');assert.equal(t.blobStore.has('second'),true);
});
test('cancel invalidates save immediately and cleanup cannot affect a reopened editor',async()=>{
  const t=setupApp(),before=t.storage.values.get(CONFIG);t.a.openEditor();t.blobStore.set('cancelled',true);t.a.stageImage('cancelled');const staleRemove=removeButton(t);
  let finishDelete;t.a.media.del=id=>new Promise(resolve=>{finishDelete=()=>{t.blobStore.delete(id);resolve();};});
  t.a.cancelEditor();await submit(t);assert.equal(t.a.state().editorActive,false);assert.equal(t.storage.values.get(CONFIG),before);await tick();assert.equal(typeof finishDelete,'function');
  t.a.openEditor();t.blobStore.set('saved',true);t.a.stageImage('saved');await staleRemove.fire('click');assert.equal(t.a.state().draft[0].faces.length,3);await submit(t);
  finishDelete();await tick();assert.equal(JSON.parse(t.storage.values.get(CONFIG)).dice[0].faces[0].imageId,'saved');assert.equal(t.blobStore.has('saved'),true);assert.equal(t.blobStore.has('cancelled'),false);
});
test('failed save retains durable images and open draft, then retry commits and cleans',async()=>{
  const cfg=makeConfig();cfg.dice[0].faces[0].imageId='oldimg';const t=setupApp({config:cfg}),before=t.storage.values.get(CONFIG);t.blobStore.set('oldimg',true);t.a.openEditor();await clearButton(t).fire('click');
  const input=faceInput(t);input.value='A'.repeat(160);await input.fire('input');t.storage.setQuota(t.storage.size()+100);await submit(t);await tick();
  assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.blobStore.has('oldimg'),true);assert.equal(t.a.state().editorActive,true);assert.equal(t.nodes.get('editor').open,true);assert.match(t.nodes.get('editor-error').textContent,/ikke gemmes/);
  t.storage.setQuota(Infinity);await submit(t);await tick();assert.equal(t.a.state().editorActive,false);assert.equal(JSON.parse(t.storage.values.get(CONFIG)).dice[0].faces[0].text,'A'.repeat(160));assert.equal(t.blobStore.has('oldimg'),false);
});
test('cancel after failed save keeps previously saved images and discards only new images',async()=>{
  const cfg=makeConfig();cfg.dice[0].faces[0].imageId='oldimg';const t=setupApp({config:cfg});t.blobStore.set('oldimg',true);t.a.openEditor();t.blobStore.set('newimg',true);t.a.stageImage('newimg');t.storage.failures.add(CONFIG);await submit(t);t.a.cancelEditor();await tick();
  assert.equal(t.blobStore.has('oldimg'),true);assert.equal(t.blobStore.has('newimg'),false);assert.equal(JSON.parse(t.storage.values.get(CONFIG)).dice[0].faces[0].imageId,'oldimg');
});
test('full validation rejects invalid save candidates and invalid editor submissions',async()=>{
  const mutations=[c=>c.count=5,c=>c.dice.pop(),c=>c.dice[0]=null,c=>c.dice[0].faces.pop()&&c.dice[0].faces.pop(),c=>c.dice[0].faces=Array(51).fill({text:'ok',imageId:''}),c=>c.dice[0].name='',c=>c.dice[0].name='x'.repeat(31),c=>c.dice[0].faces[0]={text:'',imageId:''},c=>c.dice[0].faces[0].text='x'.repeat(161)];
  const t=setupApp(),before=t.storage.values.get(CONFIG);for(const mutate of mutations){const candidate=makeConfig();mutate(candidate);assert.equal(t.a.save(candidate),false);assert.equal(t.storage.values.get(CONFIG),before);}
  t.a.openEditor();t.a.state().draft[0].faces.splice(1);await submit(t);assert.equal(t.a.state().editorActive,true);assert.equal(t.storage.values.get(CONFIG),before);
});
test('unreadable or invalid persisted configuration is not overwritten or garbage collected',async()=>{
  for(const raw of ['{broken',JSON.stringify({...makeConfig(),count:5})]){const t=setupApp({raw});t.blobStore.set('recoverable',true);await t.a.cleanupUnusedImages();assert.equal(t.storage.values.get(CONFIG),raw);assert.equal(t.blobStore.has('recoverable'),true);}
});
test('image cleanup retains backup images and images in the live editor session',async()=>{
  const t=setupApp(),backup=makeConfig();backup.dice[0].faces[0].imageId='backup';t.storage.values.set(BACKUP,JSON.stringify(backup));t.blobStore.set('backup',true);t.blobStore.set('draft',true);t.blobStore.set('unused',true);t.a.openEditor();t.a.stageImage('draft');await t.a.cleanupUnusedImages();
  assert.equal(t.blobStore.has('backup'),true);assert.equal(t.blobStore.has('draft'),true);assert.equal(t.blobStore.has('unused'),false);
});
test('upload locks editing until committed, then saves and retains the image',async()=>{
  const t=setupApp();t.a.openEditor();let finishPut;t.a.media.put=(id,blob)=>new Promise(resolve=>finishPut=()=>{t.blobStore.set(id,blob);resolve(id);});
  const input=uploadInput(t);input.files=[{type:'image/png',size:10}];const upload=input.fire('change');await tick();assert.equal(t.a.state().imageBusy,true);
  t.a.cancelEditor();await submit(t);await t.nodes.get('editor-tabs').children[1].fire('click');assert.equal(t.a.state().editorActive,true);assert.equal(t.a.state().editing,0);
  finishPut();await upload;assert.equal(t.a.state().imageBusy,false);const id=t.a.state().draft[0].faces[0].imageId;assert.ok(id);await submit(t);await tick();assert.equal(JSON.parse(t.storage.values.get(CONFIG)).dice[0].faces[0].imageId,id);assert.equal(t.blobStore.has(id),true);
});
test('failed image write unlocks editor without replacing the previous image',async()=>{
  const cfg=makeConfig();cfg.dice[0].faces[0].imageId='oldimg';const t=setupApp({config:cfg});t.a.openEditor();t.a.media.put=async()=>{throw new Error('Transaction aborted');};const input=uploadInput(t);input.files=[{type:'image/png',size:10}];await input.fire('change');
  assert.equal(t.a.state().imageBusy,false);assert.equal(t.a.state().draft[0].faces[0].imageId,'oldimg');assert.equal(t.a.state().sessionNewImages.length,0);assert.match(t.nodes.get('editor-error').textContent,/Transaction aborted/);
});
test('IndexedDB write resolves only on transaction completion and rejects commit abort',async()=>{
  const transactions=[];
  const database={transaction(){const request={result:'saved-id'},tx={objectStore:()=>({put:()=>request}),request};transactions.push(tx);return tx;}};
  const indexedDB={open(){const request={result:database};queueMicrotask(()=>request.onsuccess());return request;}};
  const t=setupApp({db:indexedDB,overrideMedia:false,start:false});let resolved=false;const first=t.a.media.put('image',{}).then(()=>{resolved=true;});await tick();const tx=transactions[0];tx.request.onsuccess();await tick();assert.equal(resolved,false);tx.oncomplete();await first;assert.equal(resolved,true);
  const second=t.a.media.put('image2',{});const rejection=assert.rejects(second,/commit aborted/);await tick();const aborted=transactions[1];aborted.request.onsuccess();aborted.error=new Error('commit aborted');aborted.onabort();await rejection;
});
test('pack image imports survive cleanup until commit and failed imports can be released',async()=>{
  const t=setupApp();await t.game.media.put('staged-pack-image',true);await t.a.cleanupUnusedImages();assert.equal(t.blobStore.has('staged-pack-image'),true);
  const candidate=makeConfig();candidate.dice[0].faces[0].imageId='staged-pack-image';t.a.save(candidate);t.game.releaseImages(['staged-pack-image']);await tick();assert.equal(t.blobStore.has('staged-pack-image'),true);
  await t.game.media.put('abandoned-pack-image',true);t.game.releaseImages(['abandoned-pack-image']);await tick();assert.equal(t.blobStore.has('abandoned-pack-image'),false);assert.equal(t.blobStore.has('staged-pack-image'),true);
});
test('preset application aborts if there is no space for the required backup',()=>{
  const cfg=makeConfig();for(const die of cfg.dice)die.faces=Array.from({length:20},()=>({text:'Custom user content '.repeat(8),imageId:''}));const t=setupModes(cfg),before=t.storage.values.get(CONFIG);t.storage.setQuota(t.storage.size()+128);t.a.applyMode('romantic',dialog);
  assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.storage.values.has(BACKUP),false);assert.equal(t.storage.values.has(MODE),false);assert.equal(t.reloads,0);assert.match(t.alerts[0],/backup/);
});
test('preset and restore happy path retain an exact backup including images',()=>{
  const cfg=makeConfig();cfg.dice[0].faces[0].imageId='personal-image';const t=setupModes(cfg),before=t.storage.values.get(CONFIG);t.a.applyMode('romantic',dialog);assert.equal(t.storage.values.get(BACKUP),before);assert.equal(JSON.parse(t.storage.values.get(MODE)).id,'romantic');assert.equal(t.reloads,1);
  t.a.restoreCustom(dialog);assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.storage.values.has(BACKUP),false);assert.equal(JSON.parse(t.storage.values.get(MODE)).id,'custom');assert.equal(t.reloads,2);
});
test('preset metadata or configuration write failure never replaces active content',()=>{
  for(const key of [MODE,CONFIG]){const t=setupModes(),before=t.storage.values.get(CONFIG);t.storage.values.set(MODE,JSON.stringify({id:'custom',name:'Existing'}));const beforeMode=t.storage.values.get(MODE);t.storage.failures.add(key);t.a.applyMode('romantic',dialog);assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.storage.values.get(MODE),beforeMode);assert.equal(t.reloads,0);}
});
test('failed restore keeps its backup and the active preset',()=>{
  const t=setupModes();t.a.applyMode('romantic',dialog);const before=t.storage.values.get(CONFIG),backup=t.storage.values.get(BACKUP);t.storage.failures.add(CONFIG);t.a.restoreCustom(dialog);assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.storage.values.get(BACKUP),backup);assert.equal(JSON.parse(t.storage.values.get(MODE)).id,'romantic');assert.equal(t.reloads,1);
});
test('invalid preset backup cannot overwrite the active configuration',()=>{
  const t=setupModes(),before=t.storage.values.get(CONFIG);t.storage.values.set(BACKUP,JSON.stringify({...makeConfig(),count:5}));t.a.restoreCustom(dialog);t.a.applyMode('romantic',dialog);assert.equal(t.storage.values.get(CONFIG),before);assert.equal(t.reloads,0);assert.ok(t.storage.values.has(BACKUP));
});
(async()=>{for(const {name,run} of tests){await run();console.log(`PASS ${name}`);}console.log(`\n${tests.length} state regression tests passed.`);})().catch(error=>{console.error(error);process.exitCode=1;});
