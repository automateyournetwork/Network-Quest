// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// World-space swept triangle bounds for the staged resident/visitor pairs flagged by whole-model bounds.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const raw=path.join(root,'docs/evidence/spec001/character-production/T107');
const staging=JSON.parse(await readFile(path.join(raw,'staging.json'),'utf8'));
const layout=JSON.parse(await readFile(path.join(root,'assets-src/rooms/scene-layouts.json'),'utf8'));
const loadJson=async p=>JSON.parse(await readFile(p,'utf8'));
const flags=staging.potentialResidentPartyAabbIntersections;
const assets=new Map();
const point=new T.Vector3();
for(const id of new Set(flags.flatMap(f=>[f.resident,f.partyCharacter]))){
    const pathGLB=path.join(root,'public/assets/models',id+'.glb');
    const bytes=await readFile(pathGLB);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const mixer=new T.AnimationMixer(gltf.scene);
    const report=await loadJson(path.join(raw,id+'-native.json'));
    const meshes=[];
    gltf.scene.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const a=mesh.geometry.getAttribute('position');
        const bounds=Array.from({length:a.count},()=>[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
        meshes.push({mesh,a,bounds});
    });
    for(const clip of gltf.animations){
        mixer.stopAllAction();
        const action=mixer.clipAction(clip);
        action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
        const frames=report.clips[clip.name].frames;
        for(let frame=0;frame<=frames;frame++){
            mixer.setTime(clip.duration*frame/frames);gltf.scene.updateMatrixWorld(true);
            for(const {mesh,a,bounds} of meshes){
                for(let i=0;i<a.count;i++){
                    point.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);
                    const b=bounds[i];
                    b[0]=Math.min(b[0],point.x);b[1]=Math.min(b[1],point.y);b[2]=Math.min(b[2],point.z);
                    b[3]=Math.max(b[3],point.x);b[4]=Math.max(b[4],point.y);b[5]=Math.max(b[5],point.z);
                }
            }
        }
    }
    const triangles=[];
    for(const {mesh,a,bounds} of meshes){
        const indices=mesh.geometry.index;
        for(let i=0;i<(indices?.count ?? a.count);i+=3){
            const points=[0,1,2].map(j=>bounds[indices?indices.getX(i+j):i+j]);
            triangles.push(points[0].map((_,axis)=>(axis<3?Math.min:Math.max)(...points.map(b=>b[axis]))));
        }
    }
    assets.set(id,triangles);
}
const translated=(b,p)=>b.map((v,i)=>v+p[i%3]);
const intersects=(a,b)=>a[0]<=b[3]&&a[1]<=b[4]&&a[2]<=b[5]&&b[0]<=a[3]&&b[1]<=a[4]&&b[2]<=a[5];
const results=[];
for(const row of flags){
    const room=layout.rooms.find(r=>r.roomId===row.room);
    const anchor=room.characterPlacements.find(c=>c.characterId==='spec001:'+row.resident).position;
    const slot=room.partyStaging.positions[row.partySlot-1];
    const rb=assets.get(row.resident).map(b=>translated(b,anchor));
    const vb=assets.get(row.partyCharacter).map(b=>translated(b,slot));
    const joint=staging.sweptMetresYUp;
    const env=(id,p)=>translated([...joint[id].min,...joint[id].max],p);
    const rInside=rb.filter(b=>intersects(b,env(row.partyCharacter,slot)));
    const vInside=vb.filter(b=>intersects(b,env(row.resident,anchor)));
    let overlaps=0;
    for(const r of rInside)for(const v of vInside)if(intersects(r,v))overlaps++;
    results.push({...row,residentTriangleCount:rb.length,visitorTriangleCount:vb.length,possibleSweptTriangleAabbPairs:overlaps});
}
// Search identity-specific resident facings only. Slot centres, scales, walk areas and saved points stay frozen.
const recruits=['CH04','CH05','CH06','CH07'];
const oriented=(b,theta)=>{
    const c=Math.cos(theta),s=Math.sin(theta);
    const x=[b[0],b[3]],z=[b[2],b[5]];
    const xs=x.flatMap(u=>z.map(v=>c*u+s*v)), zs=x.flatMap(u=>z.map(v=>-s*u+c*v));
    return [Math.min(...xs),b[1],Math.min(...zs),Math.max(...xs),b[4],Math.max(...zs)];
};
const verifiedResidentFacings=[];
for(const [roomId,id] of [['spec001:R03','CH04'],['spec001:R07','CH08']]){
    const room=layout.rooms.find(r=>r.roomId===roomId);
    const anchor=room.characterPlacements.find(c=>c.characterId==='spec001:'+id).position;
    const candidates=[];
    for(const degrees of [0,15,-15,30,-30,45,-45,60,-60,75,-75,90,-90,120,-120,150,-150,180]){
        const theta=degrees*Math.PI/180;
        const rb=assets.get(id).map(b=>translated(oriented(b,theta),anchor));
        const rTotal=rb[0].map((_,axis)=>rb.reduce((v,b)=>(axis<3?Math.min:Math.max)(v,b[axis]),axis<3?Infinity:-Infinity));
        let separatedPairs=0;
        for(const [slotIndex,slot] of room.partyStaging.positions.entries()){
            for(const visitor of recruits){
                if(visitor===id) continue;
                const v=staging.sweptMetresYUp[visitor];
                const vTotal=translated([...v.min,...v.max],slot);
                if(!intersects(rTotal,vTotal)){separatedPairs++;continue;}
                const rs=rb.filter(b=>intersects(b,vTotal));
                const vs=assets.get(visitor).map(b=>translated(b,slot)).filter(b=>intersects(b,rTotal));
                if(!rs.some(r=>vs.some(v=>intersects(r,v))))separatedPairs++;
            }
        }
        const expected=room.partyStaging.positions.length*(recruits.length-(recruits.includes(id)?1:0));
        const safe=room.authoritativeSafePositions[0].point;
        const outsideSavedPoint=safe.x<rTotal[0]||safe.x>rTotal[3]||safe.y<rTotal[2]||safe.y>rTotal[5];
        const vertices=room.authoritativeWalkRegions[0].vertices;
        const inside= rTotal[0]>=Math.min(...vertices.map(v=>v.x))&&rTotal[3]<=Math.max(...vertices.map(v=>v.x))&&rTotal[2]>=Math.min(...vertices.map(v=>v.y))&&rTotal[5]<=Math.max(...vertices.map(v=>v.y));
        candidates.push({degreesY:degrees,separatedPairs,expected,insideWalkBounds:inside,preservesSavedPoint:outsideSavedPoint});
        if(separatedPairs===expected&&outsideSavedPoint&&inside)break;
    }
    verifiedResidentFacings.push({room:roomId,resident:id,sampledFacings:candidates,proposedFacing:candidates.find(c=>c.separatedPairs===c.expected&&c.insideWalkBounds&&c.preservesSavedPoint)?.degreesY??null});
}
// In R03 a resident and two visitors can share the same narrow depth band.
const r03=layout.rooms.find(r=>r.roomId==='spec001:R03');
const ra=r03.characterPlacements.find(c=>c.characterId==='spec001:CH04').position;
const movingTriangles=(id,pos,deg)=>assets.get(id).map(b=>translated(deg?oriented(b,deg*Math.PI/180):b,pos));
const triEnvelope=(tris)=>tris[0].map((_,axis)=>tris.reduce((v,b)=>(axis<3?Math.min:Math.max)(v,b[axis]),axis<3?Infinity:-Infinity));
const clear=(a,b)=>{
    const aBox=triEnvelope(a),bBox=triEnvelope(b);
    if(!intersects(aBox,bBox))return true;
    const ais=a.filter(r=>intersects(r,bBox)), bis=b.filter(r=>intersects(r,aBox));
    return !ais.some(r=>bis.some(v=>intersects(r,v)));
};
const r03PositionPlan=[];
const r03Resident=movingTriangles('CH04',ra,-90);
const visitors=['CH05','CH06','CH07'];
const subsets=[...visitors.map(id=>[id]),['CH05','CH06'],['CH05','CH07'],['CH06','CH07']];
for(const ids of subsets){
    let suggestion;
    for(const first of [0,1]){
        const slots=[first,1-first];
        const boxes=ids.map((id,index)=>movingTriangles(id,r03.partyStaging.positions[slots[index]],0));
        const safe=r03.authoritativeSafePositions[0].point;
        const savedPointClear=boxes.every(tris=>{
            const b=triEnvelope(tris);
            return safe.x<b[0]||safe.x>b[3]||safe.y<b[2]||safe.y>b[5];
        });
        if(savedPointClear && boxes.every(tris=>clear(r03Resident,tris)) && (boxes.length===1||clear(...boxes))){
            suggestion=ids.map((id,index)=>({id,existingSlot:slots[index]+1,degreesY:0}));break;
        }
    }
    if(!suggestion)throw Error('No clear frozen-slot assignment for R03 '+ids.join(','));
    r03PositionPlan.push({visitors:ids,placements:suggestion});
}
const report={verifiedResidentFacings,R03OccupiedPartyFacings:{residentDegreesY:-90,collapseRecruitedResident:true,slotAssignments:r03PositionPlan},method:'Three.js GLTFLoader. Each triangle encloses its three source vertices over every integer frame of every exported clip. The translated paired interval test compares the residents and party slots in the frozen layout. A count of zero proves separation at sampled frames for any independent phase combination. Positive counts require actual finished-room inspection.',
    frameRate:24,results};
await writeFile(path.join(raw,'resident-clearance.json'),JSON.stringify(report,null,2)+'\n');
console.log(results.map(r=>[r.room,r.resident,r.partyCharacter,r.possibleSweptTriangleAabbPairs]));
