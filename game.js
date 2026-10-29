(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const loading = $('loading'), loadingBar = $('loading-bar'), loadingMessage = $('loading-message');
  const canvas = $('game-canvas');
  const state = {
    started:false, paused:false, speed:0, heading:0, cash:1250, jobDone:false,
    jobReward:350, cameraMode:0, time:8.5, distance:0, steering:0, throttle:0,
    brake:0, handbrake:false, lastTime:0, toastTimer:null, collisions:0
  };
  const keys = new Set();
  const controls = {left:false,right:false,accelerate:false,brake:false,handbrake:false};
  let scene, camera, renderer, car, carBody, wheels=[], traffic=[], buildings=[], roadGroup, checkpoint, checkpointRing, checkpointLight;
  let clock, cameraTarget = new THREE.Vector3(), desiredCamera = new THREE.Vector3();
  const world = {roadWidth:12, block:70, limit:420};
  const saved = loadSave();

  function loadSave(){
    try { const s=JSON.parse(localStorage.getItem('phantomDriveSave')||'{}'); return {cash:Number.isFinite(s.cash)?s.cash:1250, jobDone:!!s.jobDone}; }
    catch(e){return {cash:1250,jobDone:false};}
  }
  function save(){
    try { localStorage.setItem('phantomDriveSave',JSON.stringify({cash:state.cash,jobDone:state.jobDone})); } catch(e){}
  }
  function showToast(message){
    const t=$('toast'); t.textContent=message; t.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>t.classList.remove('show'),2300);
  }
  function setLoading(percent,message){
    loadingBar.style.width=percent+'%'; loadingMessage.textContent=message;
  }
  function material(color, roughness=0.8, metalness=0){
    return new THREE.MeshStandardMaterial({color,roughness,metalness});
  }
  function box(parent,w,h,d,x,y,z,mat, opts={}){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z); mesh.castShadow=!!opts.shadow; mesh.receiveShadow=true;
    parent.add(mesh); return mesh;
  }
  function cylinder(parent,r1,r2,h,x,y,z,mat,segments=12){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);
    mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  }
  function buildCar(){
    const root=new THREE.Group();
    const paint=material(0x252d37,.32,.55), glass=new THREE.MeshStandardMaterial({color:0x8ba9b7,roughness:.2,metalness:.2,transparent:true,opacity:.78});
    const rubber=material(0x17191b,1), rim=material(0xa8b1b7,.35,.7), light= new THREE.MeshStandardMaterial({color:0xfff0c7,emissive:0x665533});
    const tail= new THREE.MeshStandardMaterial({color:0xff2929,emissive:0x8a1010});
    carBody=new THREE.Group(); root.add(carBody);
    box(carBody,2.05,.62,4.35,0,.72,0,paint,{shadow:true});
    box(carBody,1.68,.72,2.15,0,1.25,-.25,paint);
    box(carBody,1.48,.54,1.8,0,1.31,-.23,glass);
    box(carBody,1.82,.13,1.2,0,1.62,-.22,paint);
    box(carBody,1.72,.12,.45,0,1.66,1.62,paint);
    box(carBody,.56,.16,.12,-.57,.87,2.2,light);
    box(carBody,.56,.16,.12,.57,.87,2.2,light);
    box(carBody,.48,.14,.12,-.62,.87,-2.2,tail);
    box(carBody,.48,.14,.12,.62,.87,-2.2,tail);
    for(const x of [-1.03,1.03]){
      for(const z of [-1.42,1.42]){
        const wheel=new THREE.Group(); wheel.position.set(x,.42,z);
        const tire=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.24,16),rubber); tire.rotation.z=Math.PI/2; wheel.add(tire);
        const hub=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.255,12),rim); hub.rotation.z=Math.PI/2; wheel.add(hub);
        root.add(wheel); wheels.push({mesh:wheel,front:z>0});
      }
    }
    root.add(carBody);
    root.position.set(0,0,10);
    scene.add(root);
    return root;
  }
  function addRoad(x,z,w,d,rotation=0){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material(0x343a3e,1));
    mesh.rotation.x=-Math.PI/2; mesh.rotation.z=rotation; mesh.position.set(x,.025,z); mesh.receiveShadow=true; roadGroup.add(mesh);
  }
  function addRoadMark(x,z,w,d,rotation=0,color=0xd7d4b7){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material(color,1));
    mesh.rotation.x=-Math.PI/2; mesh.rotation.z=rotation; mesh.position.set(x,.04,z); roadGroup.add(mesh);
  }
  function buildWorld(){
    scene=new THREE.Scene(); scene.background=new THREE.Color(0x9bbfce); scene.fog=new THREE.Fog(0x9bbfce,125,440);
    camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,700);
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=false; renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight(0xdcefff,0x4d5142,2.0));
    const sun=new THREE.DirectionalLight(0xffe1b3,2.1); sun.position.set(-100,140,80); scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100),material(0x71866b,1));
    ground.rotation.x=-Math.PI/2; ground.position.y=-.04; scene.add(ground);
    roadGroup=new THREE.Group(); scene.add(roadGroup);
    // Connected city grid with two main avenues and a set of side streets.
    for(let p=-420;p<=420;p+=world.block){
      addRoad(p,0,world.roadWidth,900);
      addRoad(0,p,900,world.roadWidth);
      for(let lane=-1;lane<=1;lane++){
        addRoadMark(p+lane*3.6,0,.12,880,0,0xe2d9a9);
        addRoadMark(0,p+lane*3.6,880,.12,0,0xe2d9a9);
      }
      // Side street markings across major intersections.
      for(let off=-420;off<=420;off+=world.block){
        addRoadMark(p,off,world.roadWidth*.62,.18,0,0xf0f0e0);
        addRoadMark(off,p,.18,world.roadWidth*.62,0,0xf0f0e0);
      }
    }
    // Roadside sidewalks and block lots.
    const buildingMats=[0xb7b7ae,0x9caab0,0xc4b9a4,0x858f95,0xd0c8b8,0x6f7c83].map(c=>material(c));
    const windowMat=material(0x42616f,.35,.25), roofMat=material(0x646b6e);
    for(let gx=-5;gx<=5;gx++){
      for(let gz=-5;gz<=5;gz++){
        if(Math.abs(gx)<1&&Math.abs(gz)<1) continue;
        const cx=gx*world.block+35, cz=gz*world.block+35;
        // Leave corridors along grid roads and add buildings inside blocks.
        for(let k=0;k<2;k++){
          const bx=cx+(k===0?-13:13), bz=cz+(Math.random()-.5)*16;
          const height= (Math.abs(gx)<2&&Math.abs(gz)<2)? 12+Math.random()*27 : 5+Math.random()*10;
          const width=11+Math.random()*5, depth=13+Math.random()*9;
          const b=new THREE.Group();
          const body=box(b,width,height,depth,0,height/2,0,buildingMats[Math.floor(Math.random()*buildingMats.length)]);
          box(b,width+.3,.35,depth+.3,0,height+.18,0,roofMat);
          // Repeated window strips on visible faces.
          for(let y=2;y<height-1;y+=2.8){
            for(let wx=-width/2+1.2;wx<width/2-1;wx+=2.3){
              box(b,.85,.9,.035,wx,y,depth/2+.02,windowMat);
              box(b,.035,.9,1.0,width/2+.02,y,Math.min(depth/2-1,wx),windowMat);
            }
          }
          b.position.set(bx,0,bz); scene.add(b); buildings.push(b);
        }
        // Small roadside trees.
        if(Math.random()>.42){
          const tx=cx+(Math.random()-.5)*28, tz=cz+(Math.random()-.5)*24;
          const trunk= new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,2,6),material(0x594533)); trunk.position.set(tx,1,tz); scene.add(trunk);
          const crown=new THREE.Mesh(new THREE.ConeGeometry(1.8,4,7),material(0x3d6a49)); crown.position.set(tx,3.6,tz); scene.add(crown);
        }
      }
    }
    // Decorative highway lanes outside downtown.
    addRoad(0,465,1000,22); addRoad(0,-465,1000,22);
    for(let x=-480;x<480;x+=10){addRoadMark(x,465,.3,.7);addRoadMark(x,-465,.3,.7);}
    // Checkpoint ring at the end of a short starter route.
    checkpoint=new THREE.Group(); checkpoint.position.set(0,0,-175); scene.add(checkpoint);
    checkpointRing=new THREE.Mesh(new THREE.TorusGeometry(5,.38,8,24),material(0xd6ff38,.25,.2));
    checkpointRing.position.y=3.3; checkpointRing.rotation.x=Math.PI/2; checkpoint.add(checkpointRing);
    checkpointLight=new THREE.PointLight(0xd6ff38,2,30); checkpointLight.position.y=4; checkpoint.add(checkpointLight);
    // Traffic: simple low-poly vehicles moving along grid roads.
    for(let i=0;i<18;i++) makeTraffic(i);
    // City outskirts hills.
    const hillMat=material(0x778b6b);
    for(let i=0;i<22;i++){
      const hill=new THREE.Mesh(new THREE.ConeGeometry(18+Math.random()*24,25+Math.random()*45,7),hillMat);
      const a=Math.random()*Math.PI*2, r=470+Math.random()*110;
      hill.position.set(Math.cos(a)*r,8,Math.sin(a)*r); scene.add(hill);
    }
  }
  function makeTraffic(i){
    const g=new THREE.Group();
    const colors=[0xe0e1db,0x384f64,0xa74d37,0x262a2d,0xc7aa4b,0x6f8986];
    const paint=material(colors[i%colors.length],.45,.2), glass=material(0x536d7b,.3,.1), tire=material(0x17191b);
    box(g,1.8,.55,3.5,0,.55,0,paint);
    box(g,1.35,.55,1.6,0,1.05,-.15,glass);
    for(const x of [-.88,.88]) for(const z of [-1.1,1.1]){
      const w=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.16,10),tire);w.rotation.z=Math.PI/2;w.position.set(x,.3,z);g.add(w);
    }
    const vertical=i%2===0;
    const lane=(i%3-1)*3;
    const pos=-380+(i*47)%760;
    if(vertical){g.position.set(lane,0,pos);g.rotation.y=0;}
    else{g.position.set(pos,0,lane);g.rotation.y=Math.PI/2;}
    g.userData={vertical,lane,speed:8+(i%5)*2,sign:i%3===0?-1:1,base:pos};
    scene.add(g);traffic.push(g);
  }
  function updateTraffic(dt){
    for(const t of traffic){
      const u=t.userData;
      if(u.vertical){t.position.z+=u.speed*u.sign*dt;if(t.position.z>430)t.position.z=-430;if(t.position.z< -430)t.position.z=430;}
      else{t.position.x+=u.speed*u.sign*dt;if(t.position.x>430)t.position.x=-430;if(t.position.x< -430)t.position.x=430;}
      // Light collision slowdown: nudge the player's speed down if nearby.
      const dx=t.position.x-car.position.x,dz=t.position.z-car.position.z;
      if(Math.abs(dx)<2.1&&Math.abs(dz)<3.2&&Math.abs(state.speed)>2){
        state.speed*=.88; state.collisions++; if(state.collisions%8===1) showToast('COLLISION — WATCH YOUR DISTANCE');
      }
    }
  }
  function setupUI(){
    $('cash').textContent='$'+Math.round(state.cash).toLocaleString('en-US');
    $('career-level').textContent=state.jobDone?'DRIVER':'BEGINNER';
    $('mission-title').textContent=state.jobDone?'Next Delivery':'First Delivery';
    $('mission-description').textContent=state.jobDone?'Your first job is complete. Reach the checkpoint again for another delivery.':'Drive to the gold checkpoint to complete your first job.';
    $('mission-reward').textContent='REWARD $'+state.jobReward;
    $('car-label').textContent='PHANTOM SEDAN';
  }
  function updateUI(){
    $('speed').textContent=Math.round(Math.abs(state.speed)*3.6);
    $('gear').textContent=state.speed<-.5?'R':state.brake>.1&&state.speed<.5?'N':'D';
    $('speed-fill').style.width=Math.min(100,Math.abs(state.speed)*3.6/180*100)+'%';
    $('cash').textContent='$'+Math.round(state.cash).toLocaleString('en-US');
    $('career-level').textContent=state.jobDone?'DRIVER':'BEGINNER';
    const d=Math.hypot(checkpoint.position.x-car.position.x,checkpoint.position.z-car.position.z);
    $('mission-distance').textContent='DISTANCE '+Math.round(d)+' M';
    state.time=(state.time+0.00018)%24;
    const hours=Math.floor(state.time), mins=Math.floor((state.time-hours)*60);
    $('clock').textContent=String(hours).padStart(2,'0')+':'+String(mins).padStart(2,'0');
    if(Math.abs(car.position.x)>260||Math.abs(car.position.z)>260) $('district').textContent='OUTSKIRTS / HIGHWAY';
    else if(Math.abs(car.position.x)<90&&Math.abs(car.position.z)<90) $('district').textContent='DOWNTOWN DISTRICT';
    else $('district').textContent='CITY SUBURBS';
    $('mission-title').textContent=state.jobDone?'Next Delivery':'First Delivery';
    $('mission-description').textContent=state.jobDone?'Delivery complete. Reach the checkpoint again to earn another reward.':'Drive to the gold checkpoint to complete your first job.';
  }
  function completeJob(){
    if(Math.hypot(checkpoint.position.x-car.position.x,checkpoint.position.z-car.position.z)<8){
      state.cash+=state.jobReward;state.jobDone=true;save();setupUI();
      showToast('DELIVERY COMPLETE  +$'+state.jobReward);
      checkpoint.position.z=checkpoint.position.z===-175?175:-175;
      state.jobReward+=100;
      $('mission-reward').textContent='REWARD $'+state.jobReward;
    }
  }
  function setCamera(dt){
    const forward=new THREE.Vector3(Math.sin(state.heading),0,Math.cos(state.heading));
    if(state.cameraMode===1){
      desiredCamera.copy(car.position).add(new THREE.Vector3(0,1.6,0)).add(forward.clone().multiplyScalar(1.05));
      camera.position.lerp(desiredCamera,.25);
      cameraTarget.copy(car.position).add(new THREE.Vector3(0,1.5,0)).add(forward.clone().multiplyScalar(25));
      camera.fov=76;
    } else if(state.cameraMode===2){
      desiredCamera.copy(car.position).add(new THREE.Vector3(0,2.4,0)).add(forward.clone().multiplyScalar(1.6));
      camera.position.lerp(desiredCamera,.22);cameraTarget.copy(car.position).add(forward.clone().multiplyScalar(35));camera.fov=70;
    } else {
      desiredCamera.copy(car.position).add(new THREE.Vector3(0,6.2,0)).add(forward.clone().multiplyScalar(-11));
      camera.position.lerp(desiredCamera,Math.min(1,dt*4));
      cameraTarget.copy(car.position).add(new THREE.Vector3(0,1.1,0)).add(forward.clone().multiplyScalar(6));
      camera.fov=65;
    }
    camera.updateProjectionMatrix();camera.lookAt(cameraTarget);
  }
  function updateCar(dt){
    const accel=controls.accelerate||keys.has('w')||keys.has('arrowup');
    const brake=controls.brake||keys.has('s')||keys.has('arrowdown');
    const left=controls.left||keys.has('a')||keys.has('arrowleft');
    const right=controls.right||keys.has('d')||keys.has('arrowright');
    const handbrake=controls.handbrake||keys.has(' ');
    state.brake=brake?1:0; state.handbrake=handbrake;
    if(accel) state.speed+=13*dt;
    if(brake) state.speed-= (state.speed>0?22:8)*dt;
    if(!accel&&!brake) state.speed*=Math.max(0,1-1.1*dt);
    if(handbrake) state.speed*=Math.max(0,1-3.5*dt);
    state.speed=THREE.MathUtils.clamp(state.speed,-7,42);
    const steer=(left?-1:0)+(right?1:0);
    const speedFactor=Math.min(1,Math.abs(state.speed)/8);
    state.heading+=steer*1.35*speedFactor*dt*(state.speed>=0?1:-1);
    const forwardX=Math.sin(state.heading), forwardZ=Math.cos(state.heading);
    car.position.x+=forwardX*state.speed*dt;
    car.position.z+=forwardZ*state.speed*dt;
    car.position.x=THREE.MathUtils.clamp(car.position.x,-490,490);
    car.position.z=THREE.MathUtils.clamp(car.position.z,-490,490);
    car.rotation.y=state.heading;
    carBody.position.y=Math.sin(performance.now()*.012)*.018*Math.min(1,Math.abs(state.speed)/10);
    carBody.rotation.z=-steer*.035*speedFactor;
    wheels.forEach(w=>{if(w.front)w.mesh.rotation.y=steer*.35;});
    state.distance+=Math.abs(state.speed)*dt;
    completeJob();
  }
  function updateLighting(){
    const daylight=Math.max(.28,Math.sin((state.time-6)/12*Math.PI));
    scene.background.setRGB(.18+.43*daylight,.24+.48*daylight,.30+.5*daylight);
    scene.fog.color.copy(scene.background);
  }
  function animate(now){
    requestAnimationFrame(animate);
    const dt=Math.min(.04,(now-(state.lastTime||now))/1000||0);state.lastTime=now;
    if(state.started&&!state.paused){
      updateCar(dt);updateTraffic(dt);updateUI();updateLighting();
      checkpointRing.rotation.z+=dt*.8;
      checkpointLight.intensity=1.6+Math.sin(now*.004)*.6;
    }
    if(car) setCamera(dt);
    renderer.render(scene,camera);
  }
  function setControl(name,value){controls[name]=value;}
  function bindControls(){
    document.querySelectorAll('[data-control]').forEach(btn=>{
      const name=btn.dataset.control;
      const down=e=>{e.preventDefault();setControl(name,true);btn.classList.add('active');};
      const up=e=>{e.preventDefault();setControl(name,false);btn.classList.remove('active');};
      btn.addEventListener('pointerdown',down);
      ['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,up));
    });
    window.addEventListener('keydown',e=>{
      const key=e.key.toLowerCase();
      if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
      keys.add(key);
      if(key==='c')cycleCamera();
      if(key==='escape')togglePause();
    },{passive:false});
    window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{keys.clear();Object.keys(controls).forEach(k=>controls[k]=false);});
    $('camera-btn').addEventListener('click',cycleCamera);
    $('pause-btn').addEventListener('click',togglePause);
    $('resume-btn').addEventListener('click',togglePause);
    $('reset-btn').addEventListener('click',()=>{
      try{localStorage.removeItem('phantomDriveSave');}catch(e){}
      state.cash=1250;state.jobDone=false;state.jobReward=350;state.speed=0;
      state.paused=false;$('pause-menu').classList.add('hidden');save();setupUI();showToast('CAREER RESET');
    });
    $('start-btn').addEventListener('click',()=>{
      state.started=true;$('intro-panel').classList.add('hidden');
      showToast('ENGINE STARTED — LET’S DRIVE');
    });
    window.addEventListener('resize',()=>{
      if(!renderer||!camera)return;
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);
    });
  }
  function cycleCamera(){state.cameraMode=(state.cameraMode+1)%3;showToast(['THIRD-PERSON CAMERA','COCKPIT CAMERA','HOOD CAMERA'][state.cameraMode]);}
  function togglePause(){
    if(!state.started)return;
    state.paused=!state.paused;$('pause-menu').classList.toggle('hidden',!state.paused);
    if(state.paused){Object.keys(controls).forEach(k=>controls[k]=false);keys.clear();}
  }
  function init(){
    if(!window.THREE){loadingMessage.textContent='Could not load 3D engine. Check your internet connection and refresh.';return;}
    try{
      setLoading(20,'Setting up the driving environment...');
      buildWorld();setLoading(60,'Preparing your vehicle...');
      car=buildCar();setLoading(80,'Loading career systems...');
      state.cash=saved.cash;state.jobDone=saved.jobDone;setupUI();bindControls();
      camera.position.set(0,8,22);camera.lookAt(0,0,0);
      setLoading(100,'Ready to drive.');
      setTimeout(()=>loading.classList.add('hidden'),350);
      requestAnimationFrame(animate);
    }catch(err){
      console.error(err);loadingMessage.textContent='The game could not start on this browser. Try refreshing or using a newer Chrome version.';
    }
  }
  init();
})();