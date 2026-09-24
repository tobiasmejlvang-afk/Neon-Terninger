'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({window:{},structuredClone,Blob});for(const file of ['studio-model.js','fusion-model.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs',file),'utf8'),ctx);
const M=ctx.window.NeonFusionModel;let passed=0;
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
const item=(id,phase='Nu')=>({id,text:'Et kort',player:'Spiller 1',seconds:30,status:'klar',phase});
test('Move preserves source, changes phase and inserts before target',()=>{const source=[item('a'),item('b','Senere'),item('c','Senere')];const result=M.move(source,'a','c','Senere');assert.equal(source[0].phase,'Nu');assert.equal(result.map(i=>i.id).join(','),'b,a,c');assert.equal(result[1].phase,'Senere');});
test('Move to own position leaves order unchanged',()=>{assert.equal(M.move([item('a'),item('b')],'a','a','Nu').map(i=>i.id).join(','),'a,b');});
test('Unknown phase is rejected',()=>assert.throws(()=>M.move([item('a')],'a','','unknown')));
test('Path wraps for every supported length and dice outcome',()=>{for(let n=24;n<=64;n++)for(let pos=0;pos<n;pos++)for(let roll=1;roll<=50;roll++)assert.equal(M.pathStep(pos,roll,n),(pos+roll)%n);});
test('Invalid path lengths and steps are rejected',()=>{for(const args of [[0,0,24],[0,1,23],[0,1,65],[-1,1,32],[32,1,32]])assert.throws(()=>M.pathStep(...args));});
test('Session accepts valid cards and rejects duplicates and invalid states',()=>{const s={version:1,items:[item('a')],history:[]};assert.equal(M.validateSession(s),true);assert.throws(()=>M.validateSession({...s,items:[item('a'),item('a')]}));assert.throws(()=>M.validateSession({...s,items:[{...item('a'),status:'broken'}]}));});
test('Invalid game backup does not pass validation',()=>{assert.throws(()=>M.validateSession({version:1,items:[],history:[],game:{config:{}}}));});
class Reader {readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onload();}).catch(e=>this.onerror(e));}}
const codec=vm.createContext({Blob,FileReader:Reader,fetch,Promise,Object,Array,Error});const source=fs.readFileSync(path.join(__dirname,'../docs/fusion.js'),'utf8');vm.runInContext(source.slice(source.indexOf('async function encode(value)'),source.indexOf('async function exportSession()')),codec);
test('Backup codec preserves nested image bytes and plain content',async()=>{const data={items:[{text:'<script>untrusted</script>',blob:new Blob(['image-bytes'],{type:'image/webp'})}]};const encoded=await codec.encode(data);const decoded=await codec.decode(JSON.parse(JSON.stringify(encoded)));assert.equal(await decoded.items[0].blob.text(),'image-bytes');assert.equal(decoded.items[0].blob.type,'image/webp');assert.equal(decoded.items[0].text,data.items[0].text);});
test('Backup codec rejects SVG and prototype pollution',async()=>{await assert.rejects(codec.decode({__image:'data:image/svg+xml;base64,PHN2Zz4='}));await assert.rejects(codec.decode(JSON.parse('{"__proto__":{"polluted":true}}')));assert.equal({}.polluted,undefined);});
test('Snapshot indices are checked before restore can write image data',()=>{const config=ctx.window.NeonStudioModel.blank();const s={version:1,items:[],history:[],game:{config,results:Array(6).fill(null),resultIndices:[999,null,null,null,null,null],round:1,selected:0,next:0,images:[]}};assert.throws(()=>M.validateSession(s),/resultat/);s.game.resultIndices[0]=null;assert.equal(M.validateSession(s),true);});
(async()=>{for(const [name,fn]of tests){await fn();passed++;console.log('PASS '+name);}console.log(`${passed} Fusion regression tests passed.`);})().catch(e=>{console.error(e);process.exitCode=1;});
