import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAvailability} from '../../../tools/audit-catalog-availability.mjs';

test('every shipped catalog entry and variant has playable visual stages in both JB2A editions',async()=>{
 const report=await auditAvailability();
 assert.equal(report.missing.length,0,report.missing.slice(0,20).map(s=>`${s.system}/${s.kind}: ${s.name}: ${s.reason}`).join('\n'));
 assert.deepEqual(report.missingFiles,[]);
 for(const [kind,counts] of Object.entries(report.summary)){
  assert.ok(counts.entries>0,kind);
  assert.equal(counts.ready,counts.entries,kind);
  assert.equal(counts.unconfigured,0,kind);
  assert.equal(counts.broken,0,kind);
 }
});
