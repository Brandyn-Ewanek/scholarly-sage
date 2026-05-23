# SAGE (Scholarly Sage)

The Anti-Doomscrolling Research Terminal & 3D Knowledge Graph

### The Philosophy: Directed Dopamine vs. Doomscrolling

SAGE was built as a conceptual antidote to the modern plague of "doomscrolling."

Social media algorithms are designed to hijack our attention through passive consumption and variable reward schedules. We scroll endlessly hoping to learn something new, but often leave feeling cognitively drained and anxious.

SAGE flips this paradigm by shifting the user from a "Passive Consumer" to an "Active Hunter."

***The Science of the "Hunt"***

Research in cyberpsychology and neuroscience (such as studies on Information Foraging Theory and Self-Determination Theory) highlights a massive difference in how our brains process digital information:

+ **Passive Scrolling**: Correlates strongly with increased cognitive load, anxiety, and depressive symptoms (e.g., Verduyn et al., 2015). It relies on unpredictable external triggers that remove user agency.

+ **Active Information Seeking**: When we actively formulate a question and hunt for the answer, we engage the brain's mammalian "Seeking System" (identified by Jaak Panksepp). This goal-directed behavior releases dopamine not just as a reward, but as motivation during the pursuit.

SAGE provides that same micro-dopamine hit of discovering new information, but grounds it in intentionality, agency, and peer-reviewed science. You aren't being fed what an algorithm wants you to see; you are exploring what you want to know.

Core Features

**Research Terminal**: A command-line style interface that fetches, reads, and distills the latest scientific papers into highly concise, actionable takeaways.

The Agent Terminal provides a distraction-free interface to interact with Claude 4.5 Sonnet and Google Scholar, instantly distilling complex peer-reviewed papers into actionable bullet points.

**Relate & Contrary Discovery**: Built-in agentic commands (relate [topic] or contrary [topic]) that force the AI to break echo chambers by actively hunting for opposing viewpoints and limitations in current science.

**3D Semantic Knowledge Graph**: Every search is vectorized via AWS Titan and plotted in an interactive 3D constellation. Papers with similar themes physically pull closer together in space, allowing you to visualize the connections in your learning journey.

The ***interactive 3D semantic network*** visually clusters related research using Amazon Titan text embeddings and PCA dimensionality reduction, allowing you to see the physical connections between disciplines.

**Cloud-Native Architecture**: Headless integration with AWS S3 (Data Lake) and Pinecone Serverless (Vector Database) for real-time memory.

### System Architecture

The application is built on a serverless, event-driven pipeline that vectorizes and maps scientific text in real-time.

**The SAGE data pipeline**: from Streamlit and SerpApi to AWS Bedrock processing, S3 Data Lake storage, and Pinecone vectorization.

### **Tech Stack**:

+ **Frontend**: Streamlit, Plotly Express (3D Graphing)

+ **LLM Engine**: Anthropic Claude 4.5 Sonnet (via AWS Bedrock)

+ **Embedding Model**: Amazon Titan Text Embeddings V2 (amazon.titan-embed-text-v2:0)

+ **Vector Database**: Pinecone (Serverless)

**Data Lake**: AWS S3

**Search Tooling**: SerpApi (Google Scholar Engine)

Setup & Installation (Local Development)

Clone the repository

git clone [https://github.com/Brandyn-Ewanek/scholarly-sage.git](https://github.com/Brandyn-Ewanek/scholarly-sage.git)
cd scholarly-sage


Create a virtual environment

python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate


Install Dependencies

pip install -r requirements.txt


Environment Variables (Crucial)
Create a .streamlit folder and add a secrets.toml file.
(Note: This repository uses a .gitignore file to ensure API keys are never uploaded to GitHub).

# .streamlit/secrets.toml
AWS_ACCESS_KEY_ID = "your_aws_key"
AWS_SECRET_ACCESS_KEY = "your_aws_secret"
AWS_DEFAULT_REGION = "us-east-1"
SERPAPI_API_KEY = "your_serpapi_key"
PINECONE_API_KEY = "your_pinecone_key"


Run the Application

streamlit run sage-dashboard-streamlit.py


Built for the pursuit of intentional knowledge.