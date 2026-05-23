import streamlit as st
import random
import json
import uuid
from datetime import datetime
from serpapi import GoogleSearch
import boto3
from pinecone import Pinecone
from langchain_aws import BedrockEmbeddings

def execute_scholar_search(query: str, extra_params: dict = None) -> list:
    """Wrapper for SerpApi Google Scholar engine."""
    params = {
        "engine": "google_scholar",
        "q": query,
        "api_key": st.secrets["SERPAPI_API_KEY"]
    }
    if extra_params:
        params.update(extra_params)
        
    search = GoogleSearch(params)
    results = search.get_dict()
    return results.get("organic_results", [])

def get_saved_papers_count(s3_client) -> int:
    """Counts the total number of JSON files saved in the S3 research/ folder."""
    try:
        count = 0
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket="scholarly-sage-s3", Prefix="research/")
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    if obj['Key'].endswith('.json'):
                        count += 1
        return count
    except Exception as e:
        return 0

def parse_agent_command(user_input: str, llm, s3_client):
    """Core routing engine matching your scientific command protocols."""
    cleaned_input = user_input.strip()
    lowered_input = cleaned_input.lower()
    
    if lowered_input == 'random':
        topic = "Trending Science"
        main_res = execute_scholar_search("highly cited scientific breakthrough")
        cont_res = execute_scholar_search("scientific limitations OR replication failure")
        main_p = random.choice(main_res[:20]) if main_res else {}
        cont_p = random.choice(cont_res[:20]) if cont_res else {}
        if not main_p: return "No trending papers returned from Scholar."
        return generate_structured_research_report(main_p, cont_p, "random", topic, llm, s3_client)

    elif lowered_input == 'list':
        prompt = "Provide a categorized text list mapping the top 5 most highly active medical/scientific research disciplines globally right now based on publication velocity."
        return llm.invoke(prompt).content

    elif lowered_input.startswith('relate '):
        topic = cleaned_input[7:]
        results = execute_scholar_search(topic)
        titles = [doc.get("title", "") for doc in results[:5]]
        prompt = f"Analyze these top research titles on '{topic}': {str(titles)}. List 5 adjacent sub-disciplines or related engineering threads linked to this science."
        return llm.invoke(prompt).content

    else:
        if lowered_input.startswith('contrary '):
            topic = cleaned_input[9:]
            mode = "contrary"
        else:
            topic = cleaned_input
            mode = "topic"
            
        main_res = execute_scholar_search(topic)
        main_p = random.choice(main_res[:5]) if len(main_res) > 0 else (main_res[0] if main_res else {})
        
        cont_query = f'"{topic}" AND (refute OR contrary OR dispute OR "fails to" OR limitation)'
        cont_res = execute_scholar_search(cont_query)
        cont_p = random.choice(cont_res[:3]) if len(cont_res) > 0 else (cont_res[0] if cont_res else {})
        
        if not main_p: return f"No recent papers found for topic: {topic}"
        return generate_structured_research_report(main_p, cont_p, mode, topic, llm, s3_client)

def format_bullets_to_html(text: str) -> str:
    """Forces Markdown bullets into proper HTML list items so they don't squash together."""
    lines = text.split('\n')
    html_out = "<ul style='padding-left: 20px; margin-top: 5px;'>"
    for line in lines:
        cleaned = line.strip()
        # Remove markdown hyphens or asterisks
        if cleaned.startswith('-'): cleaned = cleaned[1:].strip()
        elif cleaned.startswith('*'): cleaned = cleaned[1:].strip()
        
        if len(cleaned) > 2: # Only add if there is actual text
            html_out += f"<li style='margin-bottom: 8px;'>{cleaned}</li>"
    html_out += "</ul>"
    return html_out

def generate_structured_research_report(main_paper: dict, contrary_paper: dict, mode: str, topic: str, llm, s3_client) -> str:
    main_title = main_paper.get("title", "Unknown Title")
    main_link = main_paper.get("link", "#")
    main_snippet = main_paper.get("snippet", "No abstract payload details verified.")
    main_pub_info = main_paper.get("publication_info", {}).get("summary", "")
    
    prompt_main = f"""You are an expert scientific research assistant.
    PRIMARY TOPIC: "{topic}"
    RESEARCH TITLE: {main_title}
    RESEARCH SNIPPET: {main_snippet}
    TASK: Extract 3 to 5 highly concise, actionable TAKEAWAYS from this research. Focus on the core insights and implications rather than just summarizing the abstract.
    STRICT OUTPUT RULES:
    1. Format as a simple markdown list (using -).
    2. RETURN ONLY THE BULLET POINTS.
    3. ABSOLUTELY NO introductory text.
    4. ABSOLUTELY NO concluding notes or disclaimers (Do not use the word "Note:").
    """
    main_findings = llm.invoke(prompt_main).content.strip()
    if "\nNote:" in main_findings: main_findings = main_findings.split("\nNote:")[0].strip()
    
    if contrary_paper and contrary_paper.get("title"):
        cont_title = contrary_paper.get("title", "Unknown Title")
        cont_link = contrary_paper.get("link", "#")
        cont_snippet = contrary_paper.get("snippet", "No abstract available.")
        cont_pub_info = contrary_paper.get("publication_info", {}).get("summary", "")
        
        prompt_contrary = f"""You are an expert scientific research assistant comparing two research papers.
        PRIMARY RESEARCH CLAIM: "{main_title}"
        SECONDARY RESEARCH TITLE: {cont_title}
        SECONDARY SNIPPET: {cont_snippet}
        TASK: Extract 3 to 5 concise TAKEAWAYS from the SECONDARY research that specifically highlight limitations, alternative contexts, contradictory findings, or opposing perspectives to the PRIMARY research claim.
        STRICT OUTPUT RULES:
        1. Format as a simple markdown list (using -).
        2. RETURN ONLY THE BULLET POINTS.
        3. ABSOLUTELY NO introductory text.
        4. ABSOLUTELY NO concluding notes or disclaimers.
        """
        contrary_points = llm.invoke(prompt_contrary).content.strip()
        if "Based on the" in contrary_points: contrary_points = contrary_points.split(":\n")[-1].strip()
    else:
        cont_title = "No contrary research explicitly found."
        cont_link = "#"
        cont_pub_info = ""
        contrary_points = "- Insufficient contrary data found in recent Scholar index for this specific topic."

    # Convert to strict HTML lists before saving/rendering
    html_main_findings = format_bullets_to_html(main_findings)
    html_contrary_points = format_bullets_to_html(contrary_points)

    report_data = {
        "query_type": mode,
        "topic": topic,
        "timestamp": datetime.now().isoformat(),
        "primary_research": {
            "title": main_title, "authors_and_journal": main_pub_info, "url": main_link, "takeaways_bullets": main_findings
        },
        "contrary_research": {
            "title": cont_title, "authors_and_journal": cont_pub_info, "url": cont_link, "perspective_bullets": contrary_points
        }
    }
    
    file_id = str(uuid.uuid4())
    file_key = f"research/{datetime.now().strftime('%Y/%m/%d')}/{file_id}.json"
    
    s3_status_html = ""
    pinecone_status_html = ""
    
    try:
        s3_client.put_object(Bucket="scholarly-sage-s3", Key=file_key, Body=json.dumps(report_data, indent=2), ContentType='application/json')
        s3_status_html = f"<div style='font-size:0.8rem; color:#10b981; margin-bottom:2px;'>✓ Automatically saved to S3: {file_key}</div>"
        
        try:
            pc = Pinecone(api_key=st.secrets["PINECONE_API_KEY"])
            index = pc.Index("scholarly-sage")
            
            bedrock_client = boto3.client("bedrock-runtime", aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"], region_name=st.secrets["AWS_DEFAULT_REGION"])
            embeddings = BedrockEmbeddings(client=bedrock_client, model_id="amazon.titan-embed-text-v2:0")
            
            semantic_text = f"Topic: {topic}\nTitle: {main_title}\nFindings: {main_findings}"
            vector_data = embeddings.embed_query(semantic_text)
            
            metadata = {"topic": topic, "title": main_title, "s3_key": file_key}
            index.upsert(vectors=[{"id": file_key, "values": vector_data, "metadata": metadata}])
            
            pinecone_status_html = f"<div style='font-size:0.8rem; color:#3b82f6; margin-bottom:10px;'>✓ Vector synced to Pinecone Knowledge Graph</div>"
            
        except Exception as pc_e:
            pinecone_status_html = f"<div style='font-size:0.8rem; color:#e11d48; margin-bottom:10px;'>⚠️ Pinecone Sync Failed: {str(pc_e)}</div>"
            
    except Exception as e:
        s3_status_html = f"<div style='font-size:0.8rem; color:#e11d48; margin-bottom:10px;'>⚠️ S3 Save Failed: {str(e)}</div>"

    report_html = f"""
<div class="report-card">
{s3_status_html}
{pinecone_status_html}
<h3 style="color:#3b82f6; margin-top:0; margin-bottom:5px;">Primary Research</h3>
<h4 style="color:#e2e8f0; margin-top:0; margin-bottom:2px; font-size:1.2rem;">{main_title}</h4>
<div style="color:#64748b; font-size:0.85rem; margin-bottom: 8px; font-style: italic;">{main_pub_info}</div>
<a href="{main_link}" target="_blank" style="color:#94a3b8; text-decoration:none; font-size:0.9rem;">📄 View Original Document</a>
<div style="margin-top: 15px; margin-bottom: 25px; max-width: 850px; line-height: 1.7;">
{html_main_findings}
</div>
<div class="contrary-box">
<div class="contrary-title">Contrary Perspective & Limitations</div>
<h4 style="color:#e2e8f0; margin-top:0; margin-bottom:2px; font-size:1.1rem;">{cont_title}</h4>
<div style="color:#fb7185; font-size:0.85rem; margin-bottom: 8px; font-style: italic; opacity: 0.8;">{cont_pub_info}</div>
<a href="{cont_link}" target="_blank" style="color:#fb7185; text-decoration:none; font-size:0.9rem; margin-bottom: 10px; display:inline-block;">📄 View Opposing Document</a>
<div style="max-width: 850px; line-height: 1.7;">
{html_contrary_points}
</div>
</div>
</div>
"""
    return report_html