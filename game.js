import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const canvas=document.getElementById("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x071114);
scene.fog=new THREE.FogExp2(0x071114,0.0125);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.05,500);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.8)); renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;

const ui={menu:mainMenu,settings:settings,pause:pause,hud:hud,hp:hp,energy:energy,ammo:ammo,obj:objective,msg:notice};
let state={x:-4,y:0,z:35,hp:100,energy:100,ammo:12,reserve:36,med:2,quest:0,kills:0};
let player,weapon,muzzle,enemies=[],projectiles=[],pickups=[],effects=[],running=false,paused=false,clock=new THREE.Clock();
let keys={},moveTouch={x:0,y:0},mouse={x:0,y:0,locked:false},yaw=0,pitch=.22,sensitivity=1;

const SAVE="echo_complete_build_v2";

function M(color,rough=.8,metal=.05){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function mesh(geo,mat,pos,cast=true){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m}
function box(pos,size,color,rough=.8,metal=.05){return mesh(new THREE.BoxGeometry(...size),M(color,rough,metal),pos)}
function say(t){ui.msg.textContent=t;clearTimeout(say.t);say.t=setTimeout(()=>ui.msg.textContent="",4200)}

function makeNoiseTexture(base,light,seed=1){
 const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");x.fillStyle=base;x.fillRect(0,0,128,128);
 let s=seed;const rnd=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296};
 for(let i=0;i<900;i++){let a=rnd(),b=rnd(),r=1+rnd()*3;x.fillStyle=light+Math.floor(rnd()*18).toString(16);x.fillRect(a*128,b*128,r,r)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,7);return t
}
function buildWorld(){
 const groundMat=new THREE.MeshStandardMaterial({map:makeNoiseTexture("#28392f","#405047",8),roughness:1});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,180,1,1),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // shoreline
 const waterMat=new THREE.MeshPhysicalMaterial({color:0x12343b,roughness:.16,metalness:.05,transmission:.05,transparent:true,opacity:.88});
 const water=new THREE.Mesh(new THREE.PlaneGeometry(240,38,1,1),waterMat);water.rotation.x=-Math.PI/2;water.position.set(0,.03,-71);scene.add(water);
 // road and markings
 box([0,.012,15],[220,.025,9],0x222728,1);box([-37,.015,-5],[9,.03,100],0x222728,1);
 for(let z=-30;z<55;z+=9)box([-37,.04,z],[.18,.02,4],0xb4a85d,1);
 // buildings with roof, windows, doors
 building(-62,-30,26,10,18);building(52,-33,31,13,22);building(-62,34,25,9,17);building(54,38,28,11,19);building(7,-52,34,8,20);
 // vegetation
 for(let i=0;i<170;i++){let x=(Math.random()-.5)*220,z=(Math.random()-.5)*145;if(Math.abs(x)<72&&Math.abs(z)<55)continue;tree(x,z,0.7+Math.random()*1.1)}
 for(let i=0;i<90;i++){let x=(Math.random()-.5)*210,z=(Math.random()-.5)*130;if(Math.abs(x)<70&&Math.abs(z)<50)continue;rock(x,z,.4+Math.random()*1.8)}
 // relay and station beacon
 tower(35,34);
 stationDoor(54,27);
 // crates and lamps
 for(let i=0;i<24;i++){let x=(Math.random()-.5)*100,z=(Math.random()-.5)*80;box([x,.6,z],[1.2,1.2,1.2],0x4a4033,.9,0); }
 for(let i=0;i<10;i++)lamp((Math.random()-.5)*100,(Math.random()-.5)*75);
}
function building(x,z,w,h,d){
 box([x,h/2,z],[w,h,d],0x303839,.88,.02);
 box([x,h+.15,z],[w+.7,.3,d+.7],0x1c2425,1);
 for(let xx=x-w/2+2;xx<x+w/2-1;xx+=4){
   box([xx,h*.62,z-d/2-.035],[1.2,1.5,.08],0x6b7e7e,.25,.15);
   box([xx,h*.62,z+d/2+.035],[1.2,1.5,.08],0x53686a,.25,.15);
 }
 box([x,.9,z-d/2-.07],[1.8,1.8,.12],0x161a1b,.75,.1);
}
function stationDoor(x,z){box([x,1.7,z],[5,3.4,.2],0x101719,.5,.3);const light=new THREE.PointLight(0x87cbd2,5,15);light.position.set(x,3,z-2);scene.add(light)}
function tree(x,z,s){
 const trunk=mesh(new THREE.CylinderGeometry(.16*s,.28*s,2.2*s,8),M(0x4a3527),[x,1.1*s,z]);
 const crown=mesh(new THREE.ConeGeometry(2*s,6*s,8),M(0x173c31,.95),[x,4*s,z]);crown.castShadow=true;
}
function rock(x,z,s){const r=mesh(new THREE.IcosahedronGeometry(s,0),M(0x4b5753,1),[x,s*.45,z]);r.scale.y=.55}
function lamp(x,z){const pole=box([x,2,z],[.12,4,.12],0x242a2b,.4,.5);const l=new THREE.PointLight(0xd9d0a5,1.5,9);l.position.set(x,4,z);scene.add(l);box([x,4,z],[.35,.15,.35],0xddd1a0,.2,.2)}
function tower(x,z){
 for(const y of [2,5,8,11]){box([x-2.7+y*.12,y,x-1.5],[.14,.15,.14],0x778281,.5,.5);box([x+2.7-y*.12,y,x+1.5],[.14,.15,.14],0x778281,.5,.5)}
 const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,1.5,12),new THREE.MeshBasicMaterial({color:0x9de5e8}));beacon.position.set(x,13,z);scene.add(beacon);
 const light=new THREE.PointLight(0x75dce4,10,35);light.position.set(x,13,z);scene.add(light);
}
function makePlayer(){
 player=new THREE.Group();player.position.set(state.x,state.y,state.z);scene.add(player);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,.95,8,16),M(0x263539,.8,.05));body.position.y=1.0;body.castShadow=true;player.add(body);
 const vest=new THREE.Mesh(new THREE.BoxGeometry(.85,.72,.35),M(0x172124,.72,.08));vest.position.set(0,1.05,.1);vest.castShadow=true;player.add(vest);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.3,20,14),M(0xb59d8e,.65));head.position.y=1.72;head.castShadow=true;player.add(head);
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.62,.82,.3),M(0x142024,.9));pack.position.set(0,1.05,.4);pack.castShadow=true;player.add(pack);
 weapon=new THREE.Group();const receiver=box([0,0,0],[.16,.2,1.25],0x121719,.45,.55);receiver.position.set(.52,1.18,-.55);weapon.add(receiver);const barrel=box([0,0,0],[.075,.075,.7],0x050707,.25,.7);barrel.position.set(.52,1.18,-1.5);weapon.add(barrel);const stock=box([0,0,0],[.15,.18,.45],0x2a3030,.65);stock.position.set(.52,1.18,.22);weapon.add(stock);player.add(weapon);
 muzzle=new THREE.PointLight(0xffe8b5,0,7);muzzle.position.set(.52,1.18,-1.83);player.add(muzzle);
}
function spawnEnemy(x,z,type=Math.random()>.7?"brute":"stalker"){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 const scale=type==="brute"?1.35:1;
 const core=new THREE.Mesh(new THREE.CapsuleGeometry(.48*scale,.9*scale,7,12),M(type==="brute"?0x4e3330:0x553a37,.92));core.position.y=.75*scale;core.castShadow=true;g.add(core);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.29*scale,14,10),M(0x6b4841,.9));head.position.y=1.55*scale;head.castShadow=true;g.add(head);
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.075*scale,8,6),new THREE.MeshBasicMaterial({color:0xf1a08b}));eye.position.set(0,1.57*scale,-.28*scale);g.add(eye);
 enemies.push({g,hp:type==="brute"?150:70,max:type==="brute"?150:70,cd:0,speed:type==="brute"?1.05:1.7,type,dead:false,roam:Math.random()*6});
}
function spawnEnemies(){for(let i=0;i<10;i++)spawnEnemy(-45+i*10,-5-(i%4)*14,i%4===0?"brute":"stalker")}

function fire(){
 if(!running||paused||state.ammo<=0)return;
 state.ammo--;muzzle.intensity=10;setTimeout(()=>muzzle.intensity=0,45);
 const dir=new THREE.Vector3(0,0,-1).applyQuaternion(player.quaternion);
 projectiles.push({p:player.position.clone().add(new THREE.Vector3(0,1.15,0)).addScaledVector(dir,1.5),v:dir.multiplyScalar(55),life:1.2});
 say("");
}
function reload(){let n=Math.min(12-state.ammo,state.reserve);if(n>0){state.ammo+=n;state.reserve-=n;say("Magazine reloaded.")}}
function dash(){if(state.energy<28)return;state.energy-=28;player.translateZ(-4);player.position.y=0}
function interact(){
 const relay=new THREE.Vector3(35,0,34);
 if(player.position.distanceTo(relay)<9&&state.quest===0){state.quest=1;say("The relay wakes. The second signal is coming from the old station.");save();return}
 if(player.position.distanceTo(new THREE.Vector3(54,0,27))<8&&state.quest>=1){state.quest=2;say("The station door is unlocked. Something is moving inside.");save();return}
 const med=pickups.find(p=>!p.used&&p.type==="med"&&p.o.position.distanceTo(player.position)<3);
 if(med){med.used=true;state.med++;med.o.visible=false;say("Medical kit acquired.");save();return}
 if(state.med>0&&state.hp<100){state.med--;state.hp=Math.min(100,state.hp+35);say("Field treatment complete.");}
}
function save(){state.x=player.position.x;state.z=player.position.z;localStorage.setItem(SAVE,JSON.stringify(state))}
function load(){try{state={...state,...JSON.parse(localStorage.getItem(SAVE))};return true}catch{return false}}

function update(dt){
 let mx=(keys.d?1:0)-(keys.a?1:0),mz=(keys.s?1:0)-(keys.w?1:0);
 if(moveTouch.x||moveTouch.y){mx+=moveTouch.x;mz+=moveTouch.y}
 const dir=new THREE.Vector3(mx,0,mz);if(dir.length()>1)dir.normalize();
 if(dir.length()){const ang=Math.atan2(dir.x,dir.z);yaw=THREE.MathUtils.lerpAngle(yaw,ang,.18);player.rotation.y=yaw;player.translateZ(-dir.length()*6*dt)}
 player.position.x=THREE.MathUtils.clamp(player.position.x,-105,105);player.position.z=THREE.MathUtils.clamp(player.position.z,-76,76);
 if(keys.shift){keys.shift=false;dash()}if(keys.e){keys.e=false;interact()}if(keys.r){keys.r=false;reload()}if(keys.q){keys.q=false;interact()}
 state.energy=Math.min(100,state.energy+16*dt);
 projectiles.forEach(b=>{b.p.addScaledVector(b.v,dt);b.life-=dt});
 for(const b of projectiles)for(const e of enemies)if(!e.dead&&b.p.distanceTo(e.g.position.clone().add(new THREE.Vector3(0,1,0)))<1.35){b.life=0;e.hp-=35;impact(e.g.position);if(e.hp<=0){e.dead=true;e.g.visible=false;state.kills++;say("Hostile neutralized.");}}
 projectiles=projectiles.filter(b=>b.life>0);
 enemies.forEach(e=>{
   if(e.dead)return;
   const d=e.g.position.distanceTo(player.position);e.cd-=dt;
   if(d<28){e.g.lookAt(player.position.x,0,player.position.z);if(d>2.2)e.g.translateZ(-e.speed*dt);else if(e.cd<=0){state.hp-=e.type==="brute"?18:9;e.cd=1.15;hitEffect();}}
   else {e.roam-=dt;if(e.roam<0){e.roam=2+Math.random()*4;e.g.rotation.y=Math.random()*6.28}e.g.translateZ(-e.speed*.12*dt)}
 });
 if(state.hp<=0){state.hp=100;player.position.set(-4,0,35);say("You blacked out and returned to the last safe point.")}
 ui.hp.style.width=state.hp+"%";ui.energy.style.width=state.energy+"%";ui.ammo.textContent=`${state.ammo} / ${state.reserve}`;
 ui.obj.textContent=state.quest===0?"Reach the illuminated relay tower.":state.quest===1?"Follow the second signal to the old station.":"Enter the old station and find the source.";
 if(Math.random()<.006)save();
}
function impact(pos){for(let i=0;i<8;i++)effects.push({p:pos.clone(),v:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3),life:.3})}
function hitEffect(){for(let i=0;i<5;i++)effects.push({p:player.position.clone().add(new THREE.Vector3(0,1,0)),v:new THREE.Vector3((Math.random()-.5)*2,Math.random()*2,(Math.random()-.5)*2),life:.25})}

function cameraUpdate(){
 const offset=new THREE.Vector3(0,4.1,7.6).applyQuaternion(player.quaternion).add(player.position);
 camera.position.lerp(offset,.085);camera.lookAt(player.position.x,1.15,player.position.z-1);
}
function animate(){
 requestAnimationFrame(animate);
 if(running&&!paused){const dt=Math.min(clock.getDelta(),.033);update(dt);cameraUpdate();renderEffects(dt)}
 renderer.render(scene,camera);
}
function renderEffects(dt){
 effects.forEach(e=>{e.p.addScaledVector(e.v,dt);e.v.y-=7*dt;e.life-=dt});
 effects=effects.filter(e=>e.life>0);
}
function start(continueSave){
 if(continueSave)load();else state={x:-4,y:0,z:35,hp:100,energy:100,ammo:12,reserve:36,med:2,quest:0,kills:0};
 player.position.set(state.x,0,state.z);running=true;paused=false;ui.menu.classList.add("hidden");ui.hud.classList.remove("hidden");say("The receiver is warm. Someone was here.");
}
function mainMenu(){save();running=false;ui.pause.classList.add("hidden");ui.hud.classList.add("hidden");ui.menu.classList.remove("hidden")}
function pause(){if(!running)return;paused=!paused;ui.pause.classList.toggle("hidden",!paused)}

$("newGame").onclick=()=>start(false);$("continueGame").onclick=()=>start(true);$("pauseBtn").onclick=pause;$("resume").onclick=pause;$("save").onclick=()=>{save();say("Progress saved locally.")};$("home").onclick=mainMenu;
$("settingsOpen").onclick=()=>{ui.menu.classList.add("hidden");ui.settings.classList.remove("hidden")};$("settingsBack").onclick=()=>{ui.settings.classList.add("hidden");ui.menu.classList.remove("hidden")};
$("quality").onchange=e=>{renderer.setPixelRatio(Math.min(devicePixelRatio*+e.target.value,1.8))};$("sens").oninput=e=>sensitivity=+e.target.value;
$("fire").onclick=fire;$("dash").onclick=dash;$("use").onclick=interact;
addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key==="Escape")pause()});addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
document.addEventListener("pointerlockchange",()=>mouse.locked=document.pointerLockElement===renderer.domElement);
renderer.domElement.addEventListener("click",()=>{if(running&&!mouse.locked)renderer.domElement.requestPointerLock()});
addEventListener("mousemove",e=>{if(!mouse.locked||paused)return;yaw-=e.movementX*.002*sensitivity;player.rotation.y=yaw});
const joy=document.getElementById("joystick"),stick=document.getElementById("stick");
joy.addEventListener("pointermove",e=>{if(e.pressure===0)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy,m=Math.hypot(x,y),lim=43;if(m>lim){x=x/m*lim;y=y/m*lim}moveTouch.x=x/lim;moveTouch.y=y/lim;stick.style.transform=`translate(${x}px,${y}px)`});
joy.addEventListener("pointerup",()=>{moveTouch.x=moveTouch.y=0;stick.style.transform=""});joy.addEventListener("pointercancel",()=>{moveTouch.x=moveTouch.y=0;stick.style.transform=""});

buildWorld();makePlayer();spawnEnemies();
setTimeout(()=>document.getElementById("loading").remove(),800);
animate();
