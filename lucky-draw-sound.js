(function(root){
'use strict';let context=null,muted=false,lastTick=0;try{muted=localStorage.getItem('epcLuckyMuted')==='1'}catch(_){}
function unlock(){try{const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return;if(!context)context=new Audio();if(context.state==='suspended')context.resume().catch(()=>{})}catch(_){}}
function tone(hz,length,volume,offset=0){if(muted||context?.state!=='running')return;const start=context.currentTime+offset,o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.004);g.gain.exponentialRampToValueAtTime(.0001,start+length);o.connect(g);g.connect(context.destination);o.start(start);o.stop(start+length+.02)}
root.EPCLuckySound={unlock,tick(){const now=Date.now();if(now-lastTick<35)return;lastTick=now;tone(720,.035,.06)},win(){tone(523.25,.22,.13);tone(659.25,.24,.13,.12);tone(783.99,.55,.16,.26)},isMuted:()=>muted,toggle(){muted=!muted;try{localStorage.setItem('epcLuckyMuted',muted?'1':'0')}catch(_){}unlock();return muted}};
})(window);
