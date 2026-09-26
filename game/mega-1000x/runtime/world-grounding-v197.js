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
  if(window.TGGWorldGroundingV197)return window.TGGWorldGroundingV197;
  const THREE=window.THREE,w=window.TGG3D;
  if(!THREE||!w?.scene){root.dataset.tggWorldGroundingV197='waiting';return null}
  const scene=w.scene;
  const ensureInstanced=(name,geometry,material,count,place)=>{
    let mesh=scene.getObjectByName?.(name);
    if(mesh||!THREE.InstancedMesh)return mesh;
    mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<count;i++){place(i,p,q,s);m.compose(p,q,s);mesh.setMatrixAt(i,m)}
    mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh;
  };
  const curbs=ensureInstanced(
    'TGG_CURB_MEDIAN_V197',
    new THREE.BoxGeometry(5.6,.22,.5),
    new THREE.MeshStandardMaterial({color:0x777c82,roughness:.9,metalness:.02}),
    144,
    (i,p,q,s)=>{const axis=i%2,side=i%4<2?-1:1,step=Math.floor(i/4)-18;
      p.set(axis?step*7.1:side*9.7,.11,axis?side*9.7:step*7.1);
      q.setFromEuler(new THREE.Euler(0,axis?Math.PI/2:0,0));s.set(1,1,1)}
  );
  const glass=ensureInstanced(
    'TGG_STOREFRONT_GLASS_DEPTH_V197',
    new THREE.PlaneGeometry(4.8,3.1),
    new THREE.MeshPhysicalMaterial({color:0x6f91aa,roughness:.06,metalness:.08,transparent:true,opacity:.18,transmission:.16,depthWrite:false,side:THREE.DoubleSide}),
    72,
    (i,p,q,s)=>{const side=i%4,step=Math.floor(i/4)-9,d=82+(i%3)*8;let x=0,z=0,r=0;
      if(side===0){x=-d;z=step*16;r=Math.PI/2}
      if(side===1){x=d;z=step*16;r=-Math.PI/2}
      if(side===2){x=step*16;z=-d;r=0}
      if(side===3){x=step*16;z=d;r=Math.PI}
      p.set(x,2.2,z);q.setFromEuler(new THREE.Euler(0,r,0));const sc=.84+(i%4)*.08;s.set(sc,1,1)}
  );
  const props=ensureInstanced(
    'TGG_TERRAIN_PROPS_V197',
    new THREE.CylinderGeometry(.22,.36,1.2,6),
    new THREE.MeshStandardMaterial({color:0x5b5248,roughness:.98}),
    132,
    (i,p,q,s)=>{const a=(i/132)*Math.PI*5,r=210+(i%12)*38;
      p.set(Math.cos(a)*r,.6,Math.sin(a)*r);q.setFromEuler(new THREE.Euler(0,a*.8,0));
      const sc=.55+(i%6)*.1;s.set(sc,.7+(i%4)*.12,sc)}
  );
  let contact=scene.getObjectByName?.('TGG_CONTACT_LIGHT_V197');
  if(!contact){contact=new THREE.PointLight(0xd9ecff,0,11,2);contact.name='TGG_CONTACT_LIGHT_V197';scene.add(contact)}
  let avatar=null,lastAvatarScan=0,lastSig='';
  const findAvatar=()=>{
    if(avatar?.parent)return avatar;
    const now=performance.now();if(now-lastAvatarScan<2500)return avatar;lastAvatarScan=now;
    scene.traverse?.(o=>{if(avatar)return;const n=String(o?.name||'').toLowerCase();if(/player|avatar|character/.test(n)&&o?.position)avatar=o});
    return avatar;
  };
  const applyTraffic=()=>{
    const traffic=w.traffic||[];
    traffic.forEach((v,i)=>{
      if(!v?.userData)return;
      const classes=['compact','sedan','muscle','utility','luxury'];
      const scales=[.92,1,1.05,1.08,.98],idx=i%classes.length;
      v.userData.tggTrafficClassV197=classes[idx];
      if(v.scale&&v.userData.tggTrafficScaleAppliedV197!=='1'){
        v.scale.multiplyScalar?.(scales[idx]);v.userData.tggTrafficScaleAppliedV197='1';
      }
    });
    root.dataset.tggTrafficVarietyV197=traffic.length?String(Math.min(5,traffic.length)):'0';
  };
  const apply=()=>{
    const state=getState(),night=state.time==='night',wet=/rain|storm/.test(state.weather),balanced=state.quality==='balanced';
    const sig=[state.district,state.time,state.weather,state.quality,state.driving?'1':'0'].join('|');
    if(sig!==lastSig){
      lastSig=sig;
      if(curbs){curbs.visible=state.district!=='park'||state.driving;curbs.material.color.setHex(state.district==='home'?0x86827a:state.district==='studio'?0x70727b:0x777c82);curbs.material.roughness=wet?.62:.9}
      if(glass){glass.visible=state.district!=='park'&&!balanced;glass.material.opacity=night?.28:wet?.24:.17;glass.material.roughness=wet?.03:.07}
      if(props){props.visible=(state.district==='park'||state.district==='home'||state.driving)&&!balanced;props.material.color.setHex(state.district==='park'?0x4e5a45:0x5b5248)}
    }
    applyTraffic();
    const focus=state.driving?w.car:findAvatar();
    if(focus?.position&&!balanced){
      contact.position.set(focus.position.x,focus.position.y+1.2,focus.position.z);
      contact.intensity=night?1.05:wet?.62:.34;
      contact.color.setHex(night?0x9ec7ff:wet?0xc7ddf0:0xffddb5);
      root.dataset.tggContactLightingV197=state.driving?'vehicle':'avatar';
    }else{
      contact.intensity=0;root.dataset.tggContactLightingV197=focus?'disabled-balanced':'waiting';
    }
    root.dataset.tggCurbMedianV197=curbs?'144':'0';
    root.dataset.tggStorefrontGlassDepthV197=glass?'72':'0';
    root.dataset.tggTerrainPropsV197=props?'132':'0';
    root.dataset.tggGroundContactModelV197='shadow+contact-light';
    root.dataset.tggWorldGroundingV197='1';
  };
  const api={apply,version:'197'};
  window.TGGWorldGroundingV197=api;apply();return api;
}
window.TGGInstallWorldGroundingV197=install;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();