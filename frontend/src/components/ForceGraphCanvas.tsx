"use client";

import React, { useRef, useEffect } from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface ForceGraphCanvasProps {
  graphData: { nodes: any[]; links: any[] };
  onNodeClick: (node: any) => void;
}

export default function ForceGraphCanvas({
  graphData,
  onNodeClick,
}: ForceGraphCanvasProps) {
  const fgRef = useRef<any>(null);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-250);
      fgRef.current.d3Force("link").distance(120);
    }
  }, [graphData]);

  return (
    <div className="w-full h-full bg-slate-950 relative">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#020617"
        nodeRelSize={8}
        nodeVal={(node: any) => node.degree || 3}
        nodeColor={(node: any) => node.color || "#3b82f6"}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.label || node.id;
          const fontSize = 12 / globalScale;
          const radius = Math.max(6, (node.degree || 2) * 2.5);

          // Draw Glowing Circle Node
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || "#3b82f6";
          ctx.shadowColor = node.color || "#3b82f6";
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.lineWidth = 1.5 / globalScale;
          ctx.strokeStyle = "#ffffff88";
          ctx.stroke();

          // Draw Text Label below node
          ctx.shadowBlur = 0;
          ctx.font = `${fontSize}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "#e2e8f0";
          ctx.fillText(label, node.x, node.y + radius + 4);
        }}
        linkLabel={(link: any) => link.relation || ""}
        linkColor={() => "#334155"}
        linkWidth={1.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => "#10b981"}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
