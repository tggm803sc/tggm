(function(){
'use strict';
const root=document.documentElement;
const readState=()=>({
  district:String(root.dataset.tggDistrict||'downtown'),
  time:String(root.dataset.tggTime||'day'),
  weather:String(root.dataset.tggWeather||'clear'),
  quality:String(root.dataset.tggGraphicsAdaptiveV55||root.dataset.tggQuality||'high'),
  driving:root.dataset.tggDriving==='1'
});
function install(){
  if(window.TGGWorldAtmosphereV199)return window.TGGWorldAtmosphereV199;
  const THREE=window.THREE,w=window.TGG3D;
  if(!THREE||!w?.scene){root.dataset.tggWorldAtmosphereV199='waiting';return null}
  const scene=w.scene;
  const inst=(name,geo,mat,count,place)=>{
    let mesh=scene.getObjectByName?.(name);
    if(mesh||!THREE.InstancedMesh)return mesh;
    mesh=new THREE.InstancedMesh(geo,mat,count);mesh.name=name;
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    for(let i=0;i<count;i++){place(i,p,q,s);m.compose(p,q,s);mesh.setMatrixAt(i,m)}
    mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh;
  };
  const clouds=inst(
    'TGG_CLOUD_DEPTH_V199',
    new THREE.SphereGeometry(1,8,6),
    new THREE.MeshBasicMaterial({color:0xdbe7f0,transparent:true,opacity:.12,depthWrite:false}),
    48,
    (i,p,q,s)=>{const a=(i/48)*Math.PI*2,r=520+(i%8)*62;
      p.set(Math.cos(a)*r,145+(i%5)*13,Math.sin(a)*r);q.identity();
      s.set(17+(i%4)*7,4+(i%3)*2,10+(i%5)*4)}
  );
  const terrain=inst(
    'TGG_DISTANT_TERRAIN_V199',
    new THREE.ConeGeometry(1,1,6),
    new THREE.MeshStandardMaterial({color:0x39483d,roughness:1}),
    84,
    (i,p,q,s)=>{const a=(i/84)*Math.PI*2,r=1060+(i%9)*82,h=44+(i%7)*16;
      p.set(Math.cos(a)*r,h/2,Math.sin(a)*r);q.setFromEuler(new THREE.Euler(0,a,0));
      s.set(26+(i%5)*11,h,30+(i%4)*12)}
  );
  let water=scene.getObjectByName?.('TGG_PARK_WATER_V199');
  if(!water){
    water=new THREE.Mesh(
      new THREE.CircleGeometry(34,48),
      new THREE.MeshPhysicalMaterial({color:0x486d79,roughness:.18,metalness:.06,transparent:true,opacity:.62,transmission:.18})
    );
    water.name='TGG_PARK_WATER_V199';water.rotation.x=-Math.PI/2;water.position.set(245,.015,320);scene.add(water);
  }
  let exhaust=scene.getObjectByName?.('TGG_EXHAUST_HEAT_V199');
  if(!exhaust){
    exhaust=new THREE.Group();exhaust.name='TGG_EXHAUST_HEAT_V199';
    const mat=new THREE.MeshBasicMaterial({color:0xb5c4ce,transparent:true,opacity:.12,depthWrite:false});
    for(let i=0;i<12;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.16,6,5),mat.clone());
      puff.userData.phase=i*.5;exhaust.add(puff)}
    scene.add(exhaust);
  }
  let lastSig='';
  const apply=()=>{
    const s=readState(),balanced=s.quality==='balanced',night=s.time==='night',wet=/rain|storm/.test(s.weather);
    const sig=[s.district,s.time,s.weather,s.quality,s.driving?'1':'0'].join('|');
    if(sig!==lastSig){
      lastSig=sig;
      if(clouds){
        clouds.visible=!balanced;
        clouds.material.opacity=s.weather==='storm'?.2:wet?.16:night?.07:.12;
        clouds.material.color.setHex(night?0x718198:s.weather==='storm'?0x87919b:0xdbe7f0);
      }
      if(terrain){
        terrain.visible=s.district==='park'||s.district==='home'||s.driving;
        terrain.material.color.setHex(night?0x26312a:s.district==='park'?0x365640:0x485348);
      }
      water.visible=s.district==='park'||s.driving;
      water.material.roughness=wet?.08:.18;
      water.material.opacity=night?.48:.62;
    }
    const t=performance.now()*.001;
    if(clouds?.visible){clouds.position.x=Math.sin(t*.015)*32;clouds.position.z=Math.cos(t*.011)*28}
    if(water?.visible)water.rotation.z=Math.sin(t*.08)*.015;
    if(w.car?.position&&s.driving&&!balanced){
      exhaust.visible=true;exhaust.position.set(w.car.position.x-1.8,w.car.position.y+.45,w.car.position.z);
      exhaust.children.forEach((p,i)=>{const ph=(t*.7+p.userData.phase)%1.8;
        p.position.set(-ph*.9,.12+ph*.35,(i%2?1:-1)*(.18+.04*i));
        const sc=.6+ph*.55;p.scale.setScalar(sc);p.material.opacity=Math.max(0,.13-ph*.06)});
      root.dataset.tggVehicleExhaustV199='1';
    }else{exhaust.visible=false;root.dataset.tggVehicleExhaustV199='0'}
    root.dataset.tggCloudDepthV199=clouds?'48':'0';
    root.dataset.tggDistantTerrainV199=terrain?'84':'0';
    root.dataset.tggParkWaterV199=water?'1':'0';
    root.dataset.tggDistrictAmbienceV199=s.district;
    root.dataset.tggWorldAtmosphereV199='1';
  };
  const api={apply,version:'199'};
  window.TGGWorldAtmosphereV199=api;apply();return api;
}
window.TGGInstallWorldAtmosphereV199=install;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();