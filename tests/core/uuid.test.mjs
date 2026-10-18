import test from 'node:test';
import assert from 'node:assert/strict';
import {uuid} from '../../scripts/core/uuid.mjs';

test('uuid works on insecure pages (plain http on an IP), where crypto.randomUUID does not exist',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto'),real=globalThis.crypto;
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:array=>real.getRandomValues(array)}});
 try{
  const ids=new Set(Array.from({length:200},uuid));
  assert.equal(ids.size,200,'unique');
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 }finally{Object.defineProperty(globalThis,'crypto',descriptor);}
 assert.match(uuid(),/^[0-9a-f-]{36}$/,'secure pages use the native randomUUID');
});
test('no Animater script calls crypto.randomUUID directly (it throws for players on http, killing the module)',async()=>{
 const {readdir,readFile}=await import('node:fs/promises');
 const dir=new URL('../../scripts/',import.meta.url);
 for(const name of (await readdir(dir)).filter(n=>n.endsWith('.mjs')&&n!=='uuid.mjs'))
  assert.doesNotMatch(await readFile(new URL(name,dir),'utf8'),/randomUUID/,name);
});
