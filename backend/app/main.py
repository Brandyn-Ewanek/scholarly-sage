import os
from dotenv import load_dotenv
load_dotenv()  # Loads variables from .env file into environment at startup

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.decomposition import PCA

# Import local utilities from the app directory
from app.s3_utils import (
    save_research_report, 
    get_research_report, 
    list_research_reports, 
    get_master_taxonomy, 
    update_master_taxonomy
)
from app.bedrock_agent import (
    categorize_research, 
    synthesize_comparative_report, 
    analyze_primary_research,
    generate_titan_embedding
)
from app.search_utils import search_google_scholar

app = FastAPI(
    title="Scholarly Sage API",
    description="Backend API for research categorization, graph synthesis, and S3 data lake storage",
    version="2.0.0"
)

# Broadened CORS policy to ensure Vercel can always connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Request Models
class CategorizeRequest(BaseModel):
    topic: str
    keywords: List[str]
    existing_categories: Optional[List[str]] = []

class SynthesizeRequest(BaseModel):
    report_a_key: str
    report_b_key: str

class SaveReportRequest(BaseModel):
    report_data: Dict[str, Any]

class ResearchRequest(BaseModel):
    query: str


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Scholarly Sage API",
        "docs_url": "/docs"
    }


@app.get("/api/reports")
async def list_all_reports(response: Response):
    """
    Lists all available research summaries stored in the S3 bucket.
    Applies PCA to semantic embeddings to generate 3D coordinates.
    """
    # Cache buster to force the browser to always fetch fresh data
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    
    reports = list_research_reports()
    
    full_reports = []
    valid_embeddings = []
    valid_indices = []
    
    for i, r in enumerate(reports):
        # SAFETY NET 1: If a file is completely corrupted, skip it instead of crashing.
        try:
            full_data = get_research_report(r["file_key"])
            if not full_data or not isinstance(full_data, dict):
                print(f"Skipping invalid report format: {r['file_key']}")
                continue
                
            r["full_data"] = full_data
            full_reports.append(r)
            
            # Check if this report has a saved Titan embedding
            embedding = full_data.get("embedding")
            if embedding and isinstance(embedding, list) and len(embedding) > 0:
                valid_embeddings.append(embedding)
                valid_indices.append(len(full_reports) - 1)
        except Exception as e:
            print(f"Failed to load {r.get('file_key')}: {str(e)}")
            continue
            
    # SAFETY NET 2: PCA Crash Protection (Fixes your inhomogeneous shape error!)
    if len(valid_embeddings) >= 3:
        try:
            base_len = len(valid_embeddings[0])
            clean_embeddings = []
            clean_indices = []
            # Only allow embeddings that perfectly match the length of the first one
            for idx, emb in zip(valid_indices, valid_embeddings):
                if len(emb) == base_len:
                    clean_embeddings.append(emb)
                    clean_indices.append(idx)
                    
            if len(clean_embeddings) >= 3:
                # Calculate up to 5 dimensions if we have enough reports
                n_comp = min(5, len(clean_embeddings))
                pca = PCA(n_components=n_comp)
                
                # Convert to numpy array and scale up the coordinates for visual spread
                coords_nd = pca.fit_transform(np.array(clean_embeddings)) * 200
                
                for i, idx in enumerate(clean_indices):
                    full_reports[idx]["pca_coords"] = {
                        "x": float(coords_nd[i][0]),
                        "y": float(coords_nd[i][1]),
                        "z": float(coords_nd[i][2]),
                        "w": float(coords_nd[i][3]) if n_comp > 3 else 0.0,
                        "v": float(coords_nd[i][4]) if n_comp > 4 else 0.0
                    }
        except Exception as e:
            print(f"PCA Dimension Error: {str(e)}")
            
    final_reports = []
    # Clean up full_data so we don't send massive payloads to the frontend
    for r in full_reports:
        # SAFETY NET 3: Protect against missing fields AND wrong data types inside the JSON
        try:
            data = r.get("full_data") or {}
            
            q_type = data.get("query_type")
            
            if not q_type:
                # Ruthless check: Only real searches have a scraped 'primary_paper'. 
                if data.get("source_reports") or "primary_paper" not in data:
                    q_type = "comparative_synthesis"
                else:
                    q_type = "primary_research"

            r["query_type"] = q_type
            r["source_reports"] = data.get("source_reports") or []
            
            if q_type == "comparative_synthesis":
                r["original_query"] = data.get("original_query") or "Comparative Synthesis"
                r["taxonomy"] = {
                    "major_category": "Synthesis Engine",
                    "sub_category": "Cross-Domain"
                }
            else:
                r["original_query"] = data.get("original_query") or "Legacy Report"
                tax = data.get("taxonomy")
                if not isinstance(tax, dict):
                    tax = {}
                r["taxonomy"] = {
                    "major_category": tax.get("major_category") or tax.get("assigned_category") or "General Research",
                    "sub_category": tax.get("sub_category") or "General"
                }
            
            summary = data.get("executive_summary_2page")
            if not isinstance(summary, dict):
                summary = {}
            r["executive_summary_2page"] = {"report_title": summary.get("report_title") or "Untitled Report"}
            
            if "full_data" in r:
                del r["full_data"]
                
            final_reports.append(r)
        except Exception as e:
            print(f"Error parsing metadata for {r.get('file_key')}: {str(e)}")
            continue
            
    return {"reports": final_reports}


@app.get("/api/reports/{file_key:path}")
async def get_single_report(file_key: str):
    """
    Retrieves a specific research report payload from S3 using its key path.
    """
    report = get_research_report(file_key)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found in S3 bucket.")
    return report


@app.post("/api/research")
async def execute_new_research(request: ResearchRequest):
    """
    Searches Google Scholar, runs Bedrock fact/metric extraction, categorizes the topic, and saves JSON to S3.
    """
    try:
        papers = search_google_scholar(request.query)
        if not papers:
            raise HTTPException(status_code=400, detail="No academic papers found for this query or SERPAPI_API_KEY missing.")
        
        combined_text = "\n\n".join([f"Title: {p['title']}\nSnippet: {p['snippet']}\nLink: {p['link']}" for p in papers])
        primary_link = papers[0].get('link', '') if papers else ''
        
        # EXTRACT METRICS
        research_analysis = analyze_primary_research(combined_text, primary_link)
        embedding_vector = generate_titan_embedding(combined_text)
        
        existing_tax = get_master_taxonomy()
        cat_result = categorize_research(request.query, [request.query], existing_tax)
        
        # Fallback in case taxonomy fails
        safe_cat_result = cat_result.get("classification_result") or {}
        assigned_cat = safe_cat_result.get("major_category", "General Research")
        update_master_taxonomy(assigned_cat)
        
        full_report = {
            "query_type": "primary_research",
            "original_query": request.query,
            "primary_paper": papers[0],
            "all_source_papers": papers,
            "taxonomy": safe_cat_result,
            "embedding": embedding_vector,
            **research_analysis
        }
        
        report_id = save_research_report(full_report)
        
        return {
            "status": "success",
            "report_id": report_id,
            "report": full_report
        }
    except Exception as e:
        print(f"CRITICAL ERROR in /api/research: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")


@app.post("/api/categorize")
async def categorize_topic(request: CategorizeRequest):
    """
    Evaluates topic keywords using Claude 3 Haiku to map or generate a major category.
    """
    result = categorize_research(
        topic=request.topic,
        keywords=request.keywords,
        existing_categories=request.existing_categories or []
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to categorize research topic.")
    return result


@app.post("/api/synthesize")
async def synthesize_reports(request: SynthesizeRequest):
    """
    Pulls two report JSONs from S3 and generates a comparative synthesis.
    """
    report_a = get_research_report(request.report_a_key)
    report_b = get_research_report(request.report_b_key)

    if not report_a or not report_b:
        raise HTTPException(status_code=404, detail="One or both selected reports could not be found in S3.")

    synthesis_result = synthesize_comparative_report(report_a, report_b)
    if not synthesis_result:
        raise HTTPException(status_code=500, detail="Failed to generate comparative synthesis.")

    synthesis_payload = {
        "query_type": "comparative_synthesis",
        "source_reports": [request.report_a_key, request.report_b_key],
        **synthesis_result
    }

    saved_id = save_research_report(synthesis_payload)
    
    return {
        "status": "success",
        "report_id": saved_id,
        "synthesis": synthesis_payload
    }


@app.post("/api/save-report")
async def save_new_report(request: SaveReportRequest):
    """
    Endpoint to manually save a new research report dictionary directly to S3.
    """
    report_id = save_research_report(request.report_data)
    if not report_id:
        raise HTTPException(status_code=500, detail="Failed to save report to S3.")
    return {"status": "success", "report_id": report_id}