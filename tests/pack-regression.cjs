'use strict';

// Runs actual packs.js handlers with controlled browser/storage boundaries.
// Published layout: node tests/pack-regression.cjs
// Alternate checkout: NEON_DOCS=/path/to/docs node pack-regression.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const sourcePath = path.join(process.env.NEON_DOCS || path.resolve(__dirname, '../docs'), 'packs.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const config = name => ({version:2,count:1,dice:Array.from({length:4},()=>({name,faces:[{text:'A',imageId:''},{text:'B',imageId:''}]}))});
const deferred = () => {let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(initial=config('Current A')) {
  const nodes=new Map(), local=new Map([['neon-terninger-v1',JSON.stringify(initial)]]), saved=[], notices=[];
  let nextId=0,reloads=0;
  function node(tag='div') {
    const listeners=new Map();
    const result={tagName:tag.toUpperCase(),value:'',textContent:'',hidden:false,disabled:false,open:false,dataset:{},children:[],style:{setProperty(){}},attributes:{},className:'',clickCount:0,
      setAttribute(key,value){this.attributes[key]=String(value);},
      append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
      addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(listener);},
      dispatch(type,event={}){for(const listener of listeners.get(type)||[])listener(event);},
      showModal(){this.open=true;},close(){this.open=false;this.dispatch('close');},
      click(){this.clickCount++;if(!this.disabled)this.onclick?.({currentTarget:this,target:this});},
      focus(){this.focused=true;},
      querySelectorAll(selector){
        const matches=element=>selector.split(',').some(part=>{part=part.trim();if(part==='[data-source]')return 'source' in element.dataset;if(part.startsWith('.'))return element.className.split(' ').includes(part.slice(1));return element.tagName.toLowerCase()===part;});
        return this.children.flatMap(child=>[...(matches(child)?[child]:[]),...child.querySelectorAll(selector)]);
      },querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    };
    result.classList={toggle(name,on){const set=new Set(result.className.split(' ').filter(Boolean));if(on)set.add(name);else set.delete(name);result.className=[...set].join(' ');}};
    Object.defineProperty(result,'innerHTML',{set(markup){
      this.markup=markup;this.children=[];
      for(const match of markup.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)){
        const child=node(match[1]), attrs=match[2];
        const id=attrs.match(/\bid="([^"]+)"/);if(id){child.id=id[1];nodes.set(child.id,child);}
        child.className=attrs.match(/\bclass="([^"]+)"/)?.[1]||'';
        child.hidden=/\bhidden(?:\s|$)/.test(attrs);child.type=attrs.match(/\btype="([^"]+)"/)?.[1]||'';
        const source=attrs.match(/\bdata-source="([^"]+)"/);if(source)child.dataset.source=source[1];
        this.children.push(child);
      }
    },get(){return this.markup||'';}});
    return result;
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const context={console,Blob,Map,Set,Date,Math,JSON,Promise,Error,Number,String,Boolean,Array,Intl,URL,setTimeout,requestAnimationFrame(){},notices,
    crypto:{randomUUID:()=>`test-${++nextId}`},window:{},
    document:{getElementById:get,createElement:node,body:{append(){}}},
    localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value)},
    location:{reload(){reloads++;}}
  };
  context.globalThis=context;vm.createContext(context);
  const marker="  if(!('indexedDB'in window))return;";
  assert.ok(source.includes(marker),'Expected packs.js mounting marker');
  vm.runInContext(source.replace(marker,`
    globalThis.testAPI={openDesigner,closeDesigner,saveDesign,saveCurrent,snapshotCurrent,loadPack,action,packs,media,
      getDesigner:()=>designer,getDialog:()=>designerDialog,setCoverPreparer:fn=>prepareCover=fn};
    renderList=async()=>{};flash=text=>globalThis.notices.push(text);return;
${marker}`),context,{filename:sourcePath});
  const api=context.testAPI;
  api.packs.put=async pack=>saved.push(structuredClone(pack));
  api.media.get=async()=>null;
  const open=async(pack=null)=>{await api.openDesigner(pack);if(!pack)get('designer-name').value='Pack A';};
  const upload=()=>get('designer-cover-input').onchange({currentTarget:get('designer-cover-input'),target:get('designer-cover-input')});
  const chooseFile=()=>{get('designer-cover-input').files=[{type:'image/png',size:20}];return upload();};
  const loadHandler=pack=>{
    const start="card.querySelector('.pack-load').onclick=",end=";card.querySelector('.pack-edit-design')";
    const index=source.indexOf(start),last=source.indexOf(end,index);assert.ok(index>=0&&last>index);
    Object.assign(context,{pack,loadPack:api.loadPack,$:get,flash:message=>notices.push(message)});
    return vm.runInContext(`(${source.slice(index+start.length,last)})`,context);
  };
  return {api,get,open,chooseFile,local,saved,notices,node,loadHandler,reloads:()=>reloads};
}

const tests=[];
const test=(name,run)=>tests.push({name,run});

test('pending image save is immutable; cancel, Escape, reopening and duplicate save are blocked',async()=>{
  const original=config('Current A');original.dice[0].faces[0].imageId='image-A';
  const h=harness(original),pending=deferred();h.api.media.get=()=>pending.promise;await h.open();
  const save=h.api.saveDesign();assert.equal(h.get('save-design').disabled,true);assert.equal(h.get('cancel-designer').disabled,true);
  assert.equal(h.api.closeDesigner(),false);
  let prevented=false;h.api.getDialog().dispatch('cancel',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.ok(h.api.getDialog().open);
  assert.equal(await h.api.openDesigner({id:'pack-B',name:'B',config:config('B'),images:[]}),false);
  await h.api.saveDesign();
  h.api.getDesigner().config.dice[0].name='Changed after click';h.get('designer-name').value='Changed after click';
  pending.resolve(new Blob(['image A']));await save;
  assert.equal(h.saved.length,1);assert.notEqual(h.saved[0].id,'pack-B');assert.equal(h.saved[0].name,'Pack A');
  assert.equal(h.saved[0].config.dice[0].name,'Current A');assert.equal(h.saved[0].images[0].sourceId,'image-A');
  assert.equal(h.api.getDialog().open,false);
});

test('save awaits the selected cover and the durable pack write',async()=>{
  const h=harness(),cover=deferred(),write=deferred();await h.open();h.api.setCoverPreparer(()=>cover.promise);
  let written;h.api.packs.put=pack=>{written=structuredClone(pack);return write.promise;};
  const upload=h.chooseFile(),save=h.api.saveDesign();await tick();assert.equal(written,undefined);
  cover.resolve(new Blob(['chosen cover']));await upload;await tick();
  assert.equal(written.cover.size,12);assert.equal(h.api.getDialog().open,true);
  write.resolve();await save;assert.equal(h.api.getDialog().open,false);
});

test('cancelled cover work cannot change or clear the next designer session',async()=>{
  const h=harness(),first=deferred(),second=deferred();await h.open();h.api.setCoverPreparer(()=>first.promise);
  const oldUpload=h.chooseFile();assert.equal(h.api.closeDesigner(),true);
  const existingCover=new Blob(['existing B']);await h.open({id:'pack-B',name:'B',config:config('B'),images:[],cover:existingCover});
  h.api.setCoverPreparer(()=>second.promise);const newUpload=h.chooseFile();
  first.resolve(new Blob(['wrong old cover']));await oldUpload;
  assert.equal(h.api.getDesigner().cover,existingCover);assert.equal(h.api.getDesigner().coverPending,second.promise);
  second.resolve(new Blob(['correct B']));await newUpload;assert.equal(h.api.getDesigner().cover.size,9);
  assert.equal(h.api.getDesigner().pack.id,'pack-B');assert.equal(h.api.getDesigner().coverPending,null);
});

test('failed cover processing prevents save, reports the error and permits retry',async()=>{
  const h=harness(),cover=deferred();await h.open();h.api.setCoverPreparer(()=>cover.promise);
  const upload=h.chooseFile(),save=h.api.saveDesign();cover.reject(new Error('Billedet kunne ikke læses.'));await Promise.all([upload,save]);
  assert.equal(h.saved.length,0);assert.equal(h.api.getDialog().open,true);assert.equal(h.get('save-design').disabled,false);
  assert.equal(h.get('designer-error').textContent,'Billedet kunne ikke læses.');
  h.api.setCoverPreparer(async()=>new Blob(['retry']));await h.chooseFile();await h.api.saveDesign();assert.equal(h.saved[0].cover.size,5);
});

test('storage read/write failures retain the draft and do not silently strip images',async()=>{
  const initial=config('Current A');initial.dice[0].faces[0].imageId='image-A';const h=harness(initial);await h.open();
  h.api.media.get=async()=>{throw new Error('Billedlageret svigtede.');};await h.api.saveDesign();
  assert.equal(h.saved.length,0);assert.equal(h.get('designer-error').textContent,'Billedlageret svigtede.');assert.equal(h.api.getDesigner().config.dice[0].faces[0].imageId,'image-A');
  h.api.media.get=async()=>new Blob(['A']);h.api.packs.put=async()=>{throw new Error('Lageret er fuldt.');};await h.api.saveDesign();
  assert.equal(h.get('designer-error').textContent,'Lageret er fuldt.');assert.equal(h.get('save-design').disabled,false);assert.equal(h.api.getDialog().open,true);
  h.api.packs.put=async pack=>h.saved.push(structuredClone(pack));await h.api.saveDesign();assert.equal(h.saved.length,1);
});

test('native cover button activates the input; remove control follows actual cover state',async()=>{
  const h=harness();await h.open();assert.equal(h.get('choose-cover').tagName,'BUTTON');assert.equal(h.get('choose-cover').type,'button');
  h.get('choose-cover').click();assert.equal(h.get('designer-cover-input').clickCount,1);
  assert.equal(h.get('remove-cover').hidden,true);h.api.setCoverPreparer(async()=>new Blob(['cover']));await h.chooseFile();
  assert.equal(h.get('remove-cover').hidden,false);h.get('remove-cover').click();assert.equal(h.get('remove-cover').hidden,true);
  assert.equal(h.api.getDesigner().cover,null);
});

test('failed load captures currentTarget and re-enables its button with visible error',async()=>{
  const h=harness();h.api.packs.get=async()=>undefined;const handler=h.loadHandler({id:'deleted-pack'}),button=h.node('button'),event={currentTarget:button};
  const pending=handler(event);event.currentTarget=null;await pending;
  assert.equal(button.disabled,false);assert.equal(h.get('pack-error').textContent,'Spilpakken kunne ikke læses.');assert.equal(h.reloads(),0);
});

test('successful pack load remaps images and saves existing storage keys before reload',async()=>{
  const h=harness(),original=config('Saved B');original.dice[0].faces[0].imageId='old-image';const cover=new Blob(['image']),writes=[];
  h.api.packs.get=async()=>({id:'pack-B',name:'B',config:original,images:[{sourceId:'old-image',blob:cover}]});
  h.api.media.put=async(id,blob)=>writes.push({id,blob});
  const handler=h.loadHandler({id:'pack-B'}),button=h.node('button'),event={currentTarget:button};const pending=handler(event);event.currentTarget=null;await pending;
  const loaded=JSON.parse(h.local.get('neon-terninger-v1'));assert.equal(loaded.dice[0].faces[0].imageId,writes[0].id);assert.notEqual(writes[0].id,'old-image');
  assert.equal(original.dice[0].faces[0].imageId,'old-image');assert.equal(h.local.get('neon-terninger-active-pack-v1'),'pack-B');
  assert.equal(JSON.parse(h.local.get('neon-terninger-mode-v1')).name,'B');assert.equal(h.reloads(),1);assert.equal(button.disabled,false);
});

test('editing a stored pack preserves its ID, images, cover and creation time',async()=>{
  const h=harness(),cover=new Blob(['cover']),image=new Blob(['face']);
  await h.open({id:'existing',name:'Old name',createdAt:123,config:config('Existing'),cover,images:[{sourceId:'old',blob:image}]});
  h.get('designer-name').value='Renamed';await h.api.saveDesign();const saved=h.saved[0];
  assert.equal(saved.id,'existing');assert.equal(saved.name,'Renamed');assert.equal(saved.createdAt,123);assert.equal(saved.cover.size,5);assert.equal(saved.images[0].blob.size,4);
});

test('quick save preserves pack metadata and handles missing existing packs',async()=>{
  const h=harness(),cover=new Blob(['cover']);h.api.packs.get=async()=>({id:'existing',name:'Old',createdAt:10,cover,description:'Our set',icon:'♥',color:'#ff315f'});
  const saved=await h.api.saveCurrent('New','existing');assert.equal(saved.id,'existing');assert.equal(saved.createdAt,10);assert.equal(saved.cover,cover);assert.equal(saved.description,'Our set');
  assert.equal(h.local.get('neon-terninger-active-pack-v1'),'existing');h.api.packs.get=async()=>undefined;
  await assert.rejects(h.api.saveCurrent('Missing','missing'),/findes ikke længere/);assert.equal(h.saved.length,1);
});

test('IndexedDB action waits for commit and rejects a post-request transaction abort',async()=>{
  const h=harness();let closed=0,tx;const request={result:'written'},db={close(){closed++;},transaction(){tx={objectStore(){return{};},abort(){}};return tx;}};
  let settled=false;const write=h.api.action(Promise.resolve(db),'packs','readwrite',()=>request).then(value=>{settled=true;return value;});
  await tick();request.onsuccess?.();await tick();assert.equal(settled,false);tx.oncomplete();assert.equal(await write,'written');assert.equal(closed,1);
  const failure=h.api.action(Promise.resolve(db),'packs','readwrite',()=>request);await tick();tx.error=new Error('Commit failed');tx.onabort();
  await assert.rejects(failure,/Commit failed/);assert.equal(closed,2);
});

(async()=>{
  for(const {name,run} of tests){await run();console.log(`PASS ${name}`);}
  console.log(`PASS ${tests.length} actual-source pack regression tests`);
})().catch(error=>{console.error(error);process.exitCode=1;});
