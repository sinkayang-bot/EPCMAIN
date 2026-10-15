import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pricePlayer,fromRawEvent,registrationPrice,rebuyPrice} from '../player-pricing.js';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),context={};vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function calcPlayerForEvent('),html.indexOf('function memberHistoryInRange(')),context);
for(const pricingMode of ['standard','custom'])for(const groups of [0,1,2,10,11,12])for(const ladies of [false,true])for(const bird of ['none','early','late']){
 const raw={buyin:3000,fee:400,pricingMode,buyinTotal:3800,buyinAdmin:800,rebuyTotal:3400,rebuyAdmin:400,freeAdminFrom:11,earlyBirdDiscount:100,lateBirdDiscount:200,ladiesDiscount:200};
 const p={buyin:groups?1:0,rebuy:Math.max(0,groups-1),addon:0,earlyBird:bird==='early',lateBird:bird==='late',ladies,manualDiscount:50};
 assert.equal(JSON.stringify(pricePlayer(raw,p)),JSON.stringify(context.calcPlayerForEvent(p,fromRawEvent(raw))));
}
const raw={buyin:3000,fee:400,buyinTotal:3400,buyinAdmin:400,earlyBirdDiscount:100};
assert.equal(registrationPrice(raw,2,'early',true,0).paid,6300);
assert.equal(rebuyPrice(raw,{buyin:1,rebuy:0,ladies:true},1,0,true).amount,3200);
assert.throws(()=>rebuyPrice(raw,{buyin:1,rebuy:0},1,9999,false),/優惠不能超過/);
console.log('PASS: shared phone pricing matches desktop across standard/custom, bird/ladies discounts and overbuy thresholds.');
