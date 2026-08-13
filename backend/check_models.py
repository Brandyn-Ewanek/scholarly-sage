import boto3
import os
from dotenv import load_dotenv

# Load your AWS credentials from .env
load_dotenv()

# Connect to your specified region (ca-central-1)
region = os.getenv("AWS_DEFAULT_REGION", "ca-central-1")
client = boto3.client('bedrock', region_name=region)

print(f"\n=== Searching for Claude Models in AWS ({region}) ===")

print("\n1. CROSS-REGION INFERENCE PROFILES (Best for your setup):")
try:
    profiles = client.list_inference_profiles()
    found_profiles = False
    for p in profiles.get('inferenceProfileSummaries', []):
        if 'claude' in p['inferenceProfileId'].lower():
            print(f"   Name: {p['inferenceProfileName']}\n   -> ID: '{p['inferenceProfileId']}'\n")
            found_profiles = True
    if not found_profiles:
        print("   No cross-region profiles found for Claude.")
except Exception as e:
    print(f"   (Could not fetch profiles. Your boto3 library might need an update: {e})")

print("\n2. STANDARD FOUNDATION MODELS:")
try:
    models = client.list_foundation_models()
    for m in models['modelSummaries']:
        if 'claude' in m['modelId'].lower():
            print(f"   Name: {m['modelName']}\n   -> ID: '{m['modelId']}'\n")
except Exception as e:
    print(f"   Error fetching standard models: {e}")
print("====================================================\n")