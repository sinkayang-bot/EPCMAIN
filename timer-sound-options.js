// Audition presets are shared code so a chosen voice can be used unchanged.
const bell=(id,name,base,ratios,duration,strikes=1)=>({id,name,base,ratios,duration,strikes,gap:.6,type:'sine'});
export const soundGroups=[
 {key:'ten',title:'10 秒｜短音一聲',options:[bell('A1','清亮銅鐘',659.25,[1,2.01,3.99],.5),bell('A2','玻璃輕鐘',783.99,[1,2.76,5.4],.55),bell('A3','金屬短鐘',698.46,[1,2.4,3.6],.5),bell('A4','明亮叮聲',880,[1,2,3],.4),bell('A5','柔和小鐘',739.99,[1,1.5,3],.6)]},
 {key:'five',title:'5 秒｜短音兩聲',options:[bell('B1','雙響銅鐘',659.25,[1,2.01,3.99],.4,2),bell('B2','雙響玻璃鐘',783.99,[1,2.76,5.4],.45,2),bell('B3','雙響金屬鐘',698.46,[1,2.4,3.6],.4,2),bell('B4','雙響叮聲',880,[1,2,3],.35,2),bell('B5','雙響柔和鐘',739.99,[1,1.5,3],.45,2)]},
 {key:'level',title:'換級別｜長音一聲',options:[bell('C1','銅鐘長鳴',659.25,[1,2.01,3.99],2.8),bell('C2','玻璃鐘長鳴',783.99,[1,2.76,5.4],2.8),bell('C3','金屬鐘長鳴',698.46,[1,2.4,3.6],2.8),bell('C4','明亮長鐘',880,[1,2,3],2.6),bell('C5','柔和長鐘',739.99,[1,1.5,3],3)]},
 {key:'end',title:'最後結束｜單次長警報',options:[
 {id:'D1',name:'平穩警報',base:739.99,ratios:[1,2],type:'triangle',duration:3,strikes:1,alarm:true},
 {id:'D2',name:'金屬警報',base:659.25,ratios:[1],type:'sawtooth',duration:3,strikes:1,alarm:true,vibrato:12},
 {id:'D3',name:'雙頻長鳴',base:880,ratios:[1,1.008],type:'sine',duration:3,strikes:1,alarm:true},
 {id:'D4',name:'上揚長警報',base:659.25,ratios:[1,2.005],type:'sine',duration:3,strikes:1,alarm:true,sweep:1.333333},
 {id:'D5',name:'醒目長警報',base:698.46,ratios:[1],type:'square',duration:3,strikes:1,alarm:true,vibrato:8}
 ]}
];
export function scheduleVoice(context,voice,volume=.75){
 const nodes=[],start=context.currentTime+.025;
 for(let i=0;i<voice.strikes;i++)for(let j=0;j<voice.ratios.length;j++){
  const at=start+i*(voice.gap||0),osc=context.createOscillator(),gain=context.createGain();
  const end=at+voice.duration*(voice.alarm?1:[1,.7,.4][j]);
  const peak=(voice.alarm?(voice.type==='square'||voice.type==='sawtooth'?.12:.25):[.52,.17,.07][j])*volume;
  osc.type=voice.type;osc.frequency.setValueAtTime(voice.base*voice.ratios[j],at);
  if(voice.sweep)osc.frequency.linearRampToValueAtTime(voice.base*voice.ratios[j]*voice.sweep,end-.3);
  gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+.012);
  if(voice.alarm)gain.gain.setValueAtTime(peak,end-.25);
  gain.gain.exponentialRampToValueAtTime(.001,end);
  osc.connect(gain);gain.connect(context.destination);osc.start(at);osc.stop(end+.04);nodes.push(osc);
  if(voice.vibrato){const lfo=context.createOscillator(),depth=context.createGain();lfo.frequency.value=5;depth.gain.value=voice.vibrato;lfo.connect(depth);depth.connect(osc.frequency);lfo.start(at);lfo.stop(end+.04);nodes.push(lfo);}
 }
 return {nodes,duration:voice.duration+(voice.strikes-1)*(voice.gap||0)+.1};
}
