"use client";

import React from "react";

export default function NodeInspector({
  selectedNode,
  communities,
  searchQuery,
  setSearchQuery,
  allNodes,
  onSelectNode,
}: any) {
  const filteredNodes = searchQuery
    ? (allNodes || []).filter((n: any) =>
        (n.label || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allNodes || [];

  return (
    <aside className="w-full h-full p-5 flex flex-col justify-between overflow-y-auto bg-slate-900">
      <div>
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Selected Node Information */}
        {selectedNode ? (
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                Node Info
              </span>
              <h2 className="text-base font-bold text-white mt-1">
                {selectedNode.label}
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>{" "}
                <span className="font-mono text-slate-200">
                  {selectedNode.type || "concept"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Community:</span>{" "}
                <span className="text-emerald-400 font-semibold">
                  {selectedNode.community || "General"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Source:</span>{" "}
                <span className="text-slate-300">
                  {selectedNode.source || "Document"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Degree:</span>{" "}
                <span className="font-mono text-white">
                  {selectedNode.degree || 1}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-300 mb-1">
                Study Notes & Context:
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                {selectedNode.summary || "No study summary provided."}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            👈 Click any node on the graph or list below to inspect.
          </div>
        )}

        {/* Node List Selector */}
        {allNodes && allNodes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              All Concepts ({filteredNodes.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {filteredNodes.map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${selectedNode?.id === node.id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  <span className="truncate">{node.label}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: node.color || "#3b82f6" }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Communities */}
      <div className="pt-4 border-t border-slate-800">
        <h3 className="text-xs font-semibold text-slate-400 mb-2 tracking-wider uppercase">
          Communities
        </h3>
        <div className="space-y-1.5 max-h-28 overflow-y-auto">
          {communities.map((c: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-slate-300"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: c.color }}
              />
              <span className="truncate">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
