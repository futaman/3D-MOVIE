"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/** 共通 3D ビューア(Forge のプレビューと Studio のビューポートで共用する最小版)。 */
export function ModelViewer({ url, className }: { url: string | null; className?: string }) {
  return (
    <div className={`panel overflow-hidden ${className ?? ""}`} style={{ minHeight: 320 }}>
      <Canvas camera={{ position: [2.5, 1.8, 2.5], fov: 40 }}>
        <color attach="background" args={["#1e1e24"]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          {url && <Model url={url} />}
          <Environment preset="studio" />
        </Suspense>
        <Grid args={[10, 10]} cellColor="#333" sectionColor="#444" fadeDistance={15} />
        <OrbitControls makeDefault target={[0, 0.8, 0]} />
      </Canvas>
    </div>
  );
}
