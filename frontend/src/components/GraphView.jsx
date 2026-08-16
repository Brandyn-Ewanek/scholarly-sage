import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Helper to strip HTML from titles so the 3D Graph doesn't render tags
const cleanTitle = (text) => {
    if (!text) return "Untitled";
    return String(text)
        .replace(/&lt;\/?b&gt;/gi, "")
        .replace(/<\/?[^>]+(>|$)/g, "");
};

export default function GraphView({ reports, onSelectReport, selectedKeys }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-2, -2)); 
  
  const hoveredNodeRef = useRef(null); 
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Safely store props in refs to prevent the 3D canvas from resetting
  const selectedKeysRef = useRef(selectedKeys || []);
  useEffect(() => {
      selectedKeysRef.current = selectedKeys || [];
  }, [selectedKeys]);

  const onSelectReportRef = useRef(onSelectReport);
  useEffect(() => {
      onSelectReportRef.current = onSelectReport;
  }, [onSelectReport]);

  const nodesData = useMemo(() => {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return [];

    return reports.filter(r => r.query_type !== 'comparative_synthesis').map((r, i) => {
      const filename = r.file_key.split('/').pop().replace('.json', '');
      const rawTitle = r.executive_summary_2page?.report_title || filename.replace(/-/g, ' ');
      const title = cleanTitle(rawTitle); 
      const majorCategory = r.taxonomy?.major_category || 'General Research';
      const subCategory = r.taxonomy?.sub_category || 'General';
      const query = r.original_query || 'Unknown Query';
      
      const isGeneral = majorCategory === 'General Research';
      
      const HUES = [15, 35, 50, 140, 180, 200, 220, 270, 320, 340];
      const hueSeedStr = isGeneral ? title : majorCategory;
      let hueSum = 0;
      for (let j = 0; j < hueSeedStr.length; j++) hueSum += hueSeedStr.charCodeAt(j);
      const hue = HUES[hueSum % HUES.length];

      let lightness = 0.60;
      if (!isGeneral && subCategory) {
          let shadeSum = 0;
          const shadeStr = String(subCategory);
          for (let j = 0; j < shadeStr.length; j++) shadeSum += shadeStr.charCodeAt(j);
          lightness = 0.45 + ((shadeSum % 30) / 100);
      }

      const colorObj = new THREE.Color().setHSL(hue / 360, 0.85, lightness);
      const hexColor = colorObj.getHex();

      const nodeSize = Math.min(Math.max((r.size / 1024) * 0.225, 0.9), 3.6);

      // DIMENSIONS 1-3: Base Semantic Coordinates
      // RESTORED ORIGINAL COMPACT SCALE
      let baseX, baseY, baseZ;
      if (r.pca_coords) {
          baseX = r.pca_coords.x; baseY = r.pca_coords.y; baseZ = r.pca_coords.z;
      } else {
          const clusterSpread = 150; 
          baseX = (Math.random() - 0.5) * clusterSpread;
          baseY = (Math.random() - 0.5) * clusterSpread;
          baseZ = (Math.random() - 0.5) * clusterSpread;
      }

      const baseRadius = Math.sqrt(baseX * baseX + baseZ * baseZ);
      const baseAngle = Math.atan2(baseZ, baseX);

      let hash = 0;
      for (let j = 0; j < r.file_key.length; j++) hash += r.file_key.charCodeAt(j);

      // --- THE 5D AMPLIFIERS ---
      
      // DIMENSION 4 (w): Macro Orbit Speed (Turned down 20% for majestic drift)
      let rawW = r.pca_coords?.w;
      if (rawW === undefined || rawW === null || rawW === 0) rawW = hash;
      
      const uniqueSeed = (rawW * 1234567) + (i * 98765);
      const wFactor = Math.sin(uniqueSeed); 
      const orbitSpeed = wFactor * 0.20; 

      // DIMENSION 5 (v): Micro Jitter (Turned down to 30% for subtle hum)
      let rawV = r.pca_coords?.v;
      if (rawV === undefined || rawV === null || rawV === 0) rawV = (((hash * 7) % 100) - 50);
      
      const vFactor = Math.abs(((rawV * 1000) % 50) / 50); 
      const jitterSpeed = 0.45 + (vFactor * 2.25); 
      const jitterAmplitude = 0.045 + (vFactor * 0.45); 
      const jitterPhases = { x: hash % Math.PI, y: (hash * 2) % Math.PI, z: (hash * 3) % Math.PI };

      return {
        id: r.file_key, title, category: majorCategory, subCategory, query, size: nodeSize, color: hexColor,
        basePos: new THREE.Vector3(baseX, baseY, baseZ), baseAngle, baseRadius, orbitSpeed, 
        jitterSpeed, jitterAmplitude, jitterPhases, userData: r, w: rawW, v: rawV
      };
    });
  }, [reports]);

  const edgesData = useMemo(() => {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return [];
    
    return reports.filter(r => r.query_type === 'comparative_synthesis').map(r => {
        let rawTitle = r.executive_summary_2page?.report_title || "Comparative Synthesis Report";
        const title = cleanTitle(rawTitle);
        return {
            id: r.file_key,
            sourceId: r.source_reports?.[0],
            targetId: r.source_reports?.[1],
            title: title,
            userData: r
        }
    });
  }, [reports]);

  useEffect(() => {
    if (!containerRef.current || nodesData.length === 0) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    
    // THE DEEP ABYSS UPGRADE
    const abyssColor = new THREE.Color('#020617'); // Matches Tailwind slate-950 perfectly
    scene.background = abyssColor;
    
    // Fog tuned around original camera distance (400)
    scene.fog = new THREE.Fog(abyssColor, 200, 600);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    // Restored original camera distance
    camera.position.set(0, 50, 400); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false; // Camera remains locked so individual speeds are visible
    controlsRef.current = controls;

    // SCENE LIGHTING
    const ambientLight = new THREE.AmbientLight('#0f172a', 1.2); // Slate-900 tint for shadows
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 1000); 
    pointLight.position.set(200, 200, 200);
    scene.add(pointLight);

    // The Abyss Under-glow
    const abyssLight = new THREE.DirectionalLight('#38bdf8', 0.8);
    abyssLight.position.set(0, -400, 0); // Shining up from the void
    scene.add(abyssLight);

    const nodeMeshes = [];
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    nodesData.forEach(data => {
      // REVERTED: Solid, vibrant glowing nodes
      const material = new THREE.MeshStandardMaterial({
        color: data.color, emissive: data.color, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.8
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.scale.setScalar(data.size);

      // Outer Halo Glow
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: data.color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
      });
      const glow = new THREE.Mesh(geometry, glowMaterial);
      glow.scale.setScalar(1.3);
      sphere.add(glow);

      sphere.position.copy(data.basePos);
      sphere.userData = { id: data.id, isNode: true, ...data }; 
      scene.add(sphere);
      nodeMeshes.push(sphere);
    });

    const edgeObjects = [];
    
    edgesData.forEach(edge => {
        const sourceMesh = nodeMeshes.find(m => m.userData.id === edge.sourceId);
        const targetMesh = nodeMeshes.find(m => m.userData.id === edge.targetId);
        
        if (!sourceMesh || !targetMesh) {
            const fallbackGeo = new THREE.OctahedronGeometry(1.5);
            const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.8 });
            const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
            fallbackMesh.position.set((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150);
            fallbackMesh.userData = { id: edge.id, isEdge: true, title: edge.title };
            scene.add(fallbackMesh);
            edgeObjects.push({ isLegacy: true, mesh: fallbackMesh, id: edge.id, title: edge.title });
            return;
        }

        // Emerald Tethers
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x10b981, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, linewidth: 2
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([sourceMesh.position, targetMesh.position]);
        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { id: edge.id, isEdge: true, title: edge.title, sourceMesh, targetMesh };
        scene.add(line);

        // THE DNA HELIX ENERGY PARTICLES
        const particles = [];
        const pGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ 
            color: 0x38bdf8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending // Bright cyan/blue contrast
        });
        
        // 12 particles split into two interwoven strands
        for(let i=0; i<12; i++) {
            const p = new THREE.Mesh(pGeo, pMat);
            p.userData = { 
                phase: i * (1/12),
                helixOffset: (i % 2 === 0) ? Math.PI : 0, // 180 degree offset for second strand
                speed: 0.002 + (Math.random() * 0.001)
            }; 
            scene.add(p);
            particles.push(p);
        }

        edgeObjects.push({ line, particles, sourceMesh, targetMesh, id: edge.id, isLegacy: false });
    });

    raycasterRef.current.params.Line.threshold = 4;
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      nodeMeshes.forEach(mesh => {
        const d = mesh.userData;
        
        const orbitAngle = d.baseAngle + (time * d.orbitSpeed);
        
        const currentX = Math.cos(orbitAngle) * d.baseRadius;
        const currentZ = Math.sin(orbitAngle) * d.baseRadius;
        const currentY = d.basePos.y;

        const jx = Math.sin(time * d.jitterSpeed + d.jitterPhases.x) * d.jitterAmplitude;
        const jy = Math.cos(time * d.jitterSpeed + d.jitterPhases.y) * d.jitterAmplitude;
        const jz = Math.sin(time * d.jitterSpeed * 1.2 + d.jitterPhases.z) * d.jitterAmplitude;

        mesh.position.set(currentX + jx, currentY + jy, currentZ + jz);

        const isSelectedForSynthesis = selectedKeysRef.current.includes(d.id);

        if (isSelectedForSynthesis) {
            mesh.material.emissiveIntensity = 2.0; 
            mesh.children[0].material.opacity = 0.8;           
            mesh.scale.setScalar(d.size * 1.6);
            mesh.material.emissive.setHex(0xffffff); 
            mesh.children[0].material.color.setHex(0xffffff); 
        } else if (hoveredNodeRef.current === d.id) {
            mesh.material.emissiveIntensity = 1.5; 
            mesh.children[0].material.opacity = 0.5; 
            mesh.scale.setScalar(d.size * 1.3);
            mesh.material.emissive.setHex(d.color); 
            mesh.children[0].material.color.setHex(d.color);
        } else {
            mesh.material.emissiveIntensity = 0.8; 
            mesh.children[0].material.opacity = 0.2;          
            mesh.scale.setScalar(d.size);
            mesh.material.emissive.setHex(d.color);
            mesh.children[0].material.color.setHex(d.color);
        }
      });

      edgeObjects.forEach(edgeObj => {
          if (edgeObj.isLegacy) {
              edgeObj.mesh.rotation.x += 0.01;
              edgeObj.mesh.rotation.y += 0.02;
              
              if (hoveredNodeRef.current === edgeObj.id) {
                  edgeObj.mesh.scale.setScalar(1.5);
              } else {
                  edgeObj.mesh.scale.setScalar(1.0);
              }
              return; 
          }

          const posA = edgeObj.sourceMesh.position;
          const posB = edgeObj.targetMesh.position;
          
          const positions = edgeObj.line.geometry.attributes.position.array;
          positions[0] = posA.x; positions[1] = posA.y; positions[2] = posA.z;
          positions[3] = posB.x; positions[4] = posB.y; positions[5] = posB.z;
          edgeObj.line.geometry.attributes.position.needsUpdate = true;

          // Vector math to create a dynamic spiral path
          const dir = new THREE.Vector3().subVectors(posB, posA).normalize();
          const up = new THREE.Vector3(0, 1, 0);
          let right = new THREE.Vector3().crossVectors(dir, up);
          if (right.lengthSq() < 0.001) right.set(1, 0, 0); // Failsafe if looking straight down
          right.normalize();
          const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();

          edgeObj.particles.forEach(p => {
              p.userData.phase += p.userData.speed; 
              if(p.userData.phase > 1) p.userData.phase -= 1;
              const t = p.userData.phase;
              const currentPos = new THREE.Vector3().copy(posA).lerp(posB, t);
              
              // DNA Helix swelling and pinching mathematical model
              const radius = Math.sin(t * Math.PI) * 3.5;
              const angle = (time * 4) + p.userData.helixOffset + (t * Math.PI * 6); 

              const spiralOffset = new THREE.Vector3()
                  .addScaledVector(right, Math.cos(angle) * radius)
                  .addScaledVector(up2, Math.sin(angle) * radius);

              currentPos.add(spiralOffset);
              p.position.copy(currentPos);
              p.scale.setScalar(0.5 + Math.sin(t * Math.PI) * 1.5);
          });

          if (hoveredNodeRef.current === edgeObj.id) {
              edgeObj.line.material.opacity = 0.9;
              edgeObj.line.material.color.setHex(0xffffff); 
          } else {
              // Smooth, subtle pulsing energy for the base tether
              edgeObj.line.material.opacity = 0.15 + (Math.sin(time * 2 + edgeObj.id.charCodeAt(0)) * 0.15);
              edgeObj.line.material.color.setHex(0x10b981); 
          }
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const handleMouseMove = (event) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        if (cameraRef.current && sceneRef.current) {
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children);
            const validIntersects = intersects.filter(i => i.object.userData && i.object.userData.id);

            if (validIntersects.length > 0) {
                let hitObj = validIntersects.find(i => i.object.userData.isNode);
                if (!hitObj) hitObj = validIntersects[0];

                const newHoverId = hitObj.object.userData.id;
                if (hoveredNodeRef.current !== newHoverId) {
                    hoveredNodeRef.current = newHoverId; 
                    setHoveredNodeId(newHoverId); 
                    document.body.style.cursor = 'pointer';
                }
            } else {
                if (hoveredNodeRef.current !== null) {
                    hoveredNodeRef.current = null;
                    setHoveredNodeId(null);
                    document.body.style.cursor = 'default';
                }
            }
        }
    };

    const handleClick = () => {
        if (hoveredNodeRef.current && onSelectReportRef.current) {
            onSelectReportRef.current(hoveredNodeRef.current); 
        }
    };

    window.addEventListener('resize', handleResize);
    const container = containerRef.current;
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      document.body.style.cursor = 'default';
    };
  }, [nodesData, edgesData]); 

  const hoveredData = useMemo(() => {
      let data = nodesData.find(n => n.id === hoveredNodeId);
      if (!data) data = edgesData.find(e => e.id === hoveredNodeId);
      return data;
  }, [nodesData, edgesData, hoveredNodeId]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#020617', overflow: 'hidden' }}>
      
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10, pointerEvents: 'none' }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#38bdf8', borderRadius: '50%', boxShadow: '0 0 10px #38bdf8', animation: 'pulse 2s infinite' }}></span>
          5D Semantic Space
        </h3>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '13px', maxWidth: '320px', lineHeight: '1.6' }}>
          Interactive 3D constellation. <br/>
          <strong>Dim 1-3:</strong> Semantic Coordinate Projection.<br/>
          <strong>Dim 4:</strong> Macro-orbital drift.<br/>
          <strong>Dim 5:</strong> Localized conceptual jitter.<br/>
          <em>Drag to rotate. <strong>Click stars to select for synthesis</strong>. Click tethers to read report.</em>
        </p>
      </div>

      {hoveredData && (
          <div style={{ 
              position: 'absolute', bottom: '24px', right: '24px', zIndex: 10, 
              background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)',
              border: `1px solid ${hoveredData.color ? '#' + hoveredData.color.toString(16).padStart(6, '0') : '#10b981'}`,
              padding: '20px', borderRadius: '8px', maxWidth: '340px', pointerEvents: 'none',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
              {hoveredData.category ? (
                  <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ 
                              fontSize: '10px', 
                              background: `rgba(${hoveredData.color >> 16}, ${(hoveredData.color >> 8) & 255}, ${hoveredData.color & 255}, 0.2)`,
                              color: '#' + hoveredData.color.toString(16).padStart(6, '0'), 
                              padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' 
                          }}>
                              {hoveredData.category}
                          </span>
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '16px', lineHeight: '1.4' }}>{hoveredData.title}</h4>
                      <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#38bdf8', fontWeight: 'bold' }}>Click to select for synthesis</p>
                      <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                         <span>Dim 4 (Orbit): {(hoveredData.orbitSpeed * 100).toFixed(1)}</span>
                         <span>Dim 5 (Jitter): {hoveredData.jitterSpeed.toFixed(1)}</span>
                      </div>
                  </>
              ) : (
                  <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              ⚡ Synthesis Tether
                          </span>
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc', fontSize: '16px', lineHeight: '1.4' }}>{hoveredData.title}</h4>
                      <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>Click this energy link to read the comparative analysis.</p>
                  </>
              )}
          </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(56, 189, 248, 0); }
          100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
        }
      `}</style>
    </div>
  );
}