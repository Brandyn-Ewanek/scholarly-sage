import streamlit as st
import boto3
import json
import time
from pinecone import Pinecone, ServerlessSpec
from langchain_aws import BedrockEmbeddings

st.set_page_config(page_title="Build Pinecone DB", layout="centered")
st.title("🌲 Build Pinecone Knowledge Graph")
st.write("This script will download your existing JSONs from S3, generate AI embeddings using AWS Titan v2, and push them to your Serverless Pinecone index.")

try:
    s3_client = boto3.client('s3', aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"], region_name=st.secrets["AWS_DEFAULT_REGION"])
    bedrock_client = boto3.client("bedrock-runtime", aws_access_key_id=st.secrets["AWS_ACCESS_KEY_ID"], aws_secret_access_key=st.secrets["AWS_SECRET_ACCESS_KEY"], region_name=st.secrets["AWS_DEFAULT_REGION"])
    
    # UPDATED: Using Titan v2 model identifier
    embeddings = BedrockEmbeddings(client=bedrock_client, model_id="amazon.titan-embed-text-v2:0")
    
    pc = Pinecone(api_key=st.secrets["PINECONE_API_KEY"])
    index_name = "scholarly-sage"
except KeyError as e:
    st.error(f"Missing Secret: {e}. Please check your `.streamlit/secrets.toml` file.")
    st.stop()

if st.button("🚀 Start Pinecone Ingestion"):
    with st.status("Initializing Pinecone & Fetching S3 Data...", expanded=True) as status:
        try:
            st.write("Checking Pinecone Index...")
            if index_name not in pc.list_indexes().names():
                # UPDATED: Dimension changed to 1024 to match Titan v2
                pc.create_index(name=index_name, dimension=1024, metric='cosine', spec=ServerlessSpec(cloud='aws', region='us-east-1'))
                while not pc.describe_index(index_name).status['ready']:
                    time.sleep(1)
            
            index = pc.Index(index_name)
            st.write("✅ Pinecone Index Ready.")

            st.write("Locating files in S3 `research/` directory...")
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket="scholarly-sage-s3", Prefix="research/")
            
            vectors_to_upsert = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        if key.endswith('.json'):
                            st.write(f"Processing: {key.split('/')[-1]}")
                            response = s3_client.get_object(Bucket="scholarly-sage-s3", Key=key)
                            data = json.loads(response['Body'].read().decode('utf-8'))
                            
                            topic = data.get("topic", "Unknown")
                            primary = data.get("primary_research", {})
                            title = primary.get("title", "Unknown Title")
                            takeaways = primary.get("takeaways_bullets", "")
                            
                            semantic_text = f"Topic: {topic}\nTitle: {title}\nFindings: {takeaways}"
                            vector_data = embeddings.embed_query(semantic_text)
                            
                            metadata = {"topic": topic, "title": title, "s3_key": key}
                            vectors_to_upsert.append({"id": key, "values": vector_data, "metadata": metadata})

            if vectors_to_upsert:
                st.write(f"🌲 Pushing {len(vectors_to_upsert)} vectors to Pinecone...")
                batch_size = 100
                for i in range(0, len(vectors_to_upsert), batch_size):
                    index.upsert(vectors=vectors_to_upsert[i:i + batch_size])
                status.update(label=f"✅ Successfully vectorized and uploaded {len(vectors_to_upsert)} papers to Pinecone!", state="complete")
            else:
                status.update(label="No JSON files found in S3.", state="error")
                
        except Exception as e:
            status.update(label=f"❌ Error: {str(e)}", state="error")