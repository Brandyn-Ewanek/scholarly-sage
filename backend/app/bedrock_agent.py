import boto3
import json
import os
import re
from botocore.exceptions import ClientError

# Initialize the Bedrock client using the region from your .env
bedrock_client = boto3.client('bedrock-runtime', region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

# Model IDs
DEEP_MODEL_ID = "anthropic.claude-3-sonnet-20240229-v1:0"
FAST_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"
TITAN_MODEL_ID = "amazon.titan-embed-text-v2:0"

def parse_json_response(output_text: str) -> dict:
    """Safely extracts and parses JSON from a Claude response."""
    try:
        match = re.search(r'```json\n(.*?)\n```', output_text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        return json.loads(output_text)
    except Exception:
        try:
            start = output_text.find('{')
            end = output_text.rfind('}') + 1
            return json.loads(output_text[start:end])
        except:
            return {}

def analyze_primary_research(paper_text: str, primary_paper_link: str = "") -> dict:
    """
    Analyzes newly scraped academic papers to extract hard facts, metrics, and mechanisms.
    """
    system_prompt = (
        "You are a Lead Data Scientist and Senior Research Analyst. Your job is to extract HARD FACTS, SPECIFIC METRICS, NOVEL MECHANISMS, and COUNTER-INTUITIVE FINDINGS from academic literature.\n\n"
        "STRICT CONSTRAINTS FOR CONCISENESS AND FORMATTING (OPTIMIZED FOR 2-MINUTE READ):\n"
        "1. BE EXTREMELY CONCISE. Use punchy, rapid-fire bullet points.\n"
        "2. Maximum 1-2 short sentences per section.\n"
        "3. Generate a catchy, memorable 'report_title' (3-6 words).\n"
        "4. Use HTML <b> tags to bold key terms, metrics, and mechanisms to make the text easily scannable. Do NOT escape the brackets (use <b>, not &lt;b&gt;). Do NOT use markdown **.\n\n"
        "MANDATORY EXTRACTION RULES:\n"
        "1. CORE FINDINGS: You MUST extract exactly FOUR (4) distinct core findings. Focus randomly on the most interesting research from the last 5 years first, and then the last 10 years.\n"
        "2. QUANTIFY EVERYTHING: Always include specific numbers, sample sizes (N=), percentages, or p-values if available in the text.\n"
        "3. ISOLATE MECHANISMS & DATA: State the exact biological pathway, architectural framework, or mathematical formulation.\n"
        "4. HIGHLIGHT SURPRISING RESULTS: Focus heavily on findings that defy common assumptions.\n"
        "5. NO META-LANGUAGE: Do not say 'This paper discusses...' Just state the facts.\n\n"
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
        "core_findings": ["String", "String", "String", "String"],
        "methodology_analysis": "String",
        "contrary_perspectives": "String",
        "strategic_implications": "String",
        "primary_link": "{primary_paper_link}"
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
    """Generates a comparative synthesis report mapping conceptual overlaps."""
    system_prompt = (
        "You are an elite Cross-Domain Research Synthesizer. Your job is to analyze two completely distinct research reports and find fascinating conceptual overlaps, shared mechanisms, or stark methodological contrasts.\n"
        "1. Generate a combined, exciting 'report_title' merging both ideas.\n"
        "2. For the 'abstract_overview', you MUST format the string as an HTML unordered list introducing the reports. Example format:\n"
        "<ul><li><b>Report A:</b> [Name & 1 sentence summary]</li><li><b>Report B:</b> [Name & 1 sentence summary]</li><li><b>Synthesis:</b> [1 sentence on how they connect]</li></ul>\n"
        "3. Make the VERY FIRST bullet point in 'core_findings' the most interesting shared mechanism or conceptual overlap between the two reports.\n"
        "4. Focus on structural similarities and opposing philosophies.\n"
        "5. Use standard HTML <b> tags to bold key terms. Do NOT escape the brackets (e.g. use <b> not &lt;b&gt;). Do NOT use markdown **.\n"
        "6. Output ONLY strictly valid JSON matching the requested schema."
    )
    
    user_message = f"""
    Report A: {json.dumps(report_a.get('executive_summary_2page', {}))}
    Report B: {json.dumps(report_b.get('executive_summary_2page', {}))}
    
    Return JSON:
    {{
      "executive_summary_2page": {{
        "report_title": "String",
        "abstract_overview": "String",
        "core_findings": ["String", "String", "String", "String"],
        "methodology_analysis": "String",
        "contrary_perspectives": "String",
        "strategic_implications": "String",
        "primary_link": ""
      }},
      "graph_nodes": [ {{ "id": "String", "label": "String", "type": "String" }} ],
      "graph_edges": [ {{ "source": "String", "target": "String", "relationship": "String" }} ]
    }}
    """
    
    try:
        response = bedrock_client.converse(
            modelId=DEEP_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            system=[{"text": system_prompt}]
        )
        return parse_json_response(response["output"]["message"]["content"][0]["text"])
    except ClientError as e:
        print(f"Bedrock Synthesis error: {e}")
        return {}

def categorize_research(topic: str, keywords: list, existing_categories: list) -> dict:
    """Uses Haiku to map the research to an existing category or create a new one."""
    system_prompt = "You are a scientific taxonomy engine. Return ONLY valid JSON."
    
    user_message = f"""
    Topic: {topic}
    Keywords: {keywords}
    Existing Categories: {existing_categories}
    
    Assign to the most relevant Existing Category. If none fit perfectly, create a new high-level Major Category. Also create a specific Sub-Category.
    
    Return JSON:
    {{
      "classification_result": {{
        "major_category": "String",
        "sub_category": "String",
        "is_new_category": true/false
      }}
    }}
    """
    
    try:
        response = bedrock_client.converse(
            modelId=FAST_MODEL_ID,
            messages=[{"role": "user", "content": [{"text": user_message}]}],
            system=[{"text": system_prompt}]
        )
        return parse_json_response(response["output"]["message"]["content"][0]["text"])
    except ClientError:
        return {"classification_result": {"major_category": "General Research", "sub_category": "General", "is_new_category": False}}

def generate_titan_embedding(text: str) -> list:
    """Generates a semantic vector array using Amazon Titan."""
    try:
        body = json.dumps({"inputText": text[:8000]}) # Titan text limit
        response = bedrock_client.invoke_model(
            body=body,
            modelId=TITAN_MODEL_ID,
            accept='application/json',
            contentType='application/json'
        )
        response_body = json.loads(response.get('body').read())
        return response_body.get('embedding', [])
    except ClientError as e:
        print(f"Titan Embedding Error: {e}")
        return []