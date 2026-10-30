const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
if(!isMainThread){(async()=>{const buffer=Buffer.from(workerData.buffer);let text;
if(workerData.kind==='pdf'){const {PDFParse}=require('pdf-parse');const parser=new PDFParse({data:buffer});try{const info=await parser.getInfo();if(info.total>100)throw Error('Massimo 100 pagine.');text=(await parser.getText()).text;}finally{await parser.destroy();}}
else{text=(await require('mammoth').extractRawText({buffer})).value;}
if(text.length>200000)throw Error('Testo troppo lungo: massimo 200.000 caratteri.');parentPort.postMessage({text});})().catch(()=>parentPort.postMessage({error:'Documento non leggibile, protetto o troppo grande. Usa un PDF con testo o un DOCX valido.'}));}
module.exports=function extract(buffer,name){
const kind=/\.pdf$/i.test(name)?'pdf':/\.docx$/i.test(name)?'docx':null;
if(!kind||buffer.length>10*1024*1024)throw Error('Carica PDF o DOCX, massimo 10 MB.');
if(kind==='pdf'&&buffer.subarray(0,5).toString()!=='%PDF-'||kind==='docx'&&buffer.subarray(0,2).toString()!=='PK')throw Error('Il contenuto non corrisponde al formato del documento.');
return new Promise((resolve,reject)=>{const worker=new Worker(__filename,{workerData:{buffer,kind},resourceLimits:{maxOldGenerationSizeMb:128}});const timer=setTimeout(()=>{worker.terminate();reject(Error('Analisi scaduta. Prova un documento più piccolo o incolla il testo.'));},20000);worker.once('message',r=>{clearTimeout(timer);worker.terminate();r.error?reject(Error(r.error)):resolve(r.text);});worker.once('error',()=>{clearTimeout(timer);reject(Error('Analisi non riuscita. Incolla il testo del regolamento.'));});worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error('Analisi interrotta.'));});});
};
