# Scholarly Sage

Live Demo: https://scholarly-sage-48x7.vercel.app/

**⚠️ Note on First Load (Cold Start):**

This application utilizes a low-cost, serverless architecture. The FastAPI backend is hosted on Render's free tier, which spins down after 15 minutes of inactivity. Please allow up to 60 seconds for your very first search or library load while the server wakes up. Subsequent requests will be lightning fast!

Scholarly Sage is an AI-powered academic research assistant. It automates the process of scraping recent scientific literature, extracting hard metrics and contrary perspectives using AWS Bedrock (Claude), and mapping the semantic relationships between different research topics in an interactive 3D spatial graph.

### The Science of Epistemic Curiosity

Passive social media scrolling hijacks the brain's reward system using variable reward reinforcement—triggering cheap, unpredictable dopamine spikes that lead to compulsive habits, cognitive fatigue, and shallow attention.

Scholarly Sage is built to engage a different neurobiological mechanism: Epistemic Curiosity.

Neuroscience research—most notably the foundational studies by Kang et al. (2009) and Gruber et al. (2014)—shows that actively seeking specific information to close a knowledge gap activates the exact same dopaminergic reward circuits (like the ventral tegmental area and nucleus accumbens) as physical rewards. However, active learning treats knowledge itself as the intrinsic reward. By instantly synthesizing complex data and visually mapping your research, this tool is designed to deliver a healthier, more sustained dopamine hit driven by genuine discovery, rather than fleeting digital distraction.

## System Architecture

The application is built on a decoupled frontend/backend architecture, utilizing AWS for heavy lifting, vector generation, and data lake storage.

```mermaid
graph TD
    %% Define Nodes
    User((User))
    Vercel[fa:fa-desktop React Frontend<br/>(Vercel)]
    Render[fa:fa-server FastAPI Backend<br/>(Render)]
    Serp[fa:fa-search SerpApi<br/>(Google Scholar)]
    Bedrock[fa:fa-brain AWS Bedrock<br/>(Claude 3 & Titan)]
    S3[(AWS S3<br/>Data Lake)]

    %% Define Connections
    User -->|Interacts| Vercel
    Vercel -->|REST API Calls| Render
    
    %% Backend Logic
    Render -->|1. Scrape Queries| Serp
    Serp -.->|Academic Papers| Render
    
    Render -->|2. Analysis & Embeddings| Bedrock
    Bedrock -.->|JSON Summaries & Vectors| Render
    
    Render -->|3. Read/Write| S3
    S3 -.->|JSON Reports| Render
    
    %% Styling
    classDef frontend fill:#020617,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef backend fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#232F3E;
    classDef external fill:#fff,stroke:#333,stroke-width:2px,color:#333;
    
    class Vercel frontend;
    class Render backend;
    class Bedrock,S3 aws;
    class Serp external;
```

## Dashboard Features

### 1. ⚡ Fast Research

Instant Literature Scraping: Enter any topic, and the backend instantly scrapes the most recent academic papers via SerpApi.

AI Executive Summary: AWS Bedrock (Claude 3) processes the raw text to extract hard metrics, sample sizes, and novel methodologies.

Contrary Perspectives: Automatically highlights findings that defy common assumptions or show conflicting scientific conclusions.

### 2. 📚 Research Library

AWS S3 Data Lake: Every query and analysis is permanently archived as a JSON payload in an AWS S3 bucket.

Dynamic Taxonomy: The AI automatically categorizes your research into one of 20 Master Categories (e.g., Biological & Health Sciences) and generates a highly specific sub-category.

Algorithmic Coloring: Cards are visually distinct, using HSL math and the Golden Angle to map text hashes to vibrant, non-clashing colors based on their category.

### 3. 🌐 5D Knowledge Graph

Semantic Spatial Mapping: Uses Amazon Titan Text v2 to generate 256-dimensional embeddings of your research, which are reduced via PCA to 3D coordinates (X, Y, Z).

Interactive Physics: Built with Three.js. Nodes drift on macro-orbital paths and vibrate with localized conceptual "jitter" to create a living constellation of data.

Comparative Synthesis: Select any two nodes in the graph to trigger Claude to analyze them together, mapping their conceptual intersections and generating a brand new synthesis report.

## 🛠️ Tech Stack

* Frontend: React.js, Three.js (3D Graph), Vercel

* Backend: Python, FastAPI, Render

* AI & Machine Learning: AWS Bedrock (Claude 3.5 Sonnet / Claude 3 Haiku / Titan Embeddings), Scikit-learn (PCA)

* Database / Storage: AWS S3

* Scraping: SerpApi (Google Scholar Engine)