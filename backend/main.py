import os
import shutil
import json
import re
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from markitdown import MarkItDown
from groq import Groq

try:
    from database import (
        init_db,
        SessionLocal,
        UploadedFileRecord,
        KnowledgeNodeRecord,
        KnowledgeEdgeRecord
    )
except ImportError:
    from backend.database import (
        init_db,
        SessionLocal,
        UploadedFileRecord,
        KnowledgeNodeRecord,
        KnowledgeEdgeRecord
    )

load_dotenv()

app = FastAPI(title="Totoro Graphify Engine", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploaded_notes")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize Database tables
init_db()

groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key, timeout=2.0, max_retries=0) if groq_api_key and not groq_api_key.startswith("your_") else None
md_converter = MarkItDown()

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def convert_file_to_markdown(file_path: str) -> str:
    """Converts uploaded documents (PDF, PPTX, MD, TXT, etc.) into Markdown text."""
    try:
        result = md_converter.convert(file_path)
        content = result.text_content.strip()
        if content:
            return content
    except Exception as e:
        print(f"MarkItDown conversion error: {e}")

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()
    except Exception as e:
        print(f"Fallback text read error: {e}")
        return ""


def clean_label(label: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9\s\-_(),/&]', '', label).strip()
    return cleaned if len(cleaned) <= 60 else cleaned[:60].strip()


def slugify(text: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return slug or "concept"


VIBRANT_COLORS = ["#f97316", "#3b82f6", "#ec4899", "#8b5cf6", "#06b6d4", "#eab308", "#14b8a6"]

# Boilerplate slide patterns to ignore completely
NOISE_PATTERNS = [
    r'learning\s+outcomes?',
    r'topic\s+learning\s+outcomes?',
    r'contents?\s*(&|\+)?\s*structure',
    r'table\s+of\s+contents?',
    r'recap\s+(from|of)',
    r'what\s+to\s+expect\s+next\s+week',
    r'next\s+week',
    r'review\s+questions?',
    r'questions?\s*(&|\+)?\s*answers?',
    r'let\s+watching\s+video',
    r'topic\s+(&|\+)?\s*structure\s+of\s+the\s+discussion',
    r'key\s+terms?\s+you\s+must\s+be\s+able\s+to\s+use',
    r'key\s+terms?\s+you\s+must\s+be\s+able\s+to',
    r'summary\s+recap',
    r'slide\s+number',
    r'slide\s*‹#›',
    r'things\s+to\s+consider',
    r'what\s+do\s+you\s+need\s+to\s+know',
    r'shall\s+i\s+simply',
    r'overview',
]

def is_noise(text: str) -> bool:
    clean = text.strip().lower()
    if len(clean) < 3 or len(clean) > 80:
        return True
    for p in NOISE_PATTERNS:
        if re.search(p, clean):
            return True
    return False


def clean_study_text(raw_text: str) -> str:
    """Cleans slide numbers, arrows, image tags, and artifacts from study text."""
    text = re.sub(r'<!--.*?-->', '', raw_text)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'Slide\s*‹#›\s*of\s*\d+', '', text)
    text = re.sub(r'^\s*\d+\s*-->\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'#+\s*', '', text)
    text = re.sub(r'[\r\t\x0b]', ' ', text)
    # Deduplicate consecutive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_keywords_tree_heuristically(markdown_text: str, filename: str):
    """
    Extracts a hierarchical tree:
    - Central Module Root node (e.g. Module: Data Center Cooling Systems)
    - Meaningful technical keywords (e.g. HVAC, CRAC, CRAH, Hot Aisle, Cold Aisle)
    - Rich, readable study content without slide boilerplate noise.
    """
    slides = markdown_text.split("<!-- Slide number:")

    # 1. Determine Module Root Title
    module_title = ""
    if len(slides) > 1:
        s1_lines = [l.strip() for l in slides[1].split("\n") if l.strip() and not l.startswith("#") and "slide number" not in l.lower()]
        for line in s1_lines:
            line_clean = re.sub(r'[\*\_\`\x0b]', ' ', line).strip()
            if not is_noise(line_clean) and "ct109" not in line_clean.lower() and len(line_clean) > 5:
                module_title = line_clean
                break

    if not module_title:
        base = os.path.splitext(filename)[0]
        module_title = re.sub(r'^\d+\s*[-_]\s*', '', base).replace("_", " ").title()

    module_title = re.sub(r'[\*\_\`\x0b]', ' ', module_title).strip()
    if len(module_title) > 55:
        module_title = module_title[:55].strip()

    # 2. Extract Golden Concepts & Key Terms
    concepts = []
    seen = set()

    # Priority A: Check for explicit "Key Terms You Must Be Able To Use"
    key_terms_match = re.search(r'#.*Key Terms.*?\n(.*?)(?=<!-- Slide number:|\Z)', markdown_text, re.DOTALL | re.IGNORECASE)
    if key_terms_match:
        kt_block = key_terms_match.group(1)
        for line in kt_block.split("\n"):
            line = line.strip()
            if line and not line.startswith("#") and not is_noise(line) and "assignments" not in line.lower() and "exams" not in line.lower():
                term_clean = re.sub(r'^[-*•\d\.]+\s*', '', line).strip()
                if 2 < len(term_clean) < 70 and term_clean.lower() not in seen:
                    seen.add(term_clean.lower())
                    concepts.append((term_clean, "Core Technical Term"))

    # Priority B: Check for substantive section headings & bold terms across slides
    for slide_idx, slide_text in enumerate(slides[1:], 1):
        lines = [l.strip() for l in slide_text.split("\n") if l.strip()]
        for line in lines:
            if line.startswith("#"):
                header_text = re.sub(r'^#+\s*', '', line).strip()
                header_text = re.sub(r'[\*\_\`]', '', header_text)
                main_part = header_text.split("–")[0].split("-")[0].strip()
                if not is_noise(main_part) and len(main_part) > 3 and main_part.lower() not in seen:
                    seen.add(main_part.lower())
                    concepts.append((main_part, "Architecture Concept"))

            # Bold technical phrases
            bold_matches = re.findall(r'\*\*([^*]{3,45})\*\*', line)
            for bm in bold_matches:
                bm = bm.strip()
                if not is_noise(bm) and bm.lower() not in seen and len(bm) > 3:
                    seen.add(bm.lower())
                    concepts.append((bm, "Key Concept"))

    # Priority C: Specific high-value technical keywords if mentioned in the document
    technical_catalog = [
        "Data Center Purpose",
        "Design Requirements",
        "Design Strategies",
        "Colocation Facility",
        "Physical Design & Construction",
        "Downtime Minimization",
        "Energy Conservation Measures",
        "Heating, ventilation, and air conditioning (HVAC)",
        "Computer Room Air Conditioning (CRAC)",
        "Computer Room Air Handler (CRAH)",
        "Hot Aisle",
        "Cold Aisle",
        "Variable Frequency Drive (VFD)",
        "Coefficient of Performance (COP)",
        "Precision Cooling",
        "3-Tier Architecture",
        "Core Layer",
        "Aggregation Layer",
        "Access Layer",
    ]
    for term in technical_catalog:
        term_clean = term.lower()
        if term_clean not in seen:
            lookup = term.split("(")[0].strip()
            if re.search(r'\b' + re.escape(lookup) + r'\b', markdown_text, re.IGNORECASE):
                seen.add(term_clean)
                concepts.append((term, "Technical Domain"))

    # Select top 6 to 9 valid concepts
    filtered_concepts = []
    for name, ctype in concepts:
        clean_n = clean_label(name)
        if not is_noise(clean_n) and len(clean_n) > 2:
            filtered_concepts.append((clean_n, ctype))
        if len(filtered_concepts) >= 9:
            break

    # If no concepts found, use clean module topics
    if len(filtered_concepts) < 3:
        filtered_concepts = [
            ("Infrastructure Architecture", "Core Topic"),
            ("Design Specifications", "Concept"),
            ("High Availability & Reliability", "Key Factor")
        ]

    # 3. Build Nodes and Central Tree
    root_id = slugify(f"mod-{filename}")
    nodes = []

    # Central Root Node (Module Hub)
    nodes.append({
        "id": root_id,
        "label": f"Module: {module_title}",
        "type": "module_root",
        "community": module_title,
        "color": "#10b981", # Distinct Emerald Central Hub
        "source": filename,
        "degree": len(filtered_concepts) + 2,
        "summary": f"Central module study hub for '{module_title}'.",
        "content": (
            f"### 📚 Module: {module_title}\n\n"
            f"**Source File:** `{filename}`\n\n"
            f"This is the primary study hub for **{module_title}**. "
            f"It branches out into {len(filtered_concepts)} key technical knowledge points. "
            f"Click any connected branch in the knowledge tree to review detailed study explanations, "
            f"hardware configurations, operational mechanics, and exam takeaways."
        )
    })

    edges = []
    for idx, (cname, ctype) in enumerate(filtered_concepts):
        cid = slugify(f"{filename}-{cname}")
        lookup_term = cname.split("(")[0].strip()

        # Find paragraphs referencing this term across slides
        matched_chunks = []
        for slide in slides[1:]:
            if re.search(r'\b' + re.escape(lookup_term) + r'\b', slide, re.IGNORECASE):
                clean_slide = clean_study_text(slide)
                # Keep substantive lines
                valid_lines = [l for l in clean_slide.split("\n") if len(l.strip()) > 15 and not is_noise(l)]
                if valid_lines:
                    matched_chunks.append(" ".join(valid_lines))
                if len(matched_chunks) >= 2:
                    break

        if matched_chunks:
            study_notes = "\n\n".join(matched_chunks)
        else:
            study_notes = (
                f"**{cname}** is a core technical principle covered in **{module_title}**.\n\n"
                f"In data center engineering, this concept defines operational baselines, "
                f"hardware integration, and facility constraints necessary to maintain reliability "
                f"and maximize efficiency."
            )

        nodes.append({
            "id": cid,
            "label": cname,
            "type": ctype,
            "community": module_title,
            "color": VIBRANT_COLORS[idx % len(VIBRANT_COLORS)],
            "source": filename,
            "degree": 3 if idx < 3 else 2,
            "summary": f"Key concept '{cname}' in {module_title}.",
            "content": (
                f"### 🔍 {cname}\n\n"
                f"**Module:** {module_title} (`{filename}`)\n\n"
                f"**Concept Classification:** `{ctype}`\n\n"
                f"#### Study Explanation & Material:\n{study_notes}"
            )
        })

        # Connect keyword to central Module Root Node (Tree Structure!)
        edges.append({
            "source": root_id,
            "target": cid,
            "relation": "MODULE_TOPIC"
        })

        # Interlink closely related sibling terms (e.g. CRAC <-> CRAH, Hot Aisle <-> Cold Aisle)
        if idx > 0 and ("aisle" in cname.lower() or "cra" in cname.lower() or "design" in cname.lower()):
            edges.append({
                "source": nodes[-2]["id"],
                "target": cid,
                "relation": "REL: related_component"
            })

    return nodes, edges


def extract_graph_with_ai_or_fallback(markdown_text: str, filename: str):
    """Uses Groq if available with fast fallback to hierarchical tree extractor."""
    if groq_client:
        prompt = f"""
        Analyze this Markdown document from module '{filename}' and extract a Knowledge Tree.
        The FIRST node MUST be the Central Module Hub (type: "module_root", label: "Module: Title").
        Followed by 6 to 8 core technical concepts, components, or key terms (e.g., HVAC, CRAC, CRAH, Hot Aisle, Cold Aisle, Colocation, etc.).

        STRICT RULE: Do NOT extract presentation boilerplate (e.g. 'Topic Learning Outcomes', 'Contents Structure', 'Recap From Last Lesson', 'Review Questions').
        ONLY extract technical knowledge terms that a student studies for an exam.

        For each concept:
        - label: Clean concept name (e.g. "Computer Room Air Conditioning (CRAC)")
        - content: 3-5 sentences of detailed study notes extracted from the text.
        - edges: Connect each concept to the central module hub.

        DOCUMENT CONTENT:
        {markdown_text[:4000]}

        Return JSON matching:
        {{
          "nodes": [
            {{
              "id": "slug-id",
              "label": "Concept Name",
              "type": "module_root or concept",
              "community": "Domain Name",
              "color": "#10b981",
              "source": "{filename}",
              "degree": 3,
              "summary": "1-sentence summary.",
              "content": "Detailed study content..."
            }}
          ],
          "edges": [
            {{
              "source": "hub-id",
              "target": "concept-id",
              "relation": "MODULE_TOPIC"
            }}
          ]
        }}
        """
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=2200
            )
            data = json.loads(response.choices[0].message.content)
            if "nodes" in data and len(data["nodes"]) >= 3:
                return data.get("nodes", []), data.get("edges", [])
        except Exception as e:
            print(f"Groq API error or offline: {e}")

    # Hierarchical tree extractor
    return extract_keywords_tree_heuristically(markdown_text, filename)


# ==========================================
# API Endpoints
# ==========================================

@app.get("/api/v1/health")
def health_check(db: Session = Depends(get_db)):
    """Health check validating backend and database status."""
    try:
        files_count = db.query(UploadedFileRecord).count()
        nodes_count = db.query(KnowledgeNodeRecord).count()
        return {
            "status": "healthy",
            "database": "connected",
            "files_count": files_count,
            "nodes_count": nodes_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "degraded",
            "database_error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@app.get("/api/v1/files")
def list_uploaded_files(db: Session = Depends(get_db)):
    """Returns list of all uploaded study files/modules."""
    records = db.query(UploadedFileRecord).order_by(UploadedFileRecord.uploaded_at.desc()).all()
    return [
        {
            "id": r.id,
            "filename": r.filename,
            "file_type": r.file_type,
            "file_size": r.file_size,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else "",
            "summary": r.summary
        }
        for r in records
    ]


@app.get("/api/v1/graph")
def get_unified_graph(db: Session = Depends(get_db)):
    """Returns the unified knowledge graph linking concepts across all uploaded files."""
    db_nodes = db.query(KnowledgeNodeRecord).all()
    db_edges = db.query(KnowledgeEdgeRecord).all()

    nodes = [
        {
            "id": n.id,
            "label": n.label,
            "type": n.type,
            "community": n.community,
            "color": n.color,
            "content": n.content,
            "summary": n.summary,
            "source": n.source,
            "degree": n.degree,
            "file_ids": n.file_ids or [],
            "file_names": n.file_names or []
        }
        for n in db_nodes
    ]

    edges = [
        {
            "source": e.source,
            "target": e.target,
            "relation": e.relation,
            "file_ids": e.file_ids or []
        }
        for e in db_edges
    ]

    return {"nodes": nodes, "edges": edges}


def process_single_file(file: UploadFile, db: Session):
    """Processes a single uploaded document, updates DB and connects graph."""
    filename = file.filename or f"uploaded_{datetime.utcnow().timestamp()}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        file.file.seek(0)
    except Exception:
        pass

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    # 1. Parse content to Markdown
    markdown_content = convert_file_to_markdown(file_path)
    if not markdown_content:
        markdown_content = f"# Module: {filename}\nContent for knowledge points extraction."

    # 2. Extract knowledge nodes and relations
    nodes, edges = extract_graph_with_ai_or_fallback(markdown_content, filename)

    # 3. Create or update File Record in DB
    file_record = UploadedFileRecord(
        filename=filename,
        file_type=filename.split(".")[-1].lower() if "." in filename else "doc",
        file_size=file_size,
        uploaded_at=datetime.utcnow(),
        summary=f"Extracted {len(nodes)} study knowledge points linked in a knowledge tree."
    )
    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    file_id = file_record.id

    # 4. Integrate Nodes into Database & Cross-link
    existing_nodes = {n.id: n for n in db.query(KnowledgeNodeRecord).all()}
    existing_labels = {n.label.lower(): n for n in existing_nodes.values()}

    created_node_ids = set()

    for node_data in nodes:
        nid = node_data["id"]
        label = node_data["label"]
        label_lower = label.lower()

        # Check if node already exists by id or label (Cross-module shared concept!)
        matched_node = existing_nodes.get(nid) or existing_labels.get(label_lower)

        if matched_node:
            file_ids = list(matched_node.file_ids or [])
            if file_id not in file_ids:
                file_ids.append(file_id)
            matched_node.file_ids = file_ids

            file_names = list(matched_node.file_names or [])
            if filename not in file_names:
                file_names.append(filename)
            matched_node.file_names = file_names

            if node_data.get("content") and node_data["content"] not in (matched_node.content or ""):
                matched_node.content = (
                    f"{matched_node.content or ''}\n\n"
                    f"**[From {filename}]:**\n{node_data['content']}"
                ).strip()

            matched_node.degree = (matched_node.degree or 1) + 1
            created_node_ids.add(matched_node.id)
        else:
            new_node = KnowledgeNodeRecord(
                id=nid,
                label=label,
                type=node_data.get("type", "concept"),
                community=node_data.get("community", f"{filename.split('.')[0]}"),
                color=node_data.get("color", "#3b82f6"),
                content=node_data.get("content", ""),
                summary=node_data.get("summary", ""),
                source=filename,
                degree=node_data.get("degree", 2),
                file_ids=[file_id],
                file_names=[filename]
            )
            db.add(new_node)
            existing_nodes[nid] = new_node
            existing_labels[label_lower] = new_node
            created_node_ids.add(nid)

    db.commit()

    # 5. Insert intra-file edges
    for edge in edges:
        s = edge["source"]
        t = edge["target"]
        if s in existing_nodes and t in existing_nodes:
            new_edge = KnowledgeEdgeRecord(
                source=s,
                target=t,
                relation=edge.get("relation", "MODULE_TOPIC"),
                file_ids=[file_id]
            )
            db.add(new_edge)

    # 6. Automatic Cross-File Knowledge Point Linking (Graphify concept)
    # Link across modules (e.g. Data Center Design <-> Cooling Systems / Facilities)
    for nid in created_node_ids:
        curr_node = existing_nodes.get(nid)
        if not curr_node:
            continue
        for other_id, other_node in existing_nodes.items():
            if other_id == nid:
                continue
            other_files = set(other_node.file_ids or [])
            if file_id not in other_files:
                c_lbl = curr_node.label.lower()
                o_lbl = other_node.label.lower()

                # Meaningful semantic links between data center modules
                is_related = False
                relation_tag = "CROSS-MODULE: relates_to"

                if ("cool" in c_lbl and "colocation" in o_lbl) or ("cool" in o_lbl and "colocation" in c_lbl):
                    is_related = True
                    relation_tag = "CROSS-MODULE: facility_cooling"
                elif ("hvac" in c_lbl or "crac" in c_lbl) and ("design" in o_lbl or "data center" in o_lbl):
                    is_related = True
                    relation_tag = "CROSS-MODULE: thermal_infrastructure"
                elif ("module" in c_lbl and "module" in o_lbl) and ("data center" in c_lbl and "data center" in o_lbl):
                    is_related = True
                    relation_tag = "CROSS-MODULE: curriculum_track"
                elif any(term in c_lbl and term in o_lbl for term in ["network", "cooling", "security", "tier", "architecture", "power", "facility"]):
                    is_related = True
                    relation_tag = "CROSS-MODULE: infrastructure_link"

                if is_related:
                    cross_edge = KnowledgeEdgeRecord(
                        source=nid,
                        target=other_id,
                        relation=relation_tag,
                        file_ids=[file_id]
                    )
                    db.add(cross_edge)

    db.commit()
    return file_record


@app.post("/api/v1/upload")
async def upload_multiple_files(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    """Uploads one or more module files, extracts knowledge trees and links points together."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    processed_files = []
    for file in files:
        try:
            rec = process_single_file(file, db)
            processed_files.append({"id": rec.id, "filename": rec.filename})
        except Exception as e:
            print(f"Error processing {file.filename}: {e}")

    graph = get_unified_graph(db)
    all_files = list_uploaded_files(db)
    return {
        "status": "success",
        "processed_files": processed_files,
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "files": all_files
    }


@app.post("/api/v1/extract-graph")
async def extract_graph_compat(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Backwards-compatible endpoint for uploading a single file and getting graph."""
    rec = process_single_file(file, db)
    graph = get_unified_graph(db)
    all_files = list_uploaded_files(db)
    return {
        "filename": rec.filename,
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "files": all_files
    }


@app.delete("/api/v1/files/{file_id}")
def delete_uploaded_file(file_id: int, db: Session = Depends(get_db)):
    """
    Deletes an uploaded file.
    All nodes and content exclusive to this file are completely removed.
    Shared nodes have their references updated.
    Orphaned edges are purged, and the updated graph is returned.
    """
    file_record = db.query(UploadedFileRecord).filter(UploadedFileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found.")

    file_path = os.path.join(UPLOAD_DIR, file_record.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: could not delete physical file: {e}")

    all_nodes = db.query(KnowledgeNodeRecord).all()
    deleted_node_ids = set()

    for node in all_nodes:
        file_ids = list(node.file_ids or [])
        if file_id in file_ids:
            file_ids.remove(file_id)
            if len(file_ids) == 0:
                deleted_node_ids.add(node.id)
                db.delete(node)
            else:
                node.file_ids = file_ids
                file_names = list(node.file_names or [])
                if file_record.filename in file_names:
                    file_names.remove(file_record.filename)
                node.file_names = file_names
                node.degree = max(1, (node.degree or 2) - 1)

    db.commit()

    all_edges = db.query(KnowledgeEdgeRecord).all()
    for edge in all_edges:
        if edge.source in deleted_node_ids or edge.target in deleted_node_ids:
            db.delete(edge)
        else:
            edge_file_ids = list(edge.file_ids or [])
            if file_id in edge_file_ids:
                edge_file_ids.remove(file_id)
                if len(edge_file_ids) == 0:
                    db.delete(edge)
                else:
                    edge.file_ids = edge_file_ids

    db.delete(file_record)
    db.commit()

    graph = get_unified_graph(db)
    all_files = list_uploaded_files(db)

    return {
        "status": "success",
        "message": f"File '{file_record.filename}' and its associated knowledge points were removed.",
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "files": all_files
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
