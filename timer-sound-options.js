// Audition presets are shared code so a chosen voice can be used unchanged.
const bell=(id,name,base,ratios,duration,strikes=1)=>({id,name,base,ratios,duration,strikes,gap:.6,type:'sine'});
export const soundGroups=[
 {key:'ten',title:'10 秒｜短音一聲',options:[bell('A1','清亮銅鐘',659.25,[1,2.01,3.99],.5),bell('A2','玻璃輕鐘',783.99,[1,2.76,5.4],.55),bell('A3','金屬短鐘',698.46,[1,2.4,3.6],.5),bell('A4','明亮叮聲',880,[1,2,3],.4),bell('A5','柔和小鐘',739.99,[1,1.5,3],.6)]},
 {key:'five',title:'5 秒｜短音兩聲',options:[bell('B1','雙響銅鐘',659.25,[1,2.01,3.99],.4,2),bell('B2','雙響玻璃鐘',783.99,[1,2.76,5.4],.45,2),bell('B3','雙響金屬鐘',698.46,[1,2.4,3.6],.4,2),bell('B4','雙響叮聲',880,[1,2,3],.35,2),bell('B5','雙響柔和鐘',739.99,[1,1.5,3],.45,2)]},
 {key:'level',title:'換級別｜長音一聲',options:[bell('C1','銅鐘長鳴',659.25,[1,2.01,3.99],2.8),bell('C2','玻璃鐘長鳴',783.99,[1,2.76,5.4],2.8),bell('C3','金屬鐘長鳴',698.46,[1,2.4,3.6],2.8),bell('C4','明亮長鐘',880,[1,2,3],2.6),bell('C5','柔和長鐘',739.99,[1,1.5,3],3)]},
 {key:'end',title:'最後結束｜緊急警報 2 秒',options:[
 {id:'E1',name:'出動長鳴',base:520,type:'triangle',duration:2,strikes:1,emergency:'wail'},
 {id:'E2',name:'急促出勤',base:650,type:'sawtooth',duration:2,strikes:1,emergency:'yelp'},
 {id:'E3',name:'高低警笛',base:780,type:'square',duration:2,strikes:1,emergency:'hilo'},
 {id:'E4',name:'緊急升頻',base:550,type:'sawtooth',duration:2,strikes:1,emergency:'rise'},
 {id:'E5',name:'科幻出動',base:950,type:'triangle',duration:2,strikes:1,emergency:'dispatch'}
 ]}
];
export const selectedTimerVoices={
 ten:soundGroups[0].options[0],five:soundGroups[0].options[0],level:soundGroups[2].options[2]
};
function scheduleEmergency(context,voice,volume){
 const start=context.currentTime+.025,end=start+2,osc=context.createOscillator(),gain=context.createGain(),nodes=[osc];
 osc.type=voice.type;osc.frequency.setValueAtTime(voice.base,start);
 if(voice.emergency==='wail')for(let i=1;i<=4;i++)osc.frequency.linearRampToValueAtTime(i%2?1150:520,start+i*.5);
 if(voice.emergency==='yelp')for(let i=1;i<=12;i++)osc.frequency.linearRampToValueAtTime(i%2?1300:650,start+i/6);
 if(voice.emergency==='hilo')for(let i=1;i<8;i++)osc.frequency.setValueAtTime(i%2?1040:780,start+i*.25);
 if(voice.emergency==='rise')osc.frequency.exponentialRampToValueAtTime(1500,end);
 if(voice.emergency==='dispatch'){
  const lfo=context.createOscillator(),depth=context.createGain();lfo.type='sine';lfo.frequency.value=8;depth.gain.value=220;lfo.connect(depth);depth.connect(osc.frequency);lfo.start(start);lfo.stop(end);nodes.push(lfo);
 }
 const peak=(voice.type==='square'||voice.type==='sawtooth'?.18:.38)*volume;
 gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,start+.015);gain.gain.setValueAtTime(peak,end-.08);gain.gain.exponentialRampToValueAtTime(.001,end);
 osc.connect(gain);gain.connect(context.destination);osc.start(start);osc.stop(end);
 return {nodes,duration:2.05};
}
export function scheduleVoice(context,voice,volume=.75){
 if(voice.emergency)return scheduleEmergency(context,voice,volume);
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
