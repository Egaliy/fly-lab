import * as T from 'three';

export const motionPresets=[
  {id:'idle',label:'Наблюдает',duration:8},
  {id:'groom',label:'Чистит усики',duration:6},
  {id:'wings',label:'Разминает крылья',duration:5},
  {id:'steps',label:'Переступает',duration:4}
];

// Baked, looping keyframes shared by the viewer and the GLB export.
export function createMotionClips(fly){
 const names=['Head_pivot','Abdomen_pivot'];
 for(const side of [-1,1]){
  names.push('Antenna_'+side,'Wing_'+side);
  for(let k=0;k<3;k++)names.push('Hip_'+side+'_'+k,'Knee_'+side+'_'+k,'Ankle_'+side+'_'+k);
 }
 return motionPresets.map(preset=>{
  const times=[],values=Object.fromEntries(names.map(n=>[n,[]]));
  const samples=preset.duration*30;
  const q=new T.Quaternion(),e=new T.Euler();
  for(let frame=0;frame<=samples;frame++){
   const phase=frame/samples*Math.PI*2;
   times.push(frame/30);
   const angles=Object.fromEntries(names.map(n=>[n,[0,0,0]]));
   const envelope=Math.pow(Math.sin(phase/2),2);
   angles.Head_pivot=[.018*Math.sin(phase*2),.055*Math.sin(phase),.025*Math.sin(phase*2)];
   angles.Abdomen_pivot=[0,.012*Math.sin(phase),.018*Math.sin(phase*2)];
   for(const side of [-1,1]){
    angles['Wing_'+side]=[0,side*-.12,0];
    angles['Antenna_'+side]=[side*.06*Math.sin(phase*3),.08*Math.sin(phase*2+side*.5),.04*Math.sin(phase*4)];
    if(preset.id==='groom'){
     const rub=Math.sin(phase*8);
     angles['Hip_'+side+'_0']=[side*(.75+.08*rub)*envelope,side*.15*envelope,-1.10*envelope];
     angles['Knee_'+side+'_0']=[0,side*.16*envelope,(-.45+.16*rub)*envelope];
     angles['Ankle_'+side+'_0']=[0,side*.12*rub*envelope,-.25*envelope];
     angles.Head_pivot[2]=-.09*envelope;
     angles['Antenna_'+side][2]+=.12*envelope*Math.sin(phase*8);
    }
    if(preset.id==='wings'){
     const flutter=.5+.5*Math.sin(phase*12);
     angles['Wing_'+side]=[side*.1*envelope,side*(-.12-.7*envelope),(.12+.18*flutter)*envelope];
     angles.Abdomen_pivot[2]=.035*Math.sin(phase*4);
    }
    if(preset.id==='steps')for(let k=0;k<3;k++){
     // Alternating tripod, lifting only: no forward sliding or root translation.
     const offset=(k%2===0?0:Math.PI)+(side===1?Math.PI:0);
     const lift=Math.pow(Math.max(0,Math.sin(phase*2+offset)),2);
     angles['Hip_'+side+'_'+k]=[-side*.26*lift,0,0];
     angles['Knee_'+side+'_'+k]=[side*.15*lift,0,(k-1)*.15*lift];
     angles['Ankle_'+side+'_'+k]=[side*.08*lift,0,(1-k)*.08*lift];
    }
   }
   for(const name of names){e.set(...angles[name]);q.setFromEuler(e);values[name].push(q.x,q.y,q.z,q.w);}
  }
  const tracks=names.map(name=>new T.QuaternionKeyframeTrack(fly.getObjectByName(name).name+'.quaternion',times,values[name]));
  return new T.AnimationClip(preset.id,preset.duration,tracks);
 });
}

export function createMotionPlayer(fly){
 const clips=createMotionClips(fly),mixer=new T.AnimationMixer(fly);
 const actions=new Map(clips.map(clip=>[clip.name,mixer.clipAction(clip)]));
 let active=null,paused=false;
 return {
  clips,mixer,
  select(id){const next=actions.get(id);if(!next||next===active)return;next.reset().setEffectiveWeight(1).play();if(active)active.crossFadeTo(next,.5,false);active=next;},
  update(dt){if(!paused)mixer.update(Math.min(dt,.05));},
  setPaused(value){paused=value;},
  get paused(){return paused;},
  get current(){return active?.getClip().name;}
 };
}
