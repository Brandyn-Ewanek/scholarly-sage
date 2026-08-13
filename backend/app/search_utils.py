import os
from serpapi import GoogleSearch

def search_google_scholar(query: str, num_results: int = 3) -> list:
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise ValueError("SERPAPI_API_KEY missing from .env environment file.")
        
    params = {
        "engine": "google_scholar",
        "q": query,
        "as_ylo": 2023,  # Focus on modern, recent papers
        "hl": "en",
        "num": num_results,
        "api_key": api_key
    }
    
    try:
        search = GoogleSearch(params)
        results = search.get_dict()
        organic_results = results.get("organic_results", [])
        
        extracted_papers = []
        for paper in organic_results:
            extracted_papers.append({
                "title": paper.get("title", ""),
                "snippet": paper.get("snippet", ""),
                "link": paper.get("link", ""),
                "publication_info": paper.get("publication_info", {}).get("summary", "")
            })
        return extracted_papers
    except Exception as e:
        print(f"SerpApi Search Error: {e}")
        return []