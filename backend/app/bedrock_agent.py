import json
import boto3
import re
import os
from botocore.exceptions import ClientError

# 1. Force the region directly to US East (N. Virginia)
aws_region = "us-east-1"
bedrock_client = boto3.client('bedrock-runtime', region_name=aws_region)

# 2. Add the "us." prefix to convert these into valid Inference Profiles
FAST_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
DEEP_MODEL_ID = "us.anthropic.claude-sonnet-4-6"
TITAN_EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0"

def parse_json_response(output_text: str) -> dict:
    """Helper to strip markdown formatting (like ```json) and parse the JSON safely."""
    try:
        # First try direct parsing
        return json.loads(output_text)
    except json.JSONDecodeError:
        # If it fails, try to extract JSON from markdown fences using regex
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', output_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        
        print(f"\n--- BEDROCK JSON PARSE ERROR ---\nRaw output was:\n{output_text}\n--------------------------------\n")
        return {}

def categorize_research(topic: str, keywords: list, existing_categories: list) -> dict:
    """
    Evaluates research keywords and assigns them to one of 20 fixed Major Categories, 
    plus generates a dynamic Sub-Category.
    """
    MASTER_CATEGORIES = [
        "Artificial Intelligence", "Data Science & Analytics", "Longevity & Aging",
        "Biological & Health Sciences", "Genetics & Genomics", "Neuroscience & Cognition",
        "Nutrition & Dietetics", "Veterinary Medicine", "Medical Sciences",
        "Software & Architecture", "Computer Hardware & Systems", "Robotics & Automation",
        "Physics & Mathematics", "Chemistry & Pharmacology", "Environmental & Earth Sciences",
        "Social Sciences & Psychology", "Business & Economics", "Philosophy & Ethics", 
        "Materials Science", "General Research"
    ]

    system_prompt = (
        "You are an expert research librarian. Your job is to classify a new research topic.\n"
        "MANDATORY RULE 1: You MUST choose a `major_category` EXACTLY from this list (no exceptions):\n"
        f"{', '.join(MASTER_CATEGORIES)}\n\n"
        "MANDATORY RULE 2: You must generate a highly specific `sub_category` (e.g., 'Antioxidants', 'AI Routing', 'Feline Disease').\n"
        "You must respond ONLY in valid JSON matching the exact schema requested, with no markdown formatting."
    )
    
    user_message = f"""
    Topic: {topic}
    Keywords: {', '.join(keywords)}
    
    Return a JSON object with this exact structure:
    {{
      "classification_result": {{
        "major_category": "String (Must be from the master list)",
        "sub_category": "String (Specific niche topic)",
        "keywords": ["String"]
      }}
    }}
    """
    
    try:
        response = bedrock_client.converse(
            modelId=FAST_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            system=[{"text": system_prompt}]
        )
        output_text = response["output"]["message"]["content"][0]["text"]
        return parse_json_response(output_text)
    except ClientError as e:
        print(f"Bedrock API error during categorization: {e}")
        return {}

def analyze_primary_research(paper_text: str) -> dict:
    """
    Analyzes a newly scraped academic paper and extracts hard facts, metrics, and mechanisms.
    """
    system_prompt = (
        "You are a Lead Data Scientist and Senior Research Analyst. Your job is to extract HARD FACTS, SPECIFIC METRICS, NOVEL MECHANISMS, and COUNTER-INTUITIVE FINDINGS from academic literature.\n\n"
        "STRICT CONSTRAINTS FOR CONCISENESS (OPTIMIZED FOR 2-MINUTE READ):\n"
        "1. BE EXTREMELY CONCISE. Use punchy, rapid-fire bullet points.\n"
        "2. Maximum 1-2 short sentences per section.\n"
        "3. Generate a catchy, memorable 'report_title' (3-6 words).\n\n"
        "MANDATORY EXTRACTION RULES:\n"
        "1. QUANTIFY EVERYTHING: Always include specific numbers, sample sizes (N=), percentages, or p-values.\n"
        "2. ISOLATE MECHANISMS & DATA: State the exact biological pathway or mathematical formulation.\n"
        "3. HIGHLIGHT SURPRISING RESULTS: Focus heavily on findings that defy common assumptions.\n\n"
        "You must respond ONLY in valid JSON matching the requested schema, with no markdown formatting."
    )
    
    user_message = f"""
    Analyze the following research text:
    {paper_text}
    
    Return a JSON object with this exact structure:
    {{
      "executive_summary_2page": {{
        "report_title": "String",
        "abstract_overview": "String",
        "core_findings": ["String", "String", "String"],
        "methodology_analysis": "String",
        "contrary_perspectives": "String",
        "strategic_implications": "String"
      }},
      "graph_nodes": [
        {{ "id": "String", "label": "String", "type": "String" }}
      ],
      "graph_edges": [
        {{ "source": "String", "target": "String", "relationship": "String" }}
      ]
    }}
    """
    
    try:
        response = bedrock_client.converse(
            modelId=DEEP_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            system=[{"text": system_prompt}]
        )
        output_text = response["output"]["message"]["content"][0]["text"]
        return parse_json_response(output_text)
    except ClientError as e:
        print(f"Bedrock API error during primary analysis: {e}")
        return {}

def synthesize_comparative_report(report_a: dict, report_b: dict) -> dict:
    """
    Takes two saved S3 research JSON payloads and generates a comparative synthesis.
    """
    system_prompt = (
        "You are an expert AI research analyst. You will be provided with two detailed research reports.\n"
        "Your task is to synthesize them into a single comparative analysis.\n\n"
        "STRICT NEGATIVE CONSTRAINTS (WHAT NOT TO DO):\n"
        "1. NEVER use meta-descriptive language such as 'This paper discusses...' or 'Understanding X is essential...'.\n"
        "2. NEVER output generic takeaways. Extract specific DATA, BENCHMARKS, and FINDINGS.\n\n"
        "MANDATORY EXTRACTION RULES:\n"
        "1. QUANTIFY EVERYTHING: Always include specific numbers, sample sizes, percentages, or benchmark scores.\n"
        "2. ISOLATE MECHANISMS & DATA: State the exact process causing the result.\n"
        "3. HIGHLIGHT SURPRISING RESULTS: Focus on findings that defy common assumptions or show conflicting conclusions.\n\n"
        "Extract core concepts and map their relationships as graph nodes and edges.\n"
        "You must respond ONLY in valid JSON matching the provided schema, with no markdown formatting."
    )
    
    user_message = f"""
    Report A:
    {json.dumps(report_a, indent=2)}
    
    Report B:
    {json.dumps(report_b, indent=2)}
    
    Return a JSON object with this exact structure:
    {{
      "executive_summary_2page": {{
        "report_title": "String (Generate a catchy, custom title combining the core concepts of Report A and Report B)",
        "abstract_overview": "String",
        "core_findings": ["String (Must contain hard numbers/metrics)"],
        "methodology_analysis": "String",
        "contrary_perspectives": "String",
        "strategic_implications": "String"
      }},
      "graph_nodes": [
        {{ "id": "String", "label": "String", "type": "String" }}
      ],
      "graph_edges": [
        {{ "source": "String", "target": "String", "relationship": "String" }}
      ]
    }}
    """
    
    try:
        response = bedrock_client.converse(
            modelId=DEEP_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            system=[{"text": system_prompt}]
        )
        output_text = response["output"]["message"]["content"][0]["text"]
        return parse_json_response(output_text)
    except ClientError as e:
        print(f"Bedrock API error during synthesis: {e}")
        return {}

def generate_titan_embedding(text: str) -> list:
    """
    Generates a 256-dimensional semantic vector using Amazon Titan Text v2.
    """
    try:
        # We truncate the text slightly to ensure it fits within Titan's token limit
        request_body = json.dumps({
            "inputText": text[:8000],
            "dimensions": 256,
            "normalize": True
        })
        
        response = bedrock_client.invoke_model(
            modelId=TITAN_EMBEDDING_MODEL,
            body=request_body,
            accept="application/json",
            contentType="application/json"
        )
        
        response_body = json.loads(response.get("body").read())
        return response_body.get("embedding", [])
    except Exception as e:
        print(f"Titan Embedding Error: {e}")
        return []