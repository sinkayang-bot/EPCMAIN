// EPC public activity publisher: server-side only (Node.js + firebase-admin).
// Never import this file from a browser. Deploy only in a trusted server environment.
'use strict';
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();
const COLLECTION = 'epc_public_activity';
const ALLOWED = new Set(['hunter','umbrella','extremeTen','weekly','tasks']);
function cleanId(value) {
  const id = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(id)) throw new Error('INVALID_MEMBER_ID');
  return id;
}
function cleanMetric(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const key of ['count','points','rank']) {
    if (input[key] !== undefined) {
      const value = Number(input[key]);
      if (Number.isFinite(value) && value >= 0) out[key] = value;
    }
  }
  for (const key of ['progress','status']) {
    if (typeof input[key] === 'string') out[key] = input[key].slice(0,100);
  }
  return Object.keys(out).length ? out : null;
}
function publicRecord(raw) {
  const activities = {};
  for (const [key,value] of Object.entries(raw.activities || {})) {
    if (!ALLOWED.has(key)) continue;
    const metric = cleanMetric(value);
    if (metric) activities[key] = metric;
  }
  const summary = {};
  for (const key of ['events','entries']) {
    const value = Number(raw.summary?.[key]);
    if (Number.isSafeInteger(value) && value >= 0) summary[key] = value;
  }
  return {version:1,summary,activities,updatedAt:admin.firestore.FieldValue.serverTimestamp()};
}
async function publishPublicActivities(records) {
  if (!Array.isArray(records)) throw new Error('EXPECTED_ARRAY');
  let batch = firestore.batch(), count = 0, published = 0;
  for (const raw of records) {
    const id = cleanId(raw.memberId);
    batch.set(firestore.collection(COLLECTION).doc(id),publicRecord(raw));
    count++; published++;
    if (count === 400) { await batch.commit(); batch=firestore.batch(); count=0; }
  }
  if (count) await batch.commit();
  return {published};
}
module.exports={publishPublicActivities,publicRecord,cleanId};
