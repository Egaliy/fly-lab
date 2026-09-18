import * as T from 'three';
export function createFly(){
 const fly=new T.Group();fly.name='Drosophila_melanogaster_female';
 function pivot(name,point,objects){const group=new T.Group();group.name=name;group.position.set(...point);fly.add(group);fly.updateMatrixWorld(true);for(const object of objects)group.attach(object);return group;}
 const amber=new T.MeshPhysicalMaterial({color:0x795026,roughness:.48});
 const dark=new T.MeshStandardMaterial({color:0x21170f,roughness:.6});
 const eye=new T.MeshPhysicalMaterial({color:0x980d08,roughness:.24,clearcoat:1,clearcoatRoughness:.13});
 const vein=new T.MeshStandardMaterial({color:0x7a7864,transparent:true,opacity:.62,roughness:.4});
 const wingMat=new T.MeshPhysicalMaterial({color:0xc9deed,transparent:true,opacity:.18,roughness:.2,metalness:.15,side:T.DoubleSide,depthWrite:false});
 function ell(name,p,s,mat,parent=fly){let m=new T.Mesh(new T.SphereGeometry(1,40,24),mat);m.name=name;m.position.set(...p);m.scale.set(...s);parent.add(m);return m;}
 function rod(name,a,b,r,mat,parent=fly,r2=r*.6){let av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);let m=new T.Mesh(new T.CylinderGeometry(r2,r,d.length(),6),mat);m.name=name;m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());parent.add(m);return m;}
 function path(name,points,r,mat,parent=fly){let curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));let m=new T.Mesh(new T.TubeGeometry(curve,32,r,5,false),mat);m.name=name;parent.add(m);}
 ell('Thorax',[-.12,.99,0],[.53,.43,.37],amber);
 ell('Head',[-.79,1.02,0],[.35,.34,.32],amber);
 // Tapered abdomen with female band pattern.
 const pos=[],idx=[];let rings=42,n=56;
 for(let i=0;i<=rings;i++){let u=i/rings,x=.16+1.36*u,rad=.38*Math.pow(Math.sin(Math.PI*(.17+.83*u)),.7);for(let j=0;j<=n;j++){let t=j/n*Math.PI*2;pos.push(x,.86+rad*Math.cos(t)*.86,rad*Math.sin(t));}}
 for(let i=0;i<rings;i++)for(let j=0;j<n;j++){let a=i*(n+1)+j;idx.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
 for(let i=0;i<rings;i++)geo.addGroup(i*n*6,n*6,(i%7>=5)?1:0);
 let abdomen=new T.Mesh(geo,[amber,dark]);abdomen.name='Banded_tapered_abdomen';fly.add(abdomen);
 for(let side of [-1,1]){
 let center=new T.Vector3(-.86,1.09,side*.246);let base=ell('Compound_eye',center.toArray(),[.235,.274,.152],eye);
 // Separate convex ommatidia arranged on an ellipsoid surface.
 const fg=new T.SphereGeometry(1,6,4);let facets=[];
 for(let row=-11;row<=11;row++){let lat=row*.112;let ct=Math.cos(lat);let count=Math.max(5,Math.round(32*ct));for(let j=0;j<count;j++){let lon=-Math.PI/2+(j+.5*(row%2))/count*Math.PI;let v=new T.Vector3(Math.sin(lon)*ct,Math.sin(lat),side*Math.cos(lon)*ct);facets.push(v);}}
 let inst=new T.InstancedMesh(fg,eye,facets.length);inst.name='Individual_ommatidia';let dummy=new T.Object3D();facets.forEach((v,i)=>{dummy.position.copy(center).add(new T.Vector3(v.x*.237,v.y*.276,v.z*.154));let normal=new T.Vector3(v.x/.237,v.y/.276,v.z/.154).normalize();dummy.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);dummy.scale.set(.0125,.0125,.006);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});fly.add(inst);
 const antennaStart=fly.children.length;
 ell('Antenna_pedicel',[-1.095,1.11,side*.09],[.085,.052,.055],amber);
 ell('Antenna_funiculus',[-1.17,1.105,side*.1],[.07,.04,.035],dark);
 rod('Arista',[-1.15,1.13,side*.1],[-1.30,1.40,side*.17],.006,dark);
 for(let k=0;k<7;k++){let t=k/7;rod('Arista_branch',[-1.15-.15*t,1.13+.27*t,side*(.1+.07*t)],[-1.25-.15*t,1.16+.27*t,side*(.12+.09*t)],.0025,dark);}
 pivot('Antenna_'+side,[-1.095,1.11,side*.09],fly.children.slice(antennaStart));
 for(let k=0;k<3;k++){
 let x=-.45+k*.36;
 let a=[x,.82,side*.24],b=[x+(k-1)*.34,.56,side*(.55+k*.07)],c=[x+(k-1)*.52,.13,side*(.81+k*.08)],d=[x+(k-1)*.67-.12,.025,side*(.91+k*.08)];
 const coxa=rod('Coxa',a,b,.035,amber),tibia=rod('Tibia',b,c,.019,amber),tarsus=rod('Tarsus',c,d,.009,dark);
 const bristleStart=fly.children.length;
 for(let j=1;j<=4;j++){let t=j/5;rod('Leg_bristle',[b[0]*(1-t)+c[0]*t,b[1]*(1-t)+c[1]*t,b[2]*(1-t)+c[2]*t],[b[0]*(1-t)+c[0]*t+.06,b[1]*(1-t)+c[1]*t+.025,b[2]*(1-t)+c[2]*t+side*.04],.003,dark);}
 const ankle=pivot('Ankle_'+side+'_'+k,c,[tarsus]);
 const knee=pivot('Knee_'+side+'_'+k,b,[tibia,...fly.children.slice(bristleStart).filter(o=>o.name==='Leg_bristle'),ankle]);
 pivot('Hip_'+side+'_'+k,a,[coxa,knee]);
 }
 let wing=new T.Group();wing.name='Wing_'+side;wing.position.set(-.12,1.28,side*.2);wing.rotation.y=side*-.12;fly.add(wing);
 let outline=[[0,0,0],[.35,.025,side*.20],[1.15,-.055,side*.32],[1.93,-.18,side*.22],[2.08,-.24,side*.08],[1.85,-.25,side*-.06],[.60,-.13,side*-.10],[0,0,0]];
 let curve=new T.CatmullRomCurve3(outline.map(p=>new T.Vector3(...p)),true);let edge=curve.getPoints(90);let verts=[.92,-.10,side*.08];edge.forEach(v=>verts.push(...v.toArray()));let wi=[];for(let i=1;i<edge.length;i++)wi.push(0,i,i+1);let wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(verts,3));wg.setIndex(wi);wg.computeVertexNormals();let wm=new T.Mesh(wg,wingMat);wm.name='Wing_membrane';wing.add(wm);
 path('Costa',edge.map(v=>v.toArray()),.006,vein,wing);
 for(let j=0;j<4;j++)path('Longitudinal_vein',[[0,0,0],[.55,-.018-j*.024,side*(.16-j*.075)],[1.25,-.09-j*.03,side*(.26-j*.09)],[1.94,-.21,side*(.18-j*.063)]],.004,vein,wing);
 path('Crossvein',[[.70,-.038,side*.20],[.77,-.086,side*.05],[.81,-.115,side*-.06]],.004,vein,wing);
 rod('Haltere_stalk',[.21,.97,side*.32],[.31,1.06,side*.47],.012,amber);ell('Haltere_knob',[.31,1.06,side*.47],[.044,.047,.039],amber);
 }
 let seed=9;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
 for(let i=0;i<160;i++){let t=rand()*Math.PI*2,y=rand()*1.7-.6;let rr=Math.sqrt(1-y*y);let v=new T.Vector3(rr*Math.cos(t),y,rr*Math.sin(t));let a=new T.Vector3(-.12+v.x*.53,.99+v.y*.43,v.z*.37);let b=a.clone().add(v.multiplyScalar(.045+rand()*.09));rod('Thoracic_seta',a.toArray(),b.toArray(),.0035,dark);}
 ell('Proboscis',[-1.03,.80,0],[.10,.10,.07],amber);
 const headNames=new Set(['Head','Compound_eye','Individual_ommatidia','Proboscis','Antenna_-1','Antenna_1']);
 pivot('Head_pivot',[-.58,1.02,0],fly.children.filter(o=>headNames.has(o.name)));
 pivot('Abdomen_pivot',[.16,.86,0],[abdomen]);
 fly.userData={species:'Drosophila melanogaster',sex:'female',units:'millimeters',note:'Procedural anatomical approximation; not a scientific reference specimen'};
 return fly;
}
