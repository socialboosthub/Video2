const assert = require('assert');
const { execFileSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const port = 3137;
const child = spawn(process.execPath, ['server.js'], {cwd:dir, env:{...process.env,PORT:String(port)}, stdio:['ignore','pipe','pipe']});
function get(url){return new Promise((resolve,reject)=>{http.get(url,r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}));}).on('error',reject)})}
function post(url,body){return new Promise((resolve,reject)=>{const data=JSON.stringify(body);const req=http.request(url,{method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},r=>{let b='';r.on('data',x=>b+=x);r.on('end',()=>resolve({status:r.statusCode,body:b}));});req.on('error',reject);req.write(data);req.end()})}
(async()=>{try{await new Promise(r=>setTimeout(r,700));let h=await get(`http://127.0.0.1:${port}/api/health`);assert.equal(h.status,200);assert.equal(JSON.parse(h.body).ok,true);let p=await post(`http://127.0.0.1:${port}/api/director/plan`,{screenplay:'SCENE 1 — TEST\nLOCATION:\nA village.\nACTION:\nA man walks.\nDIALOGUE:\nELIAS: "Hello."\nEMOTION:\nCalm.',episodes:6,targetLength:240,format:'9:16'});let d=JSON.parse(p.body);assert.equal(p.status,200);assert.equal(d.validation.explicitScenes,1);assert.ok(d.validation.shots>=2);let missing=await get(`http://127.0.0.1:${port}/api/not-real`);assert.equal(missing.status,404);assert.equal(JSON.parse(missing.body).ok,false);console.log('AHM smoke test passed.');process.exitCode=0}catch(e){console.error(e);process.exitCode=1}finally{child.kill('SIGTERM')}})();
