from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
import re
from dotenv import load_dotenv
from markitdown import MarkItDown
from groq import Groq

load_dotenv()

app = FastAPI(title="Totoro Graphify Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "./uploaded_notes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None
md_converter = MarkItDown()

def convert_file_to_markdown(file_path: str) -> str:
    """Converts raw documents to compressed Markdown to minimize token usage."""
    try:
        result = md_converter.convert(file_path)
        return result.text_content.strip()[:4000] # Cap prompt length at 4000 chars (~1000 tokens)
    except Exception as e:
        print(f"MarkItDown conversion error: {e}")
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()[:4000]

@app.post("/api/v1/extract-graph")
async def extract_knowledge_graph(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_note.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 1. Convert document to optimized Markdown
    markdown_content = convert_file_to_markdown(file_path)
    if not markdown_content:
        markdown_content = f"Module content from {filename}"

    prompt = f"""
    Analyze the following Markdown document and extract a Graphify Knowledge Graph.
    Extract 6 to 8 core concepts, relationships, communities, and 1-sentence summaries.

    MARKDOWN CONTENT:
    {markdown_content}

    Return ONLY a JSON object matching this schema:
    {{
      "nodes": [
        {{
          "id": "1",
          "label": "Concept Name",
          "type": "concept",
          "community": "Community Name",
          "color": "#f97316",
          "source": "Doc Section",
          "degree": 3,
          "summary": "Brief 1-sentence summary."
        }}
      ],
      "edges": [
        {{
          "source": "1",
          "target": "2",
          "relation": "EXTRACTED: uses"
        }}
      ]
    }}
    Assign vibrant hex colors (#f97316, #10b981, #3b82f6, #ec4899, #a855f7).
    """

    if groq_client:
        try:
            response = groq_client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=1500
            )
            content = response.choices[0].message.content
            result = json.loads(content)
            result["filename"] = filename
            return result

        except Exception as e:
            err_msg = str(e).lower()
            print(f"Groq API Error: {e}")
            
            # Catch Rate Limits / Token Exhaustion and raise 429 for Next.js Toasting
            if "429" in err_msg or "rate limit" in err_msg or "tokens" in err_msg:
                raise HTTPException(
                    status_code=429,
                    detail="Groq AI Token Limit Reached! Switching to local fallback parser."
                )

    # Fallback response using converted text keywords if API fails or no key set
    words = list(dict.fromkeys([w.strip().capitalize() for w in re.findall(r'\b[A-Za-z]{4,}\b', markdown_content) if w.lower() not in ['this', 'that', 'with', 'from', 'have']]))[:6]
    if len(words) < 3:
        words = ["Architecture", "Components", "Execution Engine", "API Gateway"]

    colors = ["#f97316", "#10b981", "#3b82f6", "#ec4899", "#a855f7"]
    nodes = [{
        "id": str(i+1),
        "label": w,
        "type": "concept",
        "community": f"Unit {(i%3)+1}",
        "color": colors[i % len(colors)],
        "source": f"{filename} Ref #{i+1}",
        "degree": (i % 3) + 2,
        "summary": f"Key study concept '{w}' extracted locally from markdown text."
    } for i, w in enumerate(words)]

    edges = [{
        "source": nodes[i]["id"],
        "target": nodes[(i+1) % len(nodes)]["id"],
        "relation": "EXTRACTED: connects_to"
    } for i in range(len(nodes))]

    return {
        "filename": filename,
        "nodes": nodes,
        "edges": edges,
        "summary": f"Extracted {len(nodes)} core nodes locally from '{filename}'."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)