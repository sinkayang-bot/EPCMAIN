// Independent audition bank; selecting a voice does not change tournament settings.
const v=(id,name,kind,base,extra={})=>({id,name,kind,base,...extra});
export const auditionGroups=[
 {key:'start',label:'開始',title:'按開始｜2 秒長音',duration:2,prefix:'A',voices:[
 v('A1','賽場銅鐘','bell',659,{partials:[1,2.01,3.99]}),v('A2','明亮金屬鐘','bell',740,{partials:[1,2.4,3.6]}),v('A3','水晶啟動鐘','bell',880,{partials:[1,2.76,5.4]}),v('A4','低音開賽鑼','gong',330),v('A5','電子開賽音','fm',698,{rate:35,depth:.7}),v('A6','溫暖雙頻長音','dual',523,{second:784}),v('A7','莊重管鐘','organ',440),v('A8','明快合成鐘','fm',830,{rate:170,depth:1.2}),v('A9','柔和木琴延音','wood',784),v('A10','競賽啟動號角','horn',392)]},
 {key:'count',label:'10 秒／5 秒',title:'10 秒與 5 秒｜共用 1 秒提示',duration:1,prefix:'B',voices:[
 v('B1','清亮銅鐘','bell',659,{partials:[1,2.01,3.99]}),v('B2','俐落電子嗶聲','pure',1000),v('B3','短促金屬鐘','bell',740,{partials:[1,2.4,3.6]}),v('B4','清脆玻璃鐘','bell',988,{partials:[1,2.76,5.4]}),v('B5','柔和雙頻提醒','dual',660,{second:880}),v('B6','電子計分台提示','fm',880,{rate:60,depth:.4}),v('B7','高音木琴提醒','wood',1047),v('B8','圓潤短鐘','organ',554),v('B9','明亮數位叮聲','fm',1200,{rate:220,depth:.65}),v('B10','低音警示嗶聲','softsquare',440)]},
 {key:'level',label:'換級別',title:'下一個級別｜2 秒長音',duration:2,prefix:'C',voices:[
 v('C1','金屬長鐘','bell',698,{partials:[1,2.4,3.6]}),v('C2','深厚銅鐘','bell',523,{partials:[1,2.01,3.99]}),v('C3','清亮管鐘','organ',659),v('C4','玻璃長鐘','bell',784,{partials:[1,2.76,5.4]}),v('C5','賽事換級提示','dual',587,{second:880}),v('C6','電子金屬延音','fm',740,{rate:95,depth:1.1}),v('C7','低音圓鑼','gong',277),v('C8','明亮電鐘','softsquare',784),v('C9','柔和長叮聲','wood',880),v('C10','競賽換級號角','horn',466)]},
 {key:'finish',label:'比賽結束',title:'最後結束｜2 秒長音',duration:2,prefix:'D',voices:[
 v('D1','籃球場低音蜂鳴','buzzer',600,{drive:5}),v('D2','高頻電子終場','buzzer',1000,{drive:6}),v('D3','原 G3 電子震動・2 秒版','buzzer',900,{drive:4,rate:85,depth:1.8}),v('D4','雙頻記分板蜂鳴','buzzer',750,{drive:6,second:1125}),v('D5','厚實賽場號角','horn',294),v('D6','低音體育館長鳴','horn',196),v('D7','高音電子震鳴','buzzer',1100,{drive:5,rate:60,depth:.8}),v('D8','金屬終場警鈴','roughbell',880),v('D9','低頻電子震鳴','buzzer',520,{drive:5,rate:70,depth:1.3}),v('D10','雙頻競賽結束音','buzzer',800,{drive:5,second:1067})]}
];
const TAU=Math.PI*2;
export function renderAudition(voice,duration,sampleRate=44100){
 const output=new Float32Array(Math.round(duration*sampleRate));let peak=0;
 for(let n=0;n<output.length;n++){const t=n/sampleRate,p=TAU*voice.base*t;let x;
  switch(voice.kind){
   case 'pure':x=Math.sin(p);break;
   case 'dual':x=.65*Math.sin(p)+.35*Math.sin(TAU*voice.second*t);break;
   case 'softsquare':x=Math.tanh(2.5*Math.sin(p))*.8+.15*Math.sin(p*3);break;
   case 'organ':x=Math.sin(p)+.45*Math.sin(p*2)+.16*Math.sin(p*3)+.08*Math.sin(p*4);break;
   case 'fm':x=Math.sin(p+voice.depth*Math.sin(TAU*voice.rate*t));break;
   case 'horn':x=Math.tanh(2.8*(.65*Math.sin(p)+.25*Math.sin(1.5*p)+.15*Math.sin(2*p)))*(1+.025*Math.sin(TAU*6*t));break;
   case 'buzzer':x=Math.tanh((voice.drive||4)*Math.sin(p+(voice.depth||0)*Math.sin(TAU*(voice.rate||0)*t)));if(voice.second)x=.65*x+.35*Math.tanh((voice.drive||4)*Math.sin(TAU*voice.second*t));break;
   case 'wood':x=(Math.sin(p)*Math.exp(-1.8*t)+.35*Math.sin(p*3)*Math.exp(-5*t)+.13*Math.sin(p*7)*Math.exp(-9*t));break;
   case 'gong':x=Math.sin(p)+.5*Math.sin(p*1.47)*Math.exp(-.6*t)+.35*Math.sin(p*2.09)*Math.exp(-1.5*t)+.16*Math.sin(p*3.91)*Math.exp(-3*t);x*=Math.exp(-.9*t);break;
   case 'roughbell':x=(Math.sin(p)+.5*Math.sin(p*2.4)+.2*Math.sin(p*3.6))*(.75+.25*Math.sin(TAU*45*t));break;
   default:{const r=voice.partials||[1,2,4];x=r.reduce((sum,ratio,i)=>sum+[.7,.23,.1][i]*Math.sin(p*ratio)*Math.exp(-(.8+i*1.1)*t),0)}
  }
  const envelope=Math.min(1,t/.012,(duration-t)/.045);output[n]=x*Math.max(0,envelope);peak=Math.max(peak,Math.abs(output[n]));
 }
 const scale=.78/Math.max(.001,peak);for(let i=0;i<output.length;i++)output[i]*=scale;return output;
}
export function wavBytes(samples,sampleRate=44100){const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer),write=(at,s)=>[...s].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);samples.forEach((s,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,s))*32767),true));return new Uint8Array(buffer)}
