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
      // Adjust forces for a tree-like radial layout with collision avoidance
      fgRef.current.d3Force("charge")?.strength(-380);
      fgRef.current.d3Force("link")?.distance((link: any) => {
        return link.relation === "MODULE_TOPIC" ? 110 : 80;
      });
    }
  }, [graphData]);

  return (
    <div className="w-full h-full bg-slate-950 relative">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#020617"
        nodeRelSize={8}
        nodeVal={(node: any) => (node.type === "module_root" ? 16 : node.degree || 3)}
        nodeColor={(node: any) => node.color || "#3b82f6"}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isRoot = node.type === "module_root";
          const label = node.label || node.id;
          const fontSize = Math.max(10, (isRoot ? 13 : 11) / globalScale);
          const radius = isRoot ? 16 : Math.max(7, (node.degree || 2) * 2.2);

          // 1. Draw Outer Halo for Root Nodes
          if (isRoot) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = `${node.color || "#10b981"}66`;
            ctx.lineWidth = 3 / globalScale;
            ctx.stroke();
          }

          // 2. Draw Glowing Circle Node
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || "#3b82f6";
          ctx.shadowColor = node.color || "#3b82f6";
          ctx.shadowBlur = isRoot ? 20 : 10;
          ctx.fill();
          ctx.lineWidth = (isRoot ? 2.5 : 1.5) / globalScale;
          ctx.strokeStyle = "#ffffffdd";
          ctx.stroke();

          // 3. Reset Shadow for text
          ctx.shadowBlur = 0;
          ctx.font = isRoot ? `bold ${fontSize}px Inter, sans-serif` : `${fontSize}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          // 4. Background pill for text legibility
          const textMetrics = ctx.measureText(label);
          const bgWidth = textMetrics.width + (8 / globalScale);
          const bgHeight = fontSize + (4 / globalScale);
          const bgX = node.x - bgWidth / 2;
          const bgY = node.y + radius + (4 / globalScale);

          ctx.fillStyle = "#020617cc"; // Dark translucent pill
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 3 / globalScale);
          } else {
            ctx.rect(bgX, bgY, bgWidth, bgHeight);
          }
          ctx.fill();
          ctx.strokeStyle = "#334155aa";
          ctx.lineWidth = 0.5 / globalScale;
          ctx.stroke();

          // 5. Draw Label Text
          ctx.fillStyle = isRoot ? "#34d399" : "#f1f5f9";
          ctx.fillText(label, node.x, bgY + (2 / globalScale));
        }}
        linkLabel={(link: any) => link.relation || ""}
        linkColor={(link: any) => {
          if (link.relation?.includes("CROSS")) return "#10b981";
          if (link.relation === "MODULE_TOPIC") return "#334155";
          return "#1e293b";
        }}
        linkWidth={(link: any) => (link.relation?.includes("CROSS") ? 2 : 1.5)}
        linkDirectionalParticles={(link: any) => (link.relation?.includes("CROSS") ? 3 : 1)}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={(link: any) => (link.relation?.includes("CROSS") ? "#34d399" : "#64748b")}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
