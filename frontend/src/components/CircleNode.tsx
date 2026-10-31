import React from "react";
import { Handle, Position } from "@xyflow/react";

export default function CircleNode({ data }: any) {
  const size = Math.max(36, Math.min(64, (data.degree || 1) * 10 + 28));

  return (
    <div className="flex flex-col items-center group cursor-pointer">
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: data.color || "#3b82f6",
          boxShadow: `0 0 15px ${data.color}66`,
        }}
        className="rounded-full border-2 border-white/40 flex items-center justify-center transition-all transform group-hover:scale-110"
      >
        <span className="text-white text-[10px] font-bold select-none truncate px-1">
          {data.label.slice(0, 3)}
        </span>
      </div>
      <span className="mt-1 text-[11px] font-medium text-slate-200 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800 backdrop-blur-sm whitespace-nowrap">
        {data.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
