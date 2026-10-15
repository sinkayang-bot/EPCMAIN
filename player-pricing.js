export function calcPlayerForEvent(p,e){
 let buyin=(+p.buyin||0), rebuy=(+p.rebuy||0), addon=(+p.addon||0);
 let groups=buyin+rebuy+addon;
 const earlyDiscount=groups>0&&p.earlyBird?Math.max(0,+e.earlyBirdDiscount||0):0;
 const lateDiscount=groups>0&&p.lateBird?Math.max(0,+e.lateBirdDiscount||0):0;
 const ladiesDiscount=groups>0&&p.ladies?Math.max(0,Number(e.ladiesDiscount??Math.floor(Number((e.pricingMode==='custom'?e.buyinAdmin:e.admin)||0)/2))):0;
 const birdDiscount=earlyDiscount+lateDiscount;
 let manual=(+p.manualDiscount||0)+birdDiscount+ladiesDiscount;

 if((e.pricingMode||'standard')==='custom'){
   let buyinTotal=(+e.buyinTotal||0), buyinAdmin=(+e.buyinAdmin||0);
   let rebuyTotal=(+e.rebuyTotal||0), rebuyAdmin=(+e.rebuyAdmin||0);
   let threshold=Math.max(1,Math.floor(+e.overbuyThreshold||10));

   let normalRebuyGroups=Math.max(0,Math.min(groups,threshold)-1);
   let overbuyGroups=Math.max(0,groups-threshold);
   let allRebuyGroups=Math.max(0,groups-1);

   // Split custom-mode discounts by purpose:
   // normal rebuy groups (up to threshold) = rebuy discount;
   // groups over threshold = full waived rebuy admin, shown entirely as overbuy discount.
   // This keeps the same total discount/paid amount while making the two columns meaningful.
   let rebuyDiscountPerGroup=Math.max(0,buyinTotal-rebuyTotal);
   let rebuyDiscount=rebuyDiscountPerGroup*normalRebuyGroups;

   // Player/event page: overbuy shows only the extra discount versus the normal rebuy
   // price (e.g. 400 per group), so staff can see the player's payable-price discount.
   let overbuyDiscountPerGroup=Math.max(0,buyinAdmin-rebuyAdmin);
   // If rebuyAdmin itself is the discounted admin amount (e.g. 400 from original 800),
   // the extra waiver to reach zero is that remaining rebuyAdmin amount.
   if(overbuyDiscountPerGroup===0 || overbuyDiscountPerGroup>rebuyAdmin) overbuyDiscountPerGroup=rebuyAdmin;
   let overbuyDiscount=overbuyDiscountPerGroup*overbuyGroups;

   // Accounting: restore the full original admin waiver for overbuy groups (e.g. 800).
   let accountingGroupDiscount=buyinAdmin*overbuyGroups;
   let accountingRebuyDiscount=rebuyDiscount;

   let auto=rebuyDiscount+overbuyDiscount;
   let totalDiscount=auto+manual;

   // Player paid amount must still reflect the FULL overbuy waiver, not only the display split.
   let original=Math.max(0,groups*buyinTotal);
   let accountingAuto=rebuyDiscount+accountingGroupDiscount;
   let paid=Math.max(0,original-accountingAuto-manual);

   // Prize-pool contribution is the non-admin portion of the standard first buy-in.
   let poolPerGroup=Math.max(0,buyinTotal-buyinAdmin);
   let pool=Math.max(0,groups*poolPerGroup);
   let grossAdmin=Math.max(0,groups*buyinAdmin);
   let netAdmin=Math.max(0,grossAdmin-rebuyDiscount-accountingGroupDiscount-manual);

   return {
     groups, auto, manual, earlyDiscount,lateDiscount,birdDiscount,ladiesDiscount, totalDiscount, original, paid, pool,
     grossAdmin, netAdmin,
     rebuyDiscount, overbuyDiscount, accountingRebuyDiscount, accountingGroupDiscount, normalRebuyGroups, overbuyGroups
   };
 }

 let base=groups*((+e.poolUnit||0)+(+e.admin||0));
 let halfPriceGroups=Math.max(0,Math.min(groups,10)-1);
 let freeAdminGroups=Math.max(0,groups-10);
 let rebuyDiscount=halfPriceGroups*(+e.admin||0)*0.5;
 // Player/event page shows the incremental overbuy benefit versus the normal
 // half-admin rebuy price. Accounting still records the full waived admin.
 let overbuyDiscount=freeAdminGroups*(+e.admin||0)*0.5;
 let accountingGroupDiscount=freeAdminGroups*(+e.admin||0);
 let auto=rebuyDiscount+overbuyDiscount;
 let disc=auto+manual;
 let accountingDisc=rebuyDiscount+accountingGroupDiscount+manual;
 let grossAdmin=groups*(+e.admin||0);
 return {
   groups, auto, manual, earlyDiscount,lateDiscount,birdDiscount,ladiesDiscount, totalDiscount:disc,
   original:base, paid:Math.max(0,base-accountingDisc),
   pool:groups*(+e.poolUnit||0),
   grossAdmin, netAdmin:Math.max(0,grossAdmin-accountingDisc),
   rebuyDiscount, overbuyDiscount,
   accountingRebuyDiscount:rebuyDiscount,
   accountingGroupDiscount,
   normalRebuyGroups:halfPriceGroups,
   overbuyGroups:freeAdminGroups
 };
}


export function fromRawEvent(raw){return {...raw,poolUnit:raw.buyin,admin:raw.fee,jp:raw.jpRate,overbuyThreshold:Math.max(1,Number(raw.freeAdminFrom||11)-1)};}
export function pricePlayer(raw,p){return calcPlayerForEvent(p,fromRawEvent(raw));}
export function registrationPrice(raw,groups,bird,ladies,manual){
 if(!Number.isSafeInteger(groups)||groups<1||groups>100||!Number.isSafeInteger(manual)||manual<0)throw Error('組數須為 1～100；優惠須為非負整數');
 const p={buyin:groups,rebuy:0,addon:0,earlyBird:bird==='early',lateBird:bird==='late',ladies:!!ladies,manualDiscount:manual};
 const cost=pricePlayer(raw,p),base=pricePlayer(raw,{...p,earlyBird:false,lateBird:false,ladies:false,manualDiscount:0});
 if(cost.manual>base.paid)throw Error('優惠不能超過買入金額');return {p,...cost};
}
export function rebuyPrice(raw,p,groups,manual,ladies){
 if(!p)throw Error('請先選擇玩家');
 if(!Number.isSafeInteger(groups)||groups<1||groups>100||!Number.isSafeInteger(manual)||manual<0)throw Error('重買須為 1～100 組；優惠須為非負整數');
 const before=pricePlayer(raw,p),after=pricePlayer(raw,{...p,rebuy:Number(p.rebuy||0)+groups,manualDiscount:Number(p.manualDiscount||0)+manual,ladies:!!p.ladies||!!ladies});
 const amount=after.paid-before.paid;if(amount<0)throw Error('本次優惠不能超過重買金額');return {amount,before,after};
}
