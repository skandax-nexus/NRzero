// Character look audit (docs/CHARACTER_LOOK.md): per-template triangles, LOD, morph targets and atlas sizes, read
// straight from the glb JSON.  node tools/feel/look_glbstats.cjs assets/models/cast.glb
const fs=require("fs");const b=fs.readFileSync(process.argv[2]);const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len));
const binOff=20+len+8;
function imgSize(bv){const v=j.bufferViews[bv];const off=binOff+(v.byteOffset||0);const d=b.slice(off,off+v.byteLength);
 // webp VP8/VP8L/VP8X
 const t=d.slice(12,16).toString();if(t==="VP8X")return[1+d.readUIntLE(24,3),1+d.readUIntLE(27,3)];if(t==="VP8 ")return[d.readUInt16LE(26)&0x3fff,d.readUInt16LE(28)&0x3fff];if(t==="VP8L"){const x=d.readUInt32LE(21);return[1+(x&0x3fff),1+((x>>14)&0x3fff)];}return[0,0];}
const scene=j.scenes[0];
const out={};
function walk(ni,acc){const n=j.nodes[ni];if(n.mesh!=null)acc.push({node:n,mesh:j.meshes[n.mesh]});(n.children||[]).forEach(c=>walk(c,acc));}
for(const r of scene.nodes){const acc=[];walk(r,acc);const name=j.nodes[r].name;let tris=0,trisL=0,prims=0,primsL=0,morph=0;const mats=new Set(),imgs=new Set();const names=[];
 for(const {node,mesh} of acc){const lod=node.extras&&node.extras.lod;for(const p of mesh.primitives){const ic=p.indices!=null?j.accessors[p.indices].count/3:j.accessors[p.attributes.POSITION].count/3;if(lod){trisL+=ic;primsL++;}else{tris+=ic;prims++;}if(p.targets)morph=Math.max(morph,p.targets.length);mats.add(p.material);const m=j.materials[p.material];for(const k of ["baseColorTexture"]){const t=m.pbrMetallicRoughness&&m.pbrMetallicRoughness[k];if(t){const tex=j.textures[t.index];const src=tex.extensions?tex.extensions.EXT_texture_webp.source:tex.source;imgs.add(j.images[src].name+":"+imgSize(j.images[src].bufferView).join("x"));}}
  if(m.normalTexture){const tex=j.textures[m.normalTexture.index];const src=tex.extensions?tex.extensions.EXT_texture_webp.source:tex.source;imgs.add(j.images[src].name+":"+imgSize(j.images[src].bufferView).join("x"));}}
  names.push(node.name+(lod?"[lod]":"")+"("+mesh.primitives.length+")");}
 out[name]={tris,prims,trisL,primsL,morph,mats:[...mats].map(i=>j.materials[i].name).join(","),imgs:[...imgs].join(" "),meshes:names.join(" ")};}
for(const k in out){const o=out[k];console.log(k.padEnd(14),"tris",String(o.tris).padStart(6),"prims",o.prims,"| lod tris",o.trisL,"prims",o.primsL,"| morph",o.morph,"|",o.imgs,"|",o.meshes);}
