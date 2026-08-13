import streamlit as st
import boto3
from langchain_aws import ChatBedrock
from agent_engine import parse_agent_command, get_saved_papers_count

import plotly.express as px
from pinecone import Pinecone
import pandas as pd
from sklearn.decomposition import PCA

# 1. Page Configuration
st.set_page_config(page_title="SAGE Research Terminal", layout="wide", page_icon="⚛️")

# 2. Custom CSS
st.markdown("""
<style>
    .block-container { padding-top: 2rem !important; padding-bottom: 1rem !important; }
    header { visibility: hidden; }
    .stApp { background-color: #0b1121; color: #ffffff; }
    [data-testid="stSidebar"] { background-color: #050b14; border-right: 1px solid #1e293b; }
    [data-testid="stSidebar"] p, [data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3, [data-testid="stSidebar"] span { color: #ffffff !important; }
    
    .metric-container { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px; }
    .metric-card { background-color: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 15px 20px; flex: 1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .metric-title { color: #cbd5e1; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
    .metric-value { font-size: 1.5rem; font-weight: bold; }
    .text-green { color: #10b981; } .text-blue { color: #3b82f6; } .text-purple { color: #8b5cf6; }
    .stTextInput input { background-color: #0f172a; color: #ffffff; border: 1px solid #1e293b; border-radius: 8px; }
    .report-card { background-color: #111827; border: 1px solid #1e293b; border-radius: 10px; padding: 25px; margin-top: 20px; }
    .contrary-box { border: 1px solid #e11d48; background-color: rgba(225, 29, 72, 0.05); border-radius: 8px; padding: 15px; margin-top: 20px; }
    .contrary-title { color: #fb7185; font-weight: bold; margin-bottom: 10px; font-size: 1.1rem; }
    
    /* Make tabs look modern */
    .stTabs [data-baseweb="tab-list"] { gap: 24px; background-color: transparent; }
    .stTabs [data-baseweb="tab"] { color: #94a3b8; font-size: 1.1rem; padding: 10px 0; }
    .stTabs [aria-selected="true"] { color: #3b82f6 !important; }
</style>
""", unsafe_allow_html=True)

# 3. Initialize Clients
@st.cache_resource
def get_s3_client():
    return boto3.client('s3', aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"], region_name=st.secrets["AWS_DEFAULT_REGION"])

@st.cache_resource
def get_llm():
    return ChatBedrock(model_id="us.anthropic.claude-sonnet-4-5-20250929-v1:0", aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"], region_name=st.secrets["AWS_DEFAULT_REGION"])

s3_client = get_s3_client()
llm = get_llm()

# 4. Sidebar UI
with st.sidebar:
    st.markdown("## ⚛️ SAGE")
    st.markdown("---")
    st.markdown("💻 **Research Terminal**")
    st.markdown("🕸️ **Knowledge Graph**")
    st.markdown("💾 **Saved Papers**")

# 5. Top Metric Cards
papers_saved = get_saved_papers_count(s3_client)
st.markdown(f"""
<div class="metric-container">
    <div class="metric-card"><div class="metric-title">Active Agents</div><div class="metric-value text-green">Claude 4.5 Sonnet</div></div>
    <div class="metric-card"><div class="metric-title">Papers Saved</div><div class="metric-value text-blue">{papers_saved}</div></div>
    <div class="metric-card"><div class="metric-title">System Status</div><div class="metric-value text-purple">Nominal</div></div>
</div>
""", unsafe_allow_html=True)

# 6. TABS: Terminal vs. Knowledge Graph
tab1, tab2 = st.tabs(["📈 Agent Terminal", "🕸️ Knowledge Graph Visualization"])

# --- TAB 1: The Terminal ---
with tab1:
    user_query = st.text_input("", placeholder="Enter Command (random, list, relate [topic], contrary [topic], or [topic])")
    if user_query:
        with st.spinner("Engaging SerpApi and Claude 4.5..."):
            agent_response = parse_agent_command(user_query, llm, s3_client)
            st.markdown(agent_response, unsafe_allow_html=True)

# --- TAB 2: The 3D Knowledge Graph ---
with tab2:
    st.markdown("### Semantic Network")
    st.caption("This 3D constellation dynamically maps your saved research. Papers sharing similar topics or themes are pulled physically closer together in space via AI embeddings.")
    
    try:
        pc = Pinecone(api_key=st.secrets["PINECONE_API_KEY"])
        index = pc.Index("scholarly-sage")
        
        # 1. Gather all vector IDs safely using S3 as the source of truth
        id_list = []
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket="scholarly-sage-s3", Prefix="research/")
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    if obj['Key'].endswith('.json'):
                        id_list.append(obj['Key'])
            
        if len(id_list) < 3:
            st.info("Gather at least 3 research papers in the Terminal to map the 3D Knowledge Graph!")
        else:
            with st.spinner("Crunching 1,024 dimensions down to 3..."):
                # 2. Fetch the actual vectors and metadata
                fetch_response = index.fetch(ids=id_list[:1000])
                
                vectors = []
                titles = []
                topics = []
                
                for record_id, record in fetch_response['vectors'].items():
                    vectors.append(record['values'])
                    titles.append(record['metadata'].get('title', 'Unknown'))
                    topics.append(record['metadata'].get('topic', 'Unknown Topic'))
                
                # Failsafe check
                if len(vectors) < 3:
                    st.warning("Not enough valid vectors retrieved from Pinecone to map the graph. Did the initial ingestion succeed?")
                else:
                    # 3. Perform PCA (Dimensionality Reduction)
                    pca = PCA(n_components=3)
                    components = pca.fit_transform(vectors)
                    
                    df = pd.DataFrame({
                        'x': components[:, 0],
                        'y': components[:, 1],
                        'z': components[:, 2],
                        'Title': titles,
                        'Topic': topics
                    })
                    
                    # 4. Render the 3D Interactive Plotly Graph
                    # Specified 'symbol_sequence' to cycle through solid shapes and skip the oversized 'x'
                    fig = px.scatter_3d(
                        df, x='x', y='y', z='z', 
                        color='Topic', 
                        symbol='Topic', 
                        symbol_sequence=['circle', 'square', 'diamond', 'cross'],
                        hover_name='Title',
                        color_discrete_sequence=px.colors.qualitative.Pastel
                    )
                    
                    # Move and style the legend
                    fig.update_layout(
                        scene=dict(
                            xaxis=dict(showbackground=False, showticklabels=False, title='', gridcolor='#1e293b'),
                            yaxis=dict(showbackground=False, showticklabels=False, title='', gridcolor='#1e293b'),
                            zaxis=dict(showbackground=False, showticklabels=False, title='', gridcolor='#1e293b')
                        ),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(0,0,0,0)',
                        margin=dict(l=0, r=0, b=0, t=0),
                        height=600,
                        legend=dict(
                            font=dict(color='#cbd5e1'),
                            yanchor="top",
                            y=0.9,
                            xanchor="left",
                            x=0.85
                        )
                    )
                    
                    st.plotly_chart(fig, use_container_width=True)
                
    except Exception as e:
        st.error(f"Could not render Knowledge Graph. Error: {str(e)}")