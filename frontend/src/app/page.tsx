"use client";

import React, { useState, useMemo } from "react";
import axios from "axios";
import ForceGraphCanvas from "@/components/ForceGraphCanvas";
import NodeInspector from "@/components/NodeInspector";

// Fallback to environment variable or relative origin for same-domain ALB routing
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

export default function TotoroDashboard() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const communities = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => {
      if (n.community && !map.has(n.community)) {
        map.set(n.community, n.color || "#3b82f6");
      }
    });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [nodes]);

  const graphData = useMemo(() => {
    if (!searchQuery) return { nodes, links };
    const filteredNodes = nodes.filter(
      (n) =>
        (n.label || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.community || "").toLowerCase().includes(searchQuery.toLowerCase()),
    );
    const validIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = links.filter(
      (l) =>
        validIds.has(typeof l.source === "object" ? l.source.id : l.source) &&
        validIds.has(typeof l.target === "object" ? l.target.id : l.target),
    );
    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, searchQuery]);

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    setLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/extract-graph`,
        formData,
      );
      const rawNodes = res.data.nodes || [];
      const rawEdges = res.data.edges || [];

      const formattedLinks = rawEdges.map((e: any) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
      }));

      setNodes(rawNodes);
      setLinks(formattedLinks);

      if (rawNodes.length > 0) {
        setSelectedNode(rawNodes[0]);
      }

      setIsModalOpen(false);
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 429) {
        showToast(
          "⚠️ AI Token Limit Reached! Switching to local fallback parser.",
        );
      } else {
        showToast("❌ Failed to process document. Verify backend service.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Toast Error Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-500/90 text-white text-xs font-semibold px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-rose-400/30 flex items-center gap-3">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white hover:text-slate-200 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace (Canvas + Header) */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              🌱
            </div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              Totoro{" "}
              <span className="text-xs text-emerald-400 font-mono">
                / Graphify AI
              </span>
            </h1>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            + Upload Study Note
          </button>
        </header>

        {/* Force Graph Interactive Area */}
        <div className="flex-1 relative w-full h-full overflow-hidden">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-sm">
              <div className="max-w-md bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl">
                <div className="text-4xl mb-4">🌿</div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Graphify Knowledge Assistant
                </h2>
                <p className="text-slate-400 text-xs mb-6">
                  Upload a PDF, PowerPoint presentation, or Markdown note to
                  extract knowledge graphs.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all"
                >
                  Upload First Note
                </button>
              </div>
            </div>
          ) : (
            <ForceGraphCanvas
              graphData={graphData}
              onNodeClick={(node) => setSelectedNode(node)}
            />
          )}
        </div>
      </div>

      {/* Fixed Right Sidebar Inspector */}
      <div className="w-80 h-full shrink-0 border-l border-slate-800 bg-slate-900 z-20">
        <NodeInspector
          selectedNode={selectedNode}
          communities={communities}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          allNodes={nodes}
          onSelectNode={(node: any) => setSelectedNode(node)}
        />
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-4">
              Upload Module File
            </h3>
            <input
              type="file"
              accept=".pdf,.pptx,.ppt,.txt,.md"
              onChange={(e) =>
                e.target.files && setSelectedFile(e.target.files[0])
              }
              className="mb-4 text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-slate-800 file:text-slate-200 cursor-pointer"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
              >
                {loading ? "AI Extracting Graph..." : "Generate Graph"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
