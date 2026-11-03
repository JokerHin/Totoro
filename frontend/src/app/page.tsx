"use client";

import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { 
  FileText, 
  Trash2, 
  Upload, 
  Layers, 
  FolderOpen, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import ForceGraphCanvas from "@/components/ForceGraphCanvas";
import NodeInspector from "@/components/NodeInspector";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== "") {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    // If running in local dev (e.g. localhost:3000), target FastAPI backend on port 8000
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    // In production behind ALB ingress, use relative path so ALB routes /api to backend
    return "";
  }
  return "http://localhost:8000";
};

const API_BASE_URL = getApiBaseUrl();

export default function TotoroDashboard() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch initial graph and files from backend database on mount
  const refreshData = async () => {
    try {
      const [graphRes, filesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/graph`).catch(() => ({ data: { nodes: [], edges: [] } })),
        axios.get(`${API_BASE_URL}/api/v1/files`).catch(() => ({ data: [] }))
      ]);

      const rawNodes = graphRes.data.nodes || [];
      const rawEdges = graphRes.data.edges || [];
      const formattedLinks = rawEdges.map((e: any) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
      }));

      setNodes(rawNodes);
      setLinks(formattedLinks);
      setUploadedFiles(filesRes.data || []);

      if (rawNodes.length > 0 && !selectedNode) {
        setSelectedNode(rawNodes[0]);
      }
    } catch (err) {
      console.warn("Could not load initial graph from API:", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
    const query = searchQuery.toLowerCase();
    const filteredNodes = nodes.filter(
      (n) =>
        (n.label || "").toLowerCase().includes(query) ||
        (n.community || "").toLowerCase().includes(query)
    );
    const validIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = links.filter((l) => {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      return validIds.has(sId) && validIds.has(tId);
    });
    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, searchQuery]);

  // Handle multi-file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // Submit multiple files to upload endpoint
  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/v1/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const rawNodes = res.data.nodes || [];
      const rawEdges = res.data.edges || [];
      const formattedLinks = rawEdges.map((e: any) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
      }));

      setNodes(rawNodes);
      setLinks(formattedLinks);
      setUploadedFiles(res.data.files || []);

      if (rawNodes.length > 0) {
        setSelectedNode(rawNodes[rawNodes.length - 1]);
      }

      showToast(`Successfully extracted and linked knowledge from ${selectedFiles.length} file(s)!`, "success");
      setIsUploadModalOpen(false);
      setSelectedFiles([]);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 429) {
        showToast("⚠️ AI Token Limit Reached! Using local parser fallback.", "info");
      } else {
        showToast("❌ Failed to process document. Verify backend connection.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete an uploaded file and purge its unique knowledge points
  const handleDeleteFile = async (fileId: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? All associated knowledge points and study notes will be removed from the graph.`)) {
      return;
    }

    try {
      const res = await axios.delete(`${API_BASE_URL}/api/v1/files/${fileId}`);
      const rawNodes = res.data.nodes || [];
      const rawEdges = res.data.edges || [];

      const formattedLinks = rawEdges.map((e: any) => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
      }));

      setNodes(rawNodes);
      setLinks(formattedLinks);
      setUploadedFiles(res.data.files || []);

      // If deleted node was active, select another remaining node
      if (selectedNode && !rawNodes.some((n: any) => n.id === selectedNode.id)) {
        setSelectedNode(rawNodes.length > 0 ? rawNodes[0] : null);
      }

      showToast(`Removed "${filename}" and its knowledge points.`, "info");
    } catch (err) {
      console.error("Error deleting file:", err);
      showToast("❌ Failed to delete module file.", "error");
    }
  };

  return (
    <main className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden relative">
      {/* Toast Notification Alert */}
      {toast && (
        <div
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 text-xs font-semibold px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-500/40"
              : toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40"
              : "bg-slate-900/90 text-slate-200 border-slate-700"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace (Canvas + Header) */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-inner">
              🌱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-wide">Totoro</h1>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Graphify Study Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Interactive Multi-Module Knowledge Graph & Note Examiner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Manage Files Button */}
            <button
              onClick={() => setIsFilesDrawerOpen(true)}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Modules</span>
              <span className="bg-slate-900 text-slate-300 text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-slate-700">
                {uploadedFiles.length}
              </span>
            </button>

            {/* Upload Notes Button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>+ Upload Notes</span>
            </button>
          </div>
        </header>

        {/* Knowledge Stats Strip */}
        <div className="px-6 py-1.5 bg-slate-950 border-b border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              Active Concepts: <strong className="text-white">{nodes.length}</strong>
            </span>
            <span>
              Cross Links: <strong className="text-emerald-400">{links.length}</strong>
            </span>
            <span>
              Modules: <strong className="text-cyan-400">{uploadedFiles.length}</strong>
            </span>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Click any concept node to inspect extracted content & relationships
          </div>
        </div>

        {/* Force Graph Interactive Canvas */}
        <div className="flex-1 relative w-full h-full overflow-hidden">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 backdrop-blur-sm">
              <div className="max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mx-auto flex items-center justify-center text-3xl">
                  📚
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">
                    Totoro Knowledge Study Graph
                  </h2>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Upload your lecture slides (PDF, PowerPoint PPTX), textbook chapters, or Markdown notes.
                    Totoro extracts keywords, forms knowledge graphs, links related concepts across files, and lets you study inside!
                  </p>
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload First Study Module
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

      {/* Right Sidebar: Rich Study Inspector */}
      <div className="w-96 lg:w-[450px] xl:w-[480px] h-full shrink-0 z-20">
        <NodeInspector
          selectedNode={selectedNode}
          communities={communities}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          allNodes={nodes}
          allLinks={links}
          onSelectNode={(node: any) => setSelectedNode(node)}
        />
      </div>

      {/* Upload Multiple Files Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Upload Module Documents
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFiles([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs text-slate-300 font-medium">
                Select one or multiple lecture notes (PDF, PPTX, PPT, Markdown, TXT):
              </label>

              <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-950/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.pptx,.ppt,.txt,.md,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="multi-file-input"
                />
                <label
                  htmlFor="multi-file-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <FileText className="w-8 h-8 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Click here to browse files
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Supports selecting multiple files at once
                  </span>
                </label>
              </div>

              {/* Selected Files List Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Selected Files ({selectedFiles.length}):
                  </span>
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs"
                    >
                      <span className="truncate text-slate-200">📄 {f.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {(f.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFiles([]);
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={loading || selectedFiles.length === 0}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {loading
                  ? `Extracting & Linking Knowledge...`
                  : `Generate & Link Graph (${selectedFiles.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Uploaded Files / Delete Section Modal */}
      {isFilesDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Uploaded Modules & Documents ({uploadedFiles.length})
                </h3>
              </div>
              <button
                onClick={() => setIsFilesDrawerOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Manage uploaded module documents. Deleting a file will remove all of its associated keywords and study content from the knowledge graph.
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {uploadedFiles.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 bg-slate-950/50 rounded-2xl border border-slate-800/80">
                  No modules uploaded yet. Click "+ Upload Notes" to get started.
                </div>
              ) : (
                uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          📄 {file.filename}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                          {file.file_type || "doc"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Size: {(file.file_size / 1024).toFixed(1)} KB</span>
                        {file.uploaded_at && (
                          <span>Date: {new Date(file.uploaded_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {file.summary && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                          {file.summary}
                        </p>
                      )}
                    </div>

                    {/* Delete File Button */}
                    <button
                      onClick={() => handleDeleteFile(file.id, file.filename)}
                      title="Delete module and its knowledge points"
                      className="p-2 rounded-xl text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/50 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsFilesDrawerOpen(false);
                  setIsUploadModalOpen(true);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                + Add Another Module
              </button>
              <button
                onClick={() => setIsFilesDrawerOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
