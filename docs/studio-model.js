'use strict';
(() => {
  const clone = value => structuredClone(value);
  const face = text => ({text, imageId:''});
  const die = (name = 'Terning', values = ['1','2','3','4','5','6']) => ({name, reveal:'content', symbol:'✦', faces:values.map(face)});
  const blank = () => ({version:2,count:1,dice:Array.from({length:6},(_,i)=>die(`Terning ${i+1}`))});
  function normalize(config) {
    const copy = clone(config);
    if (!copy || !Array.isArray(copy.dice) || copy.dice.length < 1 || copy.dice.length > 6) throw new Error('Spillet skal have 1–6 terninger/hjul.');
    if(copy.version===1){copy.dice.forEach(d=>d.faces=d.faces.map(face));copy.version=2;}
    while(copy.dice.length<6)copy.dice.push(die(`Terning ${copy.dice.length+1}`));
    copy.dice.forEach(d=>{d.reveal=['content','number','symbol'].includes(d.reveal)?d.reveal:'content';d.symbol=typeof d.symbol==='string'&&d.symbol.trim()?d.symbol.slice(0,4):'✦';});
    validate(copy); return copy;
  }
  function validate(c) {
    if(!c||c.version!==2||!Number.isInteger(c.count)||c.count<1||c.count>6||!Array.isArray(c.dice)||c.dice.length!==6)throw new Error('Vælg 1–6 terninger/hjul.');
    c.dice.forEach((d,i)=>{
      if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>30)throw new Error(`Giv terning/hjul ${i+1} et navn på højst 30 tegn.`);
      if(!Array.isArray(d.faces)||d.faces.length<2||d.faces.length>50)throw new Error(`${d.name} skal have 2–50 felter.`);
      d.faces.forEach((f,j)=>{if(!f||typeof f.text!=='string'||f.text.length>160||typeof f.imageId!=='string'||(!f.text.trim()&&!f.imageId))throw new Error(`${d.name}, felt ${j+1}: indsæt tekst eller billede (maks. 160 tegn).`);});
    });return true;
  }
  function resizeFaces(d,count){if(!Number.isInteger(count)||count<2||count>50)throw new Error('Vælg 2–50 felter.');while(d.faces.length<count)d.faces.push(face(`Felt ${d.faces.length+1}`));d.faces.length=count;}
  const themes=[{id:'velvet',name:'Dark Velvet Neon',accent:'#ff2f83',secondary:'#ba8cff',background:'#0b0609'},{id:'crimson',name:'Crimson Room',accent:'#ff354d',secondary:'#ff986f',background:'#0e080d'},{id:'violet',name:'Electric Violet',accent:'#bd75ff',secondary:'#66e4ff',background:'#0d0b19'},{id:'ice',name:'Arctic Neon',accent:'#39e4dc',secondary:'#72a3ff',background:'#071218'},{id:'gold',name:'Midnight Gold',accent:'#f4bc61',secondary:'#ff647d',background:'#15100a'}];
  const presets=[
    {id:'starter-party',name:'Icebreaker',type:'party',category:'Selskab',genre:'Samtale & grin',intensity:'Let',board:'dice',themeId:'violet',icon:'⚡',description:'Lær hinanden at kende. Ét kast, én ny historie.',dice:[die('Bryd isen',['Fortæl om din sjoveste ferie','Vis dit skjulte talent','Hvem her ville vinde et talentshow?','Fortæl to sandheder og én løgn','Vælg aftenens temasang','Lav din bedste imitation']),die('Twist',['På 20 sekunder','Med en dramatisk stemme','Som en nyhedsoplæser','Med en medspiller','Uden at bruge hænderne','De andre må stille ét spørgsmål'])]},
    {id:'starter-spin',name:'Neon Challenge',type:'party',category:'Udfordringer',genre:'Performance',intensity:'Høj',board:'slot',themeId:'ice',icon:'★',description:'Små scener, store grin. Lad Lucky Spin vælge.',dice:[die('Udfordring',['Dans i 20 sekunder','Lav en reklame for din sko','Syng en sætning','Opfind et nyt håndtryk','Lav en sejrsdans','Fortæl en vittighed']),die('Stil',['Som en robot','Som en rockstjerne','I slowmotion','Som en detektiv','Som en superhelt','Helt alvorligt']),die('Hold',['Vælg en makker','Alle sammen','Dig alene','Spilleren til venstre','Spilleren til højre','De andre vælger'])]},
    {id:'starter-date',name:'Date Night',type:'erotic',category:'Nærhed',genre:'Romantik',intensity:'Let',board:'wheel',themeId:'crimson',icon:'♡',description:'Nærvær, varme ord og tid til hinanden.',dice:[die('Øjeblik',['Hold i hånd','Giv et kompliment','Dans til jeres sang','Del et godt minde','Et langt kram','Se hinanden i øjnene']),die('Stemning',['Dæmp lyset','Sæt jeres yndlingssang på','Læg telefonerne væk','Planlæg den næste date','Vælg en fælles drøm','Partneren vælger'])]},
    {id:'starter-midnight',name:'Midnight Chemistry',type:'erotic',category:'Flirt',genre:'Date',intensity:'Mellem',board:'dice',themeId:'gold',icon:'☾',description:'Blik, kemi og overraskelser på jeres præmisser.',dice:[die('Kemi',['Hvisk et kompliment','Et langsomt kys','Giv skuldermassage','Fortæl hvad du faldt for','Dans helt tæt','Partneren vælger']),die('Tid',['10 sekunder','20 sekunder','30 sekunder','Et øjeblik','Til sangen slutter','I vælger sammen'])]}
  ].map(p=>{const config=blank();p.dice.forEach((d,i)=>config.dice[i]=d);config.count=p.dice.length;return {...p,config,images:[],builtin:true};});
  window.NeonStudioModel={blank,die,face,normalize,validate,resizeFaces,themes,presets,clone};
})();

