import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function GraphView({ reports, onSelectReport }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-2, -2)); 
  
  const hoveredNodeRef = useRef(null); 
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // 1. Filter out Nodes (Primary Research)
  const nodesData = useMemo(() => {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return [];

    return reports.filter(r => r.query_type !== 'comparative_synthesis').map((r, i) => {
      const filename = r.file_key.split('/').pop().replace('.json', '');
      const title = r.executive_summary_2page?.report_title || filename.replace(/-/g, ' ');
      const majorCategory = r.taxonomy?.major_category || 'General Research';
      const subCategory = r.taxonomy?.sub_category || 'General';
      const query = r.original_query || 'Unknown Query';
      
      // The Golden Angle Math for vibrant colors
      const GOLDEN_ANGLE = 137.5;
      let sum = 0;
      for (let j = 0; j < majorCategory.length; j++) {
          sum += majorCategory.charCodeAt(j);
      }
      const hue = (sum * GOLDEN_ANGLE) % 360;

      let lightSum = 0;
      for (let j = 0; j < subCategory.length; j++) {
          lightSum += subCategory.charCodeAt(j);
      }
      const lightness = 0.45 + ((lightSum % 25) / 100); 

      const colorObj = new THREE.Color().setHSL(hue / 360, 0.85, lightness);
      const hexColor = colorObj.getHex();

      const nodeSize = Math.min(Math.max((r.size / 1024) * 0.225, 0.9), 3.6);

      let baseX, baseY, baseZ;
      if (r.pca_coords) {
          baseX = r.pca_coords.x; baseY = r.pca_coords.y; baseZ = r.pca_coords.z;
      } else {
          const clusterSpread = 150; 
          baseX = (Math.random() - 0.5) * clusterSpread;
          baseY = (Math.random() - 0.5) * clusterSpread;
          baseZ = (Math.random() - 0.5) * clusterSpread;
      }

      const orbitSpeed = 0.001 + Math.random() * 0.003;
      const orbitPhase = Math.random() * Math.PI * 2;
      const jitterSpeed = 0.05 + Math.random() * 0.1;
      const jitterAmplitude = 1 + Math.random() * 3;
      const jitterPhases = { x: Math.random() * Math.PI * 2, y: Math.random() * Math.PI * 2, z: Math.random() * Math.PI * 2 };

      return {
        id: r.file_key, title, category: majorCategory, subCategory, query, size: nodeSize, color: hexColor,
        basePos: new THREE.Vector3(baseX, baseY, baseZ), orbitSpeed, orbitPhase, jitterSpeed, jitterAmplitude, jitterPhases, userData: r
      };
    });
  }, [reports]);

  // 2. Filter out Edges (Comparative Synthesis)
  const edgesData = useMemo(() => {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return [];
    
    return reports.filter(r => r.query_type === 'comparative_synthesis').map(r => {
        const title = r.executive_summary_2page?.report_title || "Comparative Synthesis Report";
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
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.FogExp2('#020617', 0.002);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
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
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); 
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 1000); 
    pointLight.position.set(200, 200, 200);
    scene.add(pointLight);

    // --- BUILD NODES ---
    const nodeMeshes = [];
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    nodesData.forEach(data => {
      const material = new THREE.MeshStandardMaterial({
        color: data.color, emissive: data.color, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.8
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.scale.setScalar(data.size);
      
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: data.color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
      });
      const glow = new THREE.Mesh(geometry, glowMaterial);
      glow.scale.setScalar(1.2); 
      sphere.add(glow);

      sphere.position.copy(data.basePos);
      sphere.userData = { id: data.id, isNode: true, ...data }; 
      scene.add(sphere);
      nodeMeshes.push(sphere);
    });

    // --- BUILD TETHERS (SMOKE + PARTICLES) ---
    const edgeObjects = [];
    
    edgesData.forEach(edge => {
        const sourceMesh = nodeMeshes.find(m => m.userData.id === edge.sourceId);
        const targetMesh = nodeMeshes.find(m => m.userData.id === edge.targetId);
        if (!sourceMesh || !targetMesh) return; // Skip if nodes were deleted

        // 1. The Smoky Line
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xe056fd, // Bright Neon Purple
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            linewidth: 2
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([sourceMesh.position, targetMesh.position]);
        const line = new THREE.Line(lineGeo, lineMat);
        
        // Make the line interactive for clicking
        line.userData = { id: edge.id, isEdge: true, title: edge.title, sourceMesh, targetMesh };
        scene.add(line);

        // 2. The Spiritual Energy Particles
        const particles = [];
        const pGeo = new THREE.SphereGeometry(0.5, 16, 16);
        const pMat = new THREE.MeshBasicMaterial({ 
            color: 0xffa502, // Bright Neon Orange/Yellow
            transparent: true, 
            opacity: 0.8, 
            blending: THREE.AdditiveBlending 
        });
        
        // Spawn 6 particles spaced out along the path
        for(let i=0; i<6; i++) {
            const p = new THREE.Mesh(pGeo, pMat);
            p.userData = { phase: i * (1/6) }; // Spread them evenly
            scene.add(p);
            particles.push(p);
        }

        edgeObjects.push({ line, particles, sourceMesh, targetMesh, id: edge.id });
    });

    // We increase line threshold so users don't have to click perfectly on a pixel
    raycasterRef.current.params.Line.threshold = 4;

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Animate Nodes
      nodeMeshes.forEach(mesh => {
        const d = mesh.userData;
        const orbitAngle = time * d.orbitSpeed + d.orbitPhase;
        const radius = Math.sqrt(d.basePos.x * d.basePos.x + d.basePos.z * d.basePos.z);
        
        const currentX = Math.cos(orbitAngle) * radius;
        const currentZ = Math.sin(orbitAngle) * radius;
        const currentY = d.basePos.y;

        const jx = Math.sin(time * d.jitterSpeed + d.jitterPhases.x) * d.jitterAmplitude;
        const jy = Math.cos(time * d.jitterSpeed + d.jitterPhases.y) * d.jitterAmplitude;
        const jz = Math.sin(time * d.jitterSpeed * 1.2 + d.jitterPhases.z) * d.jitterAmplitude;

        mesh.position.set(currentX + jx, currentY + jy, currentZ + jz);

        if (hoveredNodeRef.current === d.id) {
            mesh.material.emissiveIntensity = 1.2; 
            mesh.children[0].material.opacity = 0.8; 
            mesh.scale.setScalar(d.size * 1.3);
        } else {
            mesh.material.emissiveIntensity = 0.6; 
            mesh.children[0].material.opacity = 0.3; 
            mesh.scale.setScalar(d.size);
        }
      });

      // Animate Tethers
      edgeObjects.forEach(edgeObj => {
          const posA = edgeObj.sourceMesh.position;
          const posB = edgeObj.targetMesh.position;
          
          // Move the smoky line to follow the jittering nodes
          const positions = edgeObj.line.geometry.attributes.position.array;
          positions[0] = posA.x; positions[1] = posA.y; positions[2] = posA.z;
          positions[3] = posB.x; positions[4] = posB.y; positions[5] = posB.z;
          edgeObj.line.geometry.attributes.position.needsUpdate = true;

          // Animate the spiritual energy particles flowing back and forth
          edgeObj.particles.forEach(p => {
              p.userData.phase += 0.003; // Travel speed
              if(p.userData.phase > 1) p.userData.phase -= 1;
              
              const t = p.userData.phase;
              // Lerp finds the point on the line between Node A and B
              const currentPos = new THREE.Vector3().copy(posA).lerp(posB, t);
              
              // Add a swirling, chaotic jitter to the particles so they look like energy
              const particleJitter = new THREE.Vector3(
                  Math.sin(time * 3 + t * 20) * 3,
                  Math.cos(time * 4 + t * 20) * 3,
                  Math.sin(time * 5 + t * 20) * 3
              );
              currentPos.add(particleJitter);
              p.position.copy(currentPos);
              
              // Make them pulse in size
              p.scale.setScalar(0.5 + Math.sin(t * Math.PI) * 1.5);
          });

          // Highlight logic for Tethers
          if (hoveredNodeRef.current === edgeObj.id) {
              edgeObj.line.material.opacity = 0.9;
              edgeObj.line.material.color.setHex(0xffffff); // Flash white when hovered
          } else {
              edgeObj.line.material.opacity = 0.3;
              edgeObj.line.material.color.setHex(0xe056fd);
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
            // We now check intersects against Nodes AND Lines!
            const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children);
            const validIntersects = intersects.filter(i => i.object.userData && i.object.userData.id);

            if (validIntersects.length > 0) {
                // Always prioritize a Node if they overlap
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
        if (hoveredNodeRef.current) {
            onSelectReport(hoveredNodeRef.current);
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
  }, [nodesData, edgesData, onSelectReport]);

  const hoveredData = useMemo(() => {
      let data = nodesData.find(n => n.id === hoveredNodeId);
      if (!data) data = edgesData.find(e => e.id === hoveredNodeId);
      return data;
  }, [nodesData, edgesData, hoveredNodeId]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#020617', overflow: 'hidden' }}>
      
      {/* HUD Overlay */}
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
          <em>Drag to rotate, click nodes or energy tethers to open reports.</em>
        </p>
      </div>

      {/* Hover Info Panel */}
      {hoveredData && (
          <div style={{ 
              position: 'absolute', bottom: '24px', right: '24px', zIndex: 10, 
              background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)',
              border: `1px solid ${hoveredData.color ? '#' + hoveredData.color.toString(16).padStart(6, '0') : '#e056fd'}`,
              padding: '20px', borderRadius: '8px', maxWidth: '340px', pointerEvents: 'none',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
              {hoveredData.category ? (
                  // NODE HOVER
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
                      <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: '16px', lineHeight: '1.4' }}>{hoveredData.title}</h4>
                      <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                         <span>Mass: {hoveredData.size.toFixed(2)} units</span>
                         <span>Jitter: {(hoveredData.jitterAmplitude * 10).toFixed(1)}%</span>
                      </div>
                  </>
              ) : (
                  // TETHER/EDGE HOVER
                  <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '10px', background: 'rgba(224, 86, 253, 0.2)', color: '#e056fd', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              ⚡ Synthesis Tether
                          </span>
                      </div>
                      <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: '16px', lineHeight: '1.4' }}>{hoveredData.title}</h4>
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