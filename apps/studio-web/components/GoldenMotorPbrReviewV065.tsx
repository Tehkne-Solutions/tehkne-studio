"use client";

import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ACESFilmicToneMapping, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MOTOR_URL = "/api/asset-forge/af001/motor/lod0";
const MAX_AVERAGE_FRAME_MS = 100;
const MAX_P95_FRAME_MS = 150;
const WARMUP_MS = 1_500;
const BENCHMARK_WINDOW_MS = 8_000;
const MAX_VALID_DELTA_MS = 1_000;
const MIN_BENCHMARK_SAMPLES = 30;
const REQUIRED_NODES = ["PIVOT_MAIN","PIVOT_SHAFT","BODY_CAN","FRONT_CAP","REAR_CAP","SHAFT","TERMINAL_POS","TERMINAL_NEG","SOCKET_MECH_AXIS_OUT","SOCKET_MECH_MOUNT_FRONT","SOCKET_ELEC_POWER_POS","SOCKET_ELEC_POWER_NEG"] as const;

type View = "three-quarter"|"front"|"side"|"rear"|"bearing"|"terminals";
type Inspection = { missingNodes: readonly string[]; meshCount: number; materialCount: number };
type Stats = { samples:number; averageFrameMs:number; p95FrameMs:number };
const VIEWS:Record<View,{position:[number,number,number];target:[number,number,number]}>={
  "three-quarter":{position:[.065,.045,.080],target:[0,0,0]}, front:{position:[0,.004,.078],target:[0,0,.012]}, side:{position:[.082,.004,.005],target:[0,0,0]}, rear:{position:[0,.004,-.078],target:[0,0,-.010]}, bearing:{position:[.022,.012,.050],target:[0,0,.018]}, terminals:{position:[.020,-.002,-.050],target:[0,-.002,-.019]}
};

function percentile(values:readonly number[],ratio:number){ if(!values.length)return 0; const v=[...values].sort((a,b)=>a-b); return v[Math.min(v.length-1,Math.floor(v.length*ratio))]??0; }
function inspect(root:Object3D):Inspection{ let meshCount=0; const mats=new Set<string>(); root.traverse(o=>{ if(!(o instanceof Mesh))return; meshCount++; o.castShadow=true;o.receiveShadow=true; for(const m of Array.isArray(o.material)?o.material:[o.material]) if(m instanceof MeshStandardMaterial){m.envMapIntensity=.72;m.needsUpdate=true;mats.add(m.name||m.uuid);} }); return {missingNodes:REQUIRED_NODES.filter(n=>!root.getObjectByName(n)),meshCount,materialCount:mats.size}; }
function CameraRig({view}:{view:View}){ const {camera}=useThree(); useEffect(()=>{const p=VIEWS[view];camera.position.set(...p.position);camera.lookAt(...p.target);camera.updateProjectionMatrix();},[camera,view]); return null; }
function Motor({onReady}:{onReady:(i:Inspection)=>void}){ const gltf=useLoader(GLTFLoader,MOTOR_URL); const scene=useMemo(()=>gltf.scene.clone(true),[gltf.scene]); useEffect(()=>onReady(inspect(scene)),[onReady,scene]); return <primitive object={scene}/>; }
function Loading(){ return <mesh><boxGeometry args={[.024,.018,.030]}/><meshStandardMaterial color="#70777d" metalness={.7} roughness={.4}/></mesh>; }
const label=(v:View)=>v==="three-quarter"?"3/4":v==="front"?"Frontal":v==="side"?"Lateral":v==="rear"?"Traseira":v==="bearing"?"Eixo / bearing":"Terminais";

export function GoldenMotorPbrReviewV065(){
  const [view,setView]=useState<View>("three-quarter"); const [inspection,setInspection]=useState<Inspection|null>(null); const [stats,setStats]=useState<Stats|null>(null);
  const ready=inspection!==null; const nodes=Boolean(inspection&&!inspection.missingNodes.length); const onReady=useCallback((i:Inspection)=>setInspection(i),[]);
  useEffect(()=>{ if(!ready||!nodes||stats)return; let cancel=false; const started=performance.now(); let prev=started; const samples:number[]=[]; const tick=(now:number)=>{ if(cancel)return; const delta=now-prev;prev=now;const elapsed=now-started; if(elapsed>=WARMUP_MS&&delta>0&&delta<=MAX_VALID_DELTA_MS)samples.push(delta); if(elapsed>=WARMUP_MS+BENCHMARK_WINDOW_MS){const avg=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:Number.POSITIVE_INFINITY;setStats({samples:samples.length,averageFrameMs:Number(avg.toFixed(2)),p95FrameMs:Number(percentile(samples,.95).toFixed(2))});return;} requestAnimationFrame(tick);}; const id=requestAnimationFrame(tick); return()=>{cancel=true;cancelAnimationFrame(id);};},[nodes,ready,stats]);
  const pass=Boolean(stats&&stats.samples>=MIN_BENCHMARK_SAMPLES&&stats.averageFrameMs<MAX_AVERAGE_FRAME_MS&&stats.p95FrameMs<MAX_P95_FRAME_MS);
  const viewport=typeof window==="undefined"?"server":`${window.innerWidth}×${window.innerHeight} @ ${window.devicePixelRatio.toFixed(2)}x`;
  return <section aria-label="AF-001I Golden Motor LOD0 PBR Runtime Review" data-runtime-ready={ready?"true":"false"} data-benchmark-ready={stats?"true":"false"} data-node-gate={nodes?"pass":ready?"blocked":"pending"} style={{minHeight:"100dvh",background:"#0b0e11",color:"#edf1f3",padding:22,display:"grid",gap:16,gridTemplateRows:"auto auto 1fr auto"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:24,alignItems:"end",flexWrap:"wrap"}}><div><span style={{color:"#82aeb1",fontWeight:800,letterSpacing:".16em",fontSize:11}}>TEHKNÉ SOLUTIONS · ASSET FORGE</span><h1 style={{margin:"8px 0 0",fontSize:"clamp(26px,4vw,42px)"}}>AF-001I · HERO v0.6.5 Runtime</h1><p style={{color:"#9da7ae",margin:"8px 0 0"}}>Golden Motor HERO_CANDIDATE · LOD0 3.292 tris · PBR runtime + benchmark determinístico.</p></div><strong style={{color:stats?(pass?"#8dc9a0":"#e08378"):"#d6ae6c"}}>{!stats?"RUNTIME REVIEW EM EXECUÇÃO":pass?"LOD0 RUNTIME PASS":"LOD0 RUNTIME BLOCKED"}</strong></header>
    <nav aria-label="AF-001I camera views" style={{display:"flex",flexWrap:"wrap",gap:8}}>{(Object.keys(VIEWS) as View[]).map(v=><button key={v} type="button" data-testid={`camera-view-${v}`} aria-pressed={view===v} onClick={()=>setView(v)} style={{border:view===v?"1px solid #aab6bc":"1px solid #364048",background:view===v?"#e1e6e8":"#151a1f",color:view===v?"#12171b":"#b5c0c6",borderRadius:9,padding:"9px 12px",fontWeight:800}}>{label(v)}</button>)}</nav>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(300px,360px)",gap:16,minHeight:0}}><div data-testid="pbr-canvas-shell" data-camera-view={view} style={{minHeight:600,borderRadius:18,overflow:"hidden",border:"1px solid #343d43",background:"#151a1e"}}><Canvas camera={{position:VIEWS["three-quarter"].position,fov:30,near:.001,far:5}} dpr={[1,1.5]} shadows gl={{antialias:true,powerPreference:"high-performance"}} onCreated={({gl})=>{gl.outputColorSpace=SRGBColorSpace;gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=.96;}}><color attach="background" args={["#14181b"]}/><ambientLight intensity={.22}/><directionalLight position={[.075,.11,.075]} intensity={3.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/><directionalLight position={[-.065,.025,.055]} intensity={1.05}/><spotLight position={[0,.09,-.075]} intensity={1.7} angle={.62} penumbra={.86} color="#d7e2e5"/><CameraRig view={view}/><Suspense fallback={<Loading/>}><Motor onReady={onReady}/></Suspense><mesh position={[0,-.018,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[.24,.24]}/><meshStandardMaterial color="#22272b" metalness={.06} roughness={.88}/></mesh></Canvas></div>
      <aside style={{border:"1px solid #343d43",borderRadius:18,padding:20,background:"#11161a"}}><h2>Gate técnico</h2><dl style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"10px 16px"}}><dt>Asset</dt><dd>TS_ELEC_MOTOR_DC_A</dd><dt>Versão</dt><dd>0.6.5 HERO</dd><dt>LOD / tris</dt><dd>LOD0 · 3.292</dd><dt>Meshes</dt><dd data-testid="mesh-count">{inspection?.meshCount??"—"}</dd><dt>Materiais</dt><dd data-testid="material-count">{inspection?.materialCount??"—"}</dd><dt>Nodes</dt><dd data-testid="node-gate-verdict">{nodes?"PASS":ready?"BLOCKED":"WAIT"}</dd><dt>Frames</dt><dd data-testid="benchmark-samples-i">{stats?.samples??"—"}</dd><dt>Avg</dt><dd data-testid="average-frame-ms-i">{stats?`${stats.averageFrameMs} ms`:"—"}</dd><dt>P95</dt><dd data-testid="p95-frame-ms-i">{stats?`${stats.p95FrameMs} ms`:"—"}</dd><dt>Viewport</dt><dd data-testid="viewport-context">{viewport}</dd></dl><div data-testid="lod0-pbr-verdict" style={{marginTop:20,fontWeight:900,color:stats?(pass?"#8dc9a0":"#e08378"):"#d6ae6c"}}>{!stats?"BENCHMARKING":pass?"LOD0 PBR RUNTIME PASS":"LOD0 PBR RUNTIME BLOCKED"}</div><p style={{color:"#7f8a92",fontSize:12}}>PASS: ≥{MIN_BENCHMARK_SAMPLES} amostras, Avg &lt;100 ms, P95 &lt;150 ms. Arte já passou AF-001K; Golden continua bloqueado até runtime + AF-001L.</p></aside></div>
    <footer style={{display:"flex",justifyContent:"space-between",color:"#78848b",fontSize:12}}><span>HERO_CANDIDATE · fail-closed</span><span>Tehkné Solutions</span></footer>
  </section>;
}
