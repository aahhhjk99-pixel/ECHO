import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const SAVE="echo_phase1_3d";
let scene,camera,renderer,clock,player,weapon,flash,keys={},enemies=[],bullets=[],running=false,paused=false;
let state={x:0,y:1.1,z:22,hp:100,energy:100,ammo:12,reserve:36,med:2,quest:0,kills:0};

const $=id=>document.getElementById(id);
const ui={menu:$("menu"),pause:$("pause"),hud:$("hud"),hp:$("hp"),energy:$("energy"),ammo:$("ammo"),obj:$("objective"),msg:$("msg")};

function save(){localStorage.setItem(SAVE,JSON.stringify(state));}
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE));if(!s)return false;state={...state,...s};return true}catch{return false}}
function msg(t){ui.msg.textContent=t;clearTimeout(msg.t);msg.t=setTimeout(()=>ui.msg.textContent="",3500)}

function boot(){
 scene=new THREE.Scene(); scene.background=new THREE.Color(0x071114); scene.fog=new THREE.FogExp2(0x071114,.018);
 camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.05,500);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 document.body.appendChild(renderer.domElement);clock=new THREE.Clock();
 const hemi=new THREE.HemisphereLight(0x9db7c0,0x18211e,1.7);scene.add(hemi);
 const moon=new THREE.DirectionalLight(0xb8d1d5,2.3);moon.position.set(-30,50,15);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);scene.add(moon);
 buildWorld();buildPlayer();for(let i=0;i<7;i++)spawnEnemy(-45+i*14, -12-(i%3)*18);
 addEvents();resize();requestAnimationFrame(loop);setTimeout(()=>$("boot").remove(),900);
}
function mat(c,rough=1,metal=0){return new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal})}
function box(x,y,z,sx,sy,sz,c){let m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
function buildWorld(){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,180),mat(0x26372f));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // layered terrain
 for(let i=0;i<85;i++){let x=(Math.random()-.5)*210,z=(Math.random()-.5)*150;let s=1+Math.random()*3;let rock=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),mat(0x4a5550));rock.position.set(x,s*.35,z);rock.scale.y=.35;rock.castShadow=rock.receiveShadow=true;scene.add(rock)}
 // road
 box(0,.015,0,220,.03,12,0x202627);box(-20,.02,-35,12,.04,90,0x202627);
 // buildings
 [[-58,-42,22,8,16],[50,-48,28,11,20],[-54,35,30,13,16],[55,42,25,10,15]].forEach(a=>{let b=box(a[0],a[3]/2,a[1],a[2],a[3],a[4],0x313a3b);for(let y=2;y<a[3]-1;y+=3)for(let x=-a[2]/2+2;x<a[2]/2-1;x+=4)box(a[0]+x,y,a[1]-a[4]/2-.03,1.2,1.2,.08,0x607477)});
 // trees
 for(let i=0;i<90;i++){let x=(Math.random()-.5)*210,z=(Math.random()-.5)*140;if(Math.abs(x)<65&&Math.abs(z)<50)continue;tree(x,z)}
 // relay tower
 for(let y=0;y<13;y+=2.2){let r=7-y*.4;let a=box(35,y/2,35,.18,y, .18,0x77817e);a.position.x=35-r;a.position.z=35-r*.2}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.12,8,48),new THREE.MeshBasicMaterial({color:0x80c6d0}));ring.rotation.x=Math.PI/2;ring.position.set(35,.2,35);scene.add(ring);
}
function tree(x,z){let trunk=box(x,1,z,.8,2,.8,0x3b2e25);let crown=new THREE.Mesh(new THREE.ConeGeometry(2.8,7,7),mat(0x183a32));crown.position.set(x,5,z);crown.castShadow=true;scene.add(crown)}
function buildPlayer(){
 player=new THREE.Group();player.position.set(state.x,state.y,state.z);scene.add(player);
 let body=new THREE.Mesh(new THREE.CapsuleGeometry(.48,1.1,6,12),mat(0x29383b));body.position.y=.65;body.castShadow=true;player.add(body);
 let head=new THREE.Mesh(new THREE.SphereGeometry(.32,16,12),mat(0xb6a294));head.position.y=1.65;head.castShadow=true;player.add(head);
 let pack=box(0,0,0,.65,.85,.35,0x182326);pack.position.set(0,1.0,.38);pack.castShadow=true;player.add(pack);
 weapon=new THREE.Group();let gun=box(0,0,0,.14,.18,1.35,0x15191a);gun.position.set(.55,1.05,-.72);weapon.add(gun);let barrel=box(0,0,0,.07,.07,.65,0x050607);barrel.position.set(.55,1.05,-1.68);weapon.add(barrel);player.add(weapon);
 flash=new THREE.PointLight(0xdcefff,0,8);flash.position.set(.55,1.05,-1.9);player.add(flash);
}
function spawnEnemy(x,z){let g=new THREE.Group();g.position.set(x,0,z);let core=new THREE.Mesh(new THREE.CapsuleGeometry(.55,.7,5,8),mat(0x553e39));core.position.y=.65;core.castShadow=true;g.add(core);let eye=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xe1a18d}));eye.position.set(0,1.15,-.52);g.add(eye);scene.add(g);enemies.push({g,hp:70,cd:0,speed:1.5,dead:false})}
function addEvents(){
 addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="escape")pause()});
 addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
 addEventListener("resize",resize);
 renderer.domElement.addEventListener("pointerdown",e=>{if(e.button===0)fire()});
 $("new").onclick=()=>start(false);$("continue").onclick=()=>start(true);$("resume").onclick=pause;$("save").onclick=()=>{save();msg("Progress saved locally.")};$("menuBtn").onclick=mainMenu;$("pauseBtn").onclick=pause;
 $("fire").onclick=fire;$("dash").onclick=dash;$("use").onclick=interact;
}
function start(cont){if(cont&&!load())state={x:0,y:1.1,z:22,hp:100,energy:100,ammo:12,reserve:36,med:2,quest:0,kills:0};player.position.set(state.x,state.y,state.z);running=true;paused=false;ui.menu.classList.add("hidden");ui.hud.classList.remove("hidden");msg("The coast is silent. The relay is still powered.");}
function mainMenu(){save();running=false;paused=false;ui.pause.classList.add("hidden");ui.hud.classList.add("hidden");ui.menu.classList.remove("hidden")}
function pause(){if(!running)return;paused=!paused;ui.pause.classList.toggle("hidden",!paused)}
function fire(){if(!running||paused||state.ammo<=0)return;state.ammo--;flash.intensity=8;setTimeout(()=>flash.intensity=0,45);let p=player.position.clone();let dir=new THREE.Vector3(0,0,-1).applyQuaternion(player.quaternion);bullets.push({p:p.clone().add(dir.multiplyScalar(1.5)),v:dir.clone().multiplyScalar(45),life:1});msg("Shot fired.");}
function dash(){if(state.energy<30)return;state.energy-=30;player.translateZ(-4);state.x=player.position.x;state.z=player.position.z}
function interact(){let d=player.position.distanceTo(new THREE.Vector3(35,0,35));if(d<8){state.quest=Math.max(1,state.quest);msg("RELAY ONLINE — A second signal is coming from the old station.");save()}else if(state.med>0&&state.hp<100){state.med--;state.hp=Math.min(100,state.hp+35);msg("Field treatment complete.")}}
function update(dt){
 let x=(keys.d?1:0)-(keys.a?1:0),z=(keys.s?1:0)-(keys.w?1:0);let v=new THREE.Vector3(x,0,z);if(v.length())v.normalize();player.position.addScaledVector(v,dt*7);if(v.length())player.rotation.y=Math.atan2(v.x,v.z);
 player.position.x=THREE.MathUtils.clamp(player.position.x,-105,105);player.position.z=THREE.MathUtils.clamp(player.position.z,-75,75);state.x=player.position.x;state.z=player.position.z;state.energy=Math.min(100,state.energy+15*dt);
 if(keys.r){keys.r=false;let n=Math.min(12-state.ammo,state.reserve);state.ammo+=n;state.reserve-=n}
 if(keys.e){keys.e=false;interact()}
 if(keys.q){keys.q=false;interact()}
 bullets.forEach(b=>{b.p.addScaledVector(b.v,dt);b.life-=dt});
 for(const b of bullets)for(const e of enemies)if(!e.dead&&b.p.distanceTo(e.g.position)<1.4){e.hp-=35;b.life=0;if(e.hp<=0){e.dead=true;e.g.visible=false;state.kills++;msg("Hostile neutralized.")}}
 bullets=bullets.filter(b=>b.life>0);
 enemies.forEach(e=>{if(e.dead)return;let d=e.g.position.distanceTo(player.position);e.cd-=dt;if(d<24){e.g.lookAt(player.position.x,0,player.position.z);if(d>2.2)e.g.translateZ(e.speed*dt*-1);else if(e.cd<=0){state.hp-=10;e.cd=1.1;msg("Contact.");}}});
 if(state.hp<=0){state.hp=100;player.position.set(0,1.1,22);state.x=0;state.z=22;msg("You blacked out and returned to the last safe point.")}
 ui.hp.style.width=state.hp+"%";ui.energy.style.width=state.energy+"%";ui.ammo.textContent=`${state.ammo} / ${state.reserve}`;ui.obj.textContent=state.quest?"Follow the second signal to the old station.":"Reach the illuminated relay tower.";
 if(Math.random()<.004)save();
}
function cameraFollow(){let target=new THREE.Vector3().copy(player.position);let desired=new THREE.Vector3(0,5.2,8).applyQuaternion(player.quaternion).add(player.position);camera.position.lerp(desired,.09);camera.lookAt(target.x,target.y+1,target.z-1)}
function loop(){requestAnimationFrame(loop);if(!running||paused){renderer.render(scene,camera);return}let dt=Math.min(clock.getDelta(),.033);update(dt);cameraFollow();renderer.render(scene,camera)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
boot();