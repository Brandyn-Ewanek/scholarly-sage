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
  
  // We use a Ref for the 3D animation loop to prevent React from tearing down the scene,
  // and State for the HTML UI overlay.
  const hoveredNodeRef = useRef(null); 
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const nodesData = useMemo(() => {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return [];

    return reports.map((r, i) => {
      // 1. Extract Real Metadata from S3 Payload
      const filename = r.file_key.split('/').pop().replace('.json', '');
      const title = r.executive_summary_2page?.report_title || filename.replace(/-/g, ' ');
      const category = r.taxonomy?.assigned_category || 'General Research';
      const query = r.original_query || 'Unknown Query';
      
      const colors = [0x38bdf8, 0x818cf8, 0x34d399, 0xfbbf24, 0xf472b6, 0xf87171, 0xc084fc, 0x2dd4bf];
      let hash = 0;
      for (let j = 0; j < category.length; j++) {
          hash = category.charCodeAt(j) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % colors.length;

      // 2. Adjust Size (Core size tripled, based on file mass)
      const nodeSize = Math.min(Math.max((r.size / 1024) * 0.225, 0.9), 3.6);

      // 3. DIMENSIONS 1, 2, 3: True Semantic Spatial Coordinates (via Titan PCA)
      let baseX, baseY, baseZ;
      if (r.pca_coords) {
          baseX = r.pca_coords.x;
          baseY = r.pca_coords.y;
          baseZ = r.pca_coords.z;
      } else {
          // Fallback clustering if embeddings are missing
          const clusterSpread = 150; 
          const u = Math.random();
          const v = Math.random();
          const theta = u * 2.0 * Math.PI;
          const phi = Math.acos(2.0 * v - 1.0);
          const radius = Math.cbrt(Math.random()) * clusterSpread; 
          baseX = radius * Math.sin(phi) * Math.cos(theta);
          baseY = radius * Math.sin(phi) * Math.sin(theta);
          baseZ = radius * Math.cos(phi);
      }

      // 4. D4: Macro Movement (Orbit parameters)
      const orbitSpeed = 0.001 + Math.random() * 0.003;
      const orbitPhase = Math.random() * Math.PI * 2;

      // 5. D5: Micro Movement (Jitter parameters)
      const jitterSpeed = 0.05 + Math.random() * 0.1;
      const jitterAmplitude = 1 + Math.random() * 3;
      const jitterPhases = {
        x: Math.random() * Math.PI * 2,
        y: Math.random() * Math.PI * 2,
        z: Math.random() * Math.PI * 2
      };

      return {
        id: r.file_key,
        title,
        category,
        query,
        size: nodeSize,
        color: colors[colorIndex],
        basePos: new THREE.Vector3(baseX, baseY, baseZ),
        orbitSpeed,
        orbitPhase,
        jitterSpeed,
        jitterAmplitude,
        jitterPhases,
        userData: r
      };
    });
  }, [reports]);

  useEffect(() => {
    if (!containerRef.current || nodesData.length === 0) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.FogExp2('#020617', 0.002);
    sceneRef.current = scene;

    // Camera Setup
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000);
    camera.position.set(0, 50, 400); // Slightly elevated angle
    cameraRef.current = camera;

    // Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); 
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 1000); 
    pointLight.position.set(200, 200, 200);
    scene.add(pointLight);

    const nodeMeshes = [];
    const geometry = new THREE.SphereGeometry(1, 32, 32);

    nodesData.forEach(data => {
      const material = new THREE.MeshStandardMaterial({
        color: data.color,
        emissive: data.color,
        emissiveIntensity: 0.6, // Increased base brightness
        roughness: 0.2,
        metalness: 0.8
      });

      const sphere = new THREE.Mesh(geometry, material);
      sphere.scale.setScalar(data.size);
      
      // Much tighter glow material
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: data.color,
        transparent: true,
        opacity: 0.3, // Slightly higher opacity to compensate for smaller size
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const glow = new THREE.Mesh(geometry, glowMaterial);
      glow.scale.setScalar(1.2); // Tightened fit around the solid sphere (was 1.6)
      sphere.add(glow);

      sphere.position.copy(data.basePos);
      sphere.userData = { id: data.id, ...data }; 
      
      scene.add(sphere);
      nodeMeshes.push(sphere);
    });

    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Update positions based on 4D (Orbit) and 5D (Jitter)
      nodeMeshes.forEach(mesh => {
        const d = mesh.userData;
        
        // 4D: Macro Orbit (Rotate around Y axis)
        const orbitAngle = time * d.orbitSpeed + d.orbitPhase;
        const radius = Math.sqrt(d.basePos.x * d.basePos.x + d.basePos.z * d.basePos.z);
        
        const currentX = Math.cos(orbitAngle) * radius;
        const currentZ = Math.sin(orbitAngle) * radius;
        const currentY = d.basePos.y;

        // 5D: Micro Jitter
        const jx = Math.sin(time * d.jitterSpeed + d.jitterPhases.x) * d.jitterAmplitude;
        const jy = Math.cos(time * d.jitterSpeed + d.jitterPhases.y) * d.jitterAmplitude;
        const jz = Math.sin(time * d.jitterSpeed * 1.2 + d.jitterPhases.z) * d.jitterAmplitude;

        mesh.position.set(currentX + jx, currentY + jy, currentZ + jz);

        // Check hover highlight using the Ref (bypasses React state teardown)
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
            const nodeIntersects = intersects.filter(i => i.object.userData && i.object.userData.id);

            if (nodeIntersects.length > 0) {
                const newHoverId = nodeIntersects[0].object.userData.id;
                // Only update if it actually changed
                if (hoveredNodeRef.current !== newHoverId) {
                    hoveredNodeRef.current = newHoverId; 
                    setHoveredNodeId(newHoverId); // Trigger UI update
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
  // ONLY rebuild if nodesData changes, explicitly excluding hoveredNodeId state!
  }, [nodesData, onSelectReport]);

  const hoveredNodeData = useMemo(() => {
      return nodesData.find(n => n.id === hoveredNodeId);
  }, [nodesData, hoveredNodeId]);

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
          <em>Drag to rotate, scroll to zoom.</em>
        </p>
      </div>

      {/* Upgraded Hover Info Panel */}
      {hoveredNodeData && (
          <div style={{ 
              position: 'absolute', 
              bottom: '24px', 
              right: '24px', 
              zIndex: 10, 
              background: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(12px)',
              border: `1px solid #${hoveredNodeData.color.toString(16).padStart(6, '0')}`,
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '340px',
              pointerEvents: 'none',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ 
                      fontSize: '10px', 
                      background: `rgba(${hoveredNodeData.color >> 16}, ${(hoveredNodeData.color >> 8) & 255}, ${hoveredNodeData.color & 255}, 0.2)`,
                      color: '#' + hoveredNodeData.color.toString(16).padStart(6, '0'), 
                      padding: '4px 8px', 
                      borderRadius: '12px',
                      fontWeight: 'bold', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px' 
                  }}>
                      {hoveredNodeData.category}
                  </span>
              </div>
              
              <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontSize: '16px', lineHeight: '1.4' }}>
                  {hoveredNodeData.title}
              </h4>

              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '12px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Original Query</span>
                  <span style={{ fontSize: '13px', color: '#e2e8f0', fontStyle: 'italic' }}>"{hoveredNodeData.query}"</span>
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                 <span>Mass: {hoveredNodeData.size.toFixed(2)} units</span>
                 <span>Jitter: {(hoveredNodeData.jitterAmplitude * 10).toFixed(1)}%</span>
              </div>
          </div>
      )}

      {(!reports || !Array.isArray(reports) || reports.length === 0) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, color: '#64748b', pointerEvents: 'none' }}>
          No research available to map. Run a query first.
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