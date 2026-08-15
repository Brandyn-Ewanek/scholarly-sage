import os
from dotenv import load_dotenv
load_dotenv()  # Loads variables from .env file into environment at startup

from fastapi import FastAPI, HTTPException
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
async def list_all_reports():
    """
    Lists all available research summaries stored in the S3 bucket.
    Applies PCA to semantic embeddings to generate 3D coordinates.
    """
    reports = list_research_reports()
    
    full_reports = []
    valid_embeddings = []
    valid_indices = []
    
    for i, r in enumerate(reports):
        full_data = get_research_report(r["file_key"])
        r["full_data"] = full_data
        full_reports.append(r)
        
        # Check if this report has a saved Titan embedding
        embedding = full_data.get("embedding")
        if embedding and isinstance(embedding, list) and len(embedding) > 0:
            valid_embeddings.append(embedding)
            valid_indices.append(i)
            
    # If we have at least 3 reports with embeddings, we can run PCA for 3D space
    if len(valid_embeddings) >= 3:
        pca = PCA(n_components=3)
        # Convert to numpy array and scale up the coordinates for visual spread
        coords_3d = pca.fit_transform(np.array(valid_embeddings)) * 200
        
        for idx, coords in zip(valid_indices, coords_3d):
            full_reports[idx]["pca_coords"] = {
                "x": float(coords[0]),
                "y": float(coords[1]),
                "z": float(coords[2])
            }
            
    # Clean up full_data so we don't send massive payloads to the frontend
    for r in full_reports:
        if "full_data" in r:
            # === SMART DETECT FOR LEGACY SYNTHESES ===
            q_type = r["full_data"].get("query_type")
            
            # If the file doesn't explicitly state what it is, figure it out:
            if not q_type:
                if "source_reports" in r["full_data"] or "original_query" not in r["full_data"]:
                    q_type = "comparative_synthesis"
                else:
                    q_type = "primary_research"

            r["query_type"] = q_type
            r["source_reports"] = r["full_data"].get("source_reports", [])
            
            # Intercept missing queries and taxonomies to fix the UI
            if q_type == "comparative_synthesis":
                r["original_query"] = r["full_data"].get("original_query", "Comparative Synthesis")
                r["taxonomy"] = {
                    "major_category": "Synthesis Engine",
                    "sub_category": "Cross-Domain"
                }
            else:
                r["original_query"] = r["full_data"].get("original_query", "Legacy Report")
                tax = r["full_data"].get("taxonomy", {})
                r["taxonomy"] = {
                    "major_category": tax.get("major_category", tax.get("assigned_category", "General Research")),
                    "sub_category": tax.get("sub_category", "General")
                }
            
            summary = r["full_data"].get("executive_summary_2page", {})
            r["executive_summary_2page"] = {"report_title": summary.get("report_title", "")}
            
            del r["full_data"]
            
    return {"reports": full_reports}


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
        
        research_analysis = analyze_primary_research(combined_text)
        embedding_vector = generate_titan_embedding(combined_text)
        
        existing_tax = get_master_taxonomy()
        cat_result = categorize_research(request.query, [request.query], existing_tax)
        
        assigned_cat = cat_result.get("classification_result", {}).get("major_category", "General Research")
        update_master_taxonomy(assigned_cat)
        
        full_report = {
            "query_type": "primary_research",
            "original_query": request.query,
            "primary_paper": papers[0],
            "all_source_papers": papers,
            "taxonomy": cat_result.get("classification_result", {}),
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
    Pulls two report JSONs from S3, generates a 2-page comparative synthesis with graph nodes/edges using Claude 3 Sonnet, and saves the new report back to S3.
    """
    report_a = get_research_report(request.report_a_key)
    report_b = get_research_report(request.report_b_key)

    if not report_a or not report_b:
        raise HTTPException(status_code=404, detail="One or both selected reports could not be found in S3.")

    synthesis_result = synthesize_comparative_report(report_a, report_b)
    if not synthesis_result:
        raise HTTPException(status_code=500, detail="Failed to generate comparative synthesis.")

    # Structure the synthetic report payload
    synthesis_payload = {
        "query_type": "comparative_synthesis",
        "source_reports": [request.report_a_key, request.report_b_key],
        **synthesis_result
    }

    # Save comparative result directly to S3 data lake
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