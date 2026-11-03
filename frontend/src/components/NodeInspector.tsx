"use client";

import React, { useMemo } from "react";
import { 
  BookOpen, 
  FileText, 
  Layers, 
  Share2, 
  Sparkles, 
  ArrowRight,
  Search,
  X
} from "lucide-react";

interface NodeInspectorProps {
  selectedNode: any;
  communities: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  allNodes: any[];
  allLinks: any[];
  onSelectNode: (node: any) => void;
}

export default function NodeInspector({
  selectedNode,
  communities,
  searchQuery,
  setSearchQuery,
  allNodes = [],
  allLinks = [],
  onSelectNode,
}: NodeInspectorProps) {
  const filteredNodes = searchQuery
    ? (allNodes || []).filter((n: any) =>
        (n.label || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.community || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allNodes || [];

  // Calculate connected nodes and the relationship description
  const connectedLinks = useMemo(() => {
    if (!selectedNode || !allLinks) return [];
    const nodeId = selectedNode.id;
    const nodeMap = new Map((allNodes || []).map((n) => [n.id, n]));

    return allLinks
      .filter((link) => {
        const sId = typeof link.source === "object" ? link.source.id : link.source;
        const tId = typeof link.target === "object" ? link.target.id : link.target;
        return sId === nodeId || tId === nodeId;
      })
      .map((link) => {
        const sId = typeof link.source === "object" ? link.source.id : link.source;
        const tId = typeof link.target === "object" ? link.target.id : link.target;
        const isOutgoing = sId === nodeId;
        const otherId = isOutgoing ? tId : sId;
        const otherNode = nodeMap.get(otherId);
        return {
          otherNode,
          otherId,
          relation: link.relation || "connects_to",
          isOutgoing,
        };
      })
      .filter((item) => item.otherNode);
  }, [selectedNode, allLinks, allNodes]);

  return (
    <aside className="w-full h-full flex flex-col bg-slate-900 border-l border-slate-800 text-slate-100 select-text overflow-hidden">
      {/* Sticky Search Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search concepts or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Single-Scrollable Body with generous bottom padding */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 scrollbar-thin scrollbar-thumb-slate-700">
        {selectedNode ? (
          <div className="space-y-4">
            {/* Header: Node Title & Badges */}
            <div className="pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-white tracking-wide"
                  style={{
                    backgroundColor: `${selectedNode.color || "#10b981"}33`,
                    border: `1px solid ${selectedNode.color || "#10b981"}`,
                  }}
                >
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  {selectedNode.community || "Study Module"}
                </span>

                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                  {selectedNode.type === "module_root" ? "Central Module Hub" : selectedNode.type || "Concept"}
                </span>
              </div>

              <h2 className="text-base font-bold text-white tracking-tight leading-snug">
                {selectedNode.label}
              </h2>
            </div>

            {/* Source Module Info */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center text-slate-400 gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-slate-300">Source Lecture Slide / Document:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedNode.file_names && selectedNode.file_names.length > 0
                  ? selectedNode.file_names
                  : [selectedNode.source || "Lecture Note"]
                ).map((fn: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-slate-800 text-slate-200 px-2 py-1 rounded-md text-[11px]"
                  >
                    📄 {fn}
                  </span>
                ))}
              </div>
            </div>

            {/* Extracted Study Material & Content (Expansive view for studying) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>Extracted Study Material:</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-200 leading-relaxed space-y-3 shadow-inner">
                {selectedNode.content ? (
                  selectedNode.content.split("\n\n").map((para: string, pIdx: number) => {
                    const isHeading = para.startsWith("###") || para.startsWith("####");
                    if (isHeading) {
                      return (
                        <h4 key={pIdx} className="text-xs font-bold text-emerald-300 pt-1 border-b border-slate-800/80 pb-1">
                          {para.replace(/#+\s*/, "")}
                        </h4>
                      );
                    }
                    return (
                      <p key={pIdx} className="text-slate-200 font-normal leading-relaxed">
                        {para}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic">
                    {selectedNode.summary || "No specific study text extracted for this concept."}
                  </p>
                )}
              </div>
            </div>

            {/* Connected Knowledge Points (Tree & Links) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connected Knowledge Points ({connectedLinks.length}):</span>
                </div>
              </div>

              {connectedLinks.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  No linked concepts connected to this node yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedLinks.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectNode(item.otherNode)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.otherNode?.color || "#3b82f6" }}
                          />
                          <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                            {item.otherNode?.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block pl-4 mt-0.5 truncate">
                          {item.relation.replace("MODULE_TOPIC", "🌳 Module Branch").replace("CROSS-MODULE: ", "🌐 Cross-Module: ")}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick 1-Sentence Summary Takeaway */}
            {selectedNode.summary && (
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300 block mb-1">Summary Takeaway:</span>
                {selectedNode.summary}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 px-3 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
            <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-300 mb-1">Knowledge Point Inspector</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Click any concept node or central module hub in the graph to inspect the extracted lecture notes and linked terms.
            </p>
          </div>
        )}

        {/* All Concepts Explorer List */}
        {allNodes && allNodes.length > 0 && (
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                All Concepts ({filteredNodes.length})
              </h4>
            </div>
            <div className="space-y-1">
              {filteredNodes.map((node: any) => (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    selectedNode?.id === node.id
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "text-slate-300 hover:bg-slate-800/80 bg-slate-950/40 border border-slate-900"
                  }`}
                >
                  <span className="truncate">{node.label}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 ml-2"
                    style={{ backgroundColor: node.color || "#3b82f6" }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Domain Communities Footer */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-[10px] font-semibold text-slate-400 mb-2 tracking-wider uppercase">
            Knowledge Modules & Domains
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {communities.map((c: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate max-w-[150px]">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
