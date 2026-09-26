(function(){
'use strict';
const root=document.documentElement;
const getState=()=>({
  district:String(root.dataset.tggDistrict||'downtown'),
  time:String(root.dataset.tggTime||'day'),
  weather:String(root.dataset.tggWeather||'clear'),
  quality:String(root.dataset.tggGraphicsAdaptiveV55||root.dataset.tggQuality||'high'),
  driving:root.dataset.tggDriving==='1'
});
function install(){
  if(window.TGGWorldLightingV200)return window.TGGWorldLightingV200;
  const THREE=window.THREE,w=window.TGG3D;
  if(!THREE||!w?.scene){root.dataset.tggWorldLightingV200='waiting';return null}
  const scene=w.scene;
  const inst=(name,geo,mat,count,place)=>{
    let mesh=scene.getObjectByName?.(name);
    if(mesh||!THREE.InstancedMesh)return mesh;
    mesh=new THREE.InstancedMesh(geo,mat,count);mesh.name=name;
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<count;i++){place(i,p,q,s);m.compose(p,q,s);mesh.setMatrixAt(i,m)}
    mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh;
  };

  const shadowPatches=inst(
    'TGG_CONTACT_SHADOW_PATCHES_V200',
    new THREE.CircleGeometry(1.25,14),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.18,depthWrite:false}),
    120,
    (i,p,q,s)=>{const a=(i/120)*Math.PI*6,r=42+(i%12)*20;
      p.set(Math.cos(a)*r,.018,Math.sin(a)*r);q.setFromEuler(new THREE.Euler(-Math.PI/2,0,a));
      const sc=.65+(i%5)*.12;s.set(sc,sc*.7,1)}
  );

  const lightPools=inst(
    'TGG_INTERIOR_LIGHT_POOLS_V200',
    new THREE.CircleGeometry(2.8,18),
    new THREE.MeshBasicMaterial({color:0xffd49b,transparent:true,opacity:.14,depthWrite:false}),
    48,
    (i,p,q,s)=>{const side=i%4,step=Math.floor(i/4)-6;let x=0,z=0;
      if(side===0){x=-76;z=step*24}
      if(side===1){x=76;z=step*24}
      if(side===2){x=step*24;z=-76}
      if(side===3){x=step*24;z=76}
      p.set(x,.02,z);q.setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
      const sc=.8+(i%4)*.1;s.set(sc,sc*.72,1)}
  );

  const bounce=inst(
    'TGG_SURFACE_BOUNCE_V200',
    new THREE.PlaneGeometry(4.8,2.6),
    new THREE.MeshBasicMaterial({color:0x7ca8c8,transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}),
    96,
    (i,p,q,s)=>{const side=i%4,step=Math.floor(i/4)-12,d=105+(i%6)*7;let x=0,z=0,r=0;
      if(side===0){x=-d;z=step*15;r=Math.PI/2}
      if(side===1){x=d;z=step*15;r=-Math.PI/2}
      if(side===2){x=step*15;z=-d;r=0}
      if(side===3){x=step*15;z=d;r=Math.PI}
      p.set(x,2.1+(i%3)*.4,z);q.setFromEuler(new THREE.Euler(0,r,0));
      const sc=.82+(i%5)*.06;s.set(sc,.9,1)}
  );

  let fill=scene.getObjectByName?.('TGG_DISTRICT_FILL_V200');
  if(!fill){fill=new THREE.HemisphereLight(0x9fb9d4,0x35312b,0);fill.name='TGG_DISTRICT_FILL_V200';scene.add(fill)}
  let focus=scene.getObjectByName?.('TGG_FOCUS_CONTACT_V200');
  if(!focus){focus=new THREE.PointLight(0xdceeff,0,13,2);focus.name='TGG_FOCUS_CONTACT_V200';scene.add(focus)}

  let avatar=null,lastAvatarScan=0,lastSig='';
  const findAvatar=()=>{
    if(avatar?.parent)return avatar;
    const now=performance.now();if(now-lastAvatarScan<2500)return avatar;lastAvatarScan=now;
    scene.traverse?.(o=>{if(avatar)return;const n=String(o?.name||'').toLowerCase();
      if(/player|avatar|character/.test(n)&&o?.position)avatar=o});
    return avatar;
  };

  const applyTrafficGlow=(night,wet,balanced)=>{
    (w.traffic||[]).forEach(v=>{
      const g=v?.getObjectByName?.('TGG_TRAFFIC_LIGHTS_V83');
      if(!g)return;
      g.visible=!balanced&&(night||wet);
      g.children?.forEach((m,i)=>{if(m.material)m.material.opacity=night?1:wet?.72:.42});
    });
  };

  const apply=()=>{
    const s=getState(),balanced=s.quality==='balanced',night=s.time==='night',gold=s.time==='golden',wet=/rain|storm/.test(s.weather);
    const sig=[s.district,s.time,s.weather,s.quality,s.driving?'1':'0'].join('|');
    if(sig!==lastSig){
      lastSig=sig;
      if(shadowPatches){
        shadowPatches.visible=!balanced;
        shadowPatches.material.opacity=night?.22:wet?.2:.16;
      }
      if(lightPools){
        lightPools.visible=(night||gold||wet)&&!balanced;
        lightPools.material.opacity=night?.24:gold?.15:.12;
        lightPools.material.color.setHex(s.district==='studio'?0xff9ecf:s.district==='media'?0xa7d8ff:s.district==='garage'?0xc5e7ff:0xffd49b);
      }
      if(bounce){
        bounce.visible=!balanced&&s.district!=='park';
        bounce.material.opacity=night?.11:wet?.1:.065;
        bounce.material.color.setHex(s.district==='studio'?0xb78cb4:s.district==='media'?0x83a9cd:s.district==='home'?0xb6a88b:0x7ca8c8);
      }
      fill.intensity=balanced?0:(night?.3:gold?.62:.78);
      fill.color.setHex(night?0x607898:gold?0xc1aa91:0x9fb9d4);
      fill.groundColor.setHex(s.district==='park'?0x2a3c2d:s.district==='home'?0x403b32:0x35312b);
      applyTrafficGlow(night,wet,balanced);
    }

    const target=s.driving?w.car:findAvatar();
    if(target?.position&&!balanced){
      focus.position.set(target.position.x+1.1,target.position.y+1.4,target.position.z+.8);
      focus.intensity=night?.9:wet?.58:.28;
      focus.color.setHex(night?0xaed1ff:wet?0xd6e9f6:0xffddb9);
      root.dataset.tggFocusContactV200=s.driving?'vehicle':'avatar';
    }else{focus.intensity=0;root.dataset.tggFocusContactV200=target?'disabled-balanced':'waiting'}

    root.dataset.tggContactShadowPatchesV200=shadowPatches?'120':'0';
    root.dataset.tggInteriorLightPoolsV200=lightPools?'48':'0';
    root.dataset.tggSurfaceBounceV200=bounce?'96':'0';
    root.dataset.tggTrafficGlowV200='1';
    root.dataset.tggWorldLightingCompositionV200='1';
    root.dataset.tggWorldLightingV200='1';
  };

  const api={apply,version:'200'};
  window.TGGWorldLightingV200=api;apply();return api;
}
window.TGGInstallWorldLightingV200=install;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();