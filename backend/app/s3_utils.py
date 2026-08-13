import os
import json
import uuid
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# This defaults to the bucket name defined in your Streamlit IAM policy
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "scholarly-sage-s3")
s3_client = boto3.client('s3')

def save_research_report(report_data: dict) -> str:
    """
    Saves a structured 2-page research report and graph nodes to S3.
    """
    report_id = str(uuid.uuid4())
    report_data["report_id"] = report_id
    date_prefix = datetime.now().strftime("%Y/%m/%d")
    
    # Create the S3 object key (e.g., summaries/2026/08/11/rep_uuid.json)
    file_key = f"summaries/{date_prefix}/{report_id}.json"
    
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=file_key,
            Body=json.dumps(report_data, indent=2),
            ContentType='application/json'
        )
        return report_id
    except ClientError as e:
        print(f"Error saving report to S3: {e}")
        return None

def get_research_report(file_key: str) -> dict:
    """
    Retrieves a specific research JSON file from S3 by its exact key.
    """
    try:
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=file_key
        )
        # Decode the byte stream back into a JSON string, then parse it
        file_content = response['Body'].read().decode('utf-8')
        return json.loads(file_content)
    except ClientError as e:
        print(f"Error retrieving report from S3: {e}")
        return {}

def list_research_reports(prefix="") -> list:
    """
    Lists all available research reports across the entire S3 bucket.
    """
    reports = []
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        kwargs = {'Bucket': S3_BUCKET_NAME}
        if prefix:
            kwargs['Prefix'] = prefix
            
        for page in paginator.paginate(**kwargs):
            if "Contents" in page:
                for obj in page["Contents"]:
                    # Exclude non-report metadata files
                    if obj["Key"].endswith(".json") and obj["Key"] != "taxonomy.json":
                        reports.append({
                            "file_key": obj["Key"],
                            "last_modified": obj["LastModified"].isoformat(),
                            "size": obj["Size"]
                        })
        return reports
    except ClientError as e:
        print(f"Error listing reports from S3: {e}")
        return []

def get_master_taxonomy() -> list:
    """Reads the central taxonomy.json file from S3."""
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key="taxonomy.json")
        data = json.loads(response['Body'].read().decode('utf-8'))
        return data.get("categories", [])
    except ClientError:
        # Return a default list if the file doesn't exist yet
        return ["Artificial Intelligence", "Computer Science", "General Research"]

def update_master_taxonomy(new_category: str):
    """Appends a new category to taxonomy.json in S3 if it doesn't already exist."""
    categories = get_master_taxonomy()
    if new_category not in categories:
        categories.append(new_category)
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key="taxonomy.json",
                Body=json.dumps({"categories": categories}, indent=2),
                ContentType='application/json'
            )
        except ClientError as e:
            print(f"Error updating taxonomy in S3: {e}")