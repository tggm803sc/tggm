(function(){
'use strict';
const root=document.documentElement;
const state=()=>({
  district:String(root.dataset.tggDistrict||'downtown'),
  time:String(root.dataset.tggTime||'day'),
  weather:String(root.dataset.tggWeather||'clear'),
  quality:String(root.dataset.tggGraphicsAdaptiveV55||root.dataset.tggQuality||'high'),
  driving:root.dataset.tggDriving==='1'
});
function install(){
  if(window.TGGWorldContinuityV198)return window.TGGWorldContinuityV198;
  const THREE=window.THREE,w=window.TGG3D;
  if(!THREE||!w?.scene){root.dataset.tggWorldContinuityV198='waiting';return null}
  const scene=w.scene;
  const ensureInstanced=(name,geometry,material,count,place)=>{
    let mesh=scene.getObjectByName?.(name);
    if(mesh||!THREE.InstancedMesh)return mesh;
    mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<count;i++){place(i,p,q,s);m.compose(p,q,s);mesh.setMatrixAt(i,m)}
    mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh;
  };

  const ground=ensureInstanced(
    'TGG_GROUND_CONTINUITY_V198',
    new THREE.CircleGeometry(3.8,12),
    new THREE.MeshBasicMaterial({color:0x596358,transparent:true,opacity:.16,depthWrite:false}),
    180,
    (i,p,q,s)=>{const a=(i/180)*Math.PI*8,r=120+(i%16)*28;
      p.set(Math.cos(a)*r,.022,Math.sin(a)*r);q.setFromEuler(new THREE.Euler(-Math.PI/2,0,a));
      const sc=.7+(i%7)*.13;s.set(sc,sc*.8,1)}
  );
  const curbs=ensureInstanced(
    'TGG_STREET_EDGE_CONTINUITY_V198',
    new THREE.BoxGeometry(5.8,.12,.42),
    new THREE.MeshStandardMaterial({color:0x747980,roughness:.9,metalness:.02}),
    168,
    (i,p,q,s)=>{const axis=i%2,side=i%4<2?-1:1,step=Math.floor(i/4)-21;
      p.set(axis?step*7.2:side*10.2,.06,axis?side*10.2:step*7.2);
      q.setFromEuler(new THREE.Euler(0,axis?Math.PI/2:0,0));s.set(1,1,1)}
  );
  const facade=ensureInstanced(
    'TGG_FACADE_DEPTH_V198',
    new THREE.PlaneGeometry(4.6,3.4),
    new THREE.MeshStandardMaterial({color:0x707883,roughness:.72,metalness:.06,transparent:true,opacity:.3,side:THREE.DoubleSide}),
    96,
    (i,p,q,s)=>{const side=i%4,step=Math.floor(i/4)-12,d=96+(i%5)*9;let x=0,z=0,r=0;
      if(side===0){x=-d;z=step*15;r=Math.PI/2}
      if(side===1){x=d;z=step*15;r=-Math.PI/2}
      if(side===2){x=step*15;z=-d;r=0}
      if(side===3){x=step*15;z=d;r=Math.PI}
      p.set(x,2.4+(i%4)*.55,z);q.setFromEuler(new THREE.Euler(0,r,0));const sc=.78+(i%5)*.06;s.set(sc,.92,1)}
  );

  let fill=scene.getObjectByName?.('TGG_WORLD_FILL_V198');
  if(!fill){fill=new THREE.HemisphereLight(0x9ab6d0,0x302f2b,0);fill.name='TGG_WORLD_FILL_V198';scene.add(fill)}
  let rim=scene.getObjectByName?.('TGG_FOCUS_RIM_V198');
  if(!rim){rim=new THREE.PointLight(0xcfe5ff,0,16,2);rim.name='TGG_FOCUS_RIM_V198';scene.add(rim)}

  let avatar=null,lastAvatarScan=0,lastSig='';
  const findAvatar=()=>{
    if(avatar?.parent)return avatar;
    const now=performance.now();if(now-lastAvatarScan<2500)return avatar;lastAvatarScan=now;
    scene.traverse?.(o=>{if(avatar)return;const n=String(o?.name||'').toLowerCase();
      if(/player|avatar|character/.test(n)&&o?.position)avatar=o});
    return avatar;
  };
  const applyMaterials=()=>{
    const targets=[w.car,findAvatar()].filter(Boolean);
    targets.forEach(target=>target.traverse?.(o=>{
      if(!o?.isMesh||!o.material)return;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      mats.forEach(m=>{
        if(!m||!('roughness'in m))return;
        const name=String(o.name||'').toLowerCase();
        if(target===w.car&&!/glass|window/.test(name)){
          m.roughness=Math.max(.16,Math.min(.5,Number(m.roughness??.34)));
          if('metalness'in m)m.metalness=Math.max(Number(m.metalness??0),.24);
          if('envMapIntensity'in m)m.envMapIntensity=Math.max(Number(m.envMapIntensity??0),1.1);
        }
        if(target!==w.car){
          m.roughness=Math.max(.34,Math.min(.82,Number(m.roughness??.62)));
          if('metalness'in m&&/chain|watch|jewel|glasses|metal/.test(name))m.metalness=Math.max(Number(m.metalness??0),.65);
        }
        m.needsUpdate=true;
      });
    }));
  };
  const apply=()=>{
    const s=state(),night=s.time==='night',gold=s.time==='golden',wet=/rain|storm/.test(s.weather),balanced=s.quality==='balanced';
    const sig=[s.district,s.time,s.weather,s.quality,s.driving?'1':'0'].join('|');
    if(sig!==lastSig){
      lastSig=sig;
      if(ground){ground.visible=!balanced||s.district==='park'||s.district==='home';ground.material.opacity=wet?.11:.17;
        ground.material.color.setHex(s.district==='park'?0x4d684f:s.district==='home'?0x686254:0x596358)}
      if(curbs){curbs.material.roughness=wet?.58:.9;curbs.material.color.setHex(s.district==='studio'?0x6f6d77:s.district==='home'?0x837f77:0x747980)}
      if(facade){facade.visible=s.district!=='park'&&!balanced;facade.material.opacity=night?.4:gold?.34:.28;
        facade.material.color.setHex(s.district==='studio'?0x765e75:s.district==='media'?0x65778e:s.district==='home'?0x80796e:0x707883)}
      fill.intensity=night?.32:gold?.78:1.0;fill.color.setHex(night?0x586d87:gold?0xb3a18f:0x9ab6d0);
      fill.groundColor.setHex(s.district==='park'?0x293b2d:s.district==='home'?0x3d3932:0x302f2b);
    }
    const focus=s.driving?w.car:findAvatar();
    if(focus?.position&&!balanced){
      rim.position.set(focus.position.x+1.8,focus.position.y+2.8,focus.position.z+1.4);
      rim.intensity=night?.9:wet?.56:.3;
      rim.color.setHex(night?0xa8c9ff:wet?0xd2e7f5:0xffddba);
      root.dataset.tggFocusRimV198=s.driving?'vehicle':'avatar';
    }else{rim.intensity=0;root.dataset.tggFocusRimV198=focus?'disabled-balanced':'waiting'}
    applyMaterials();
    root.dataset.tggGroundContinuityV198=ground?'180':'0';
    root.dataset.tggStreetEdgeContinuityV198=curbs?'168':'0';
    root.dataset.tggFacadeDepthV198=facade?'96':'0';
    root.dataset.tggWorldMaterialContinuityV198='1';
    root.dataset.tggWorldContinuityV198='1';
  };
  const api={apply,version:'198'};
  window.TGGWorldContinuityV198=api;apply();return api;
}
window.TGGInstallWorldContinuityV198=install;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();