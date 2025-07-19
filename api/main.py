from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import boto3
from typing import List, Optional
from datetime import datetime

# Initializing FastAPI
app = FastAPI(title="PUPSeek", version="1.0.0", description="API for managing reports and info")

# Adding CORS Middleware for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS Configuration
DYNAMODB_REPORTS_TABLE = os.getenv("DYNAMODB_REPORTS_TABLE", "pitech-reports")
DYNAMODB_RESPONSES_TABLE = os.getenv("DYNAMODB_RESPONSES_TABLE", "pitech-responses")
DYNAMODB_FLAGS_TABLE = os.getenv("DYNAMODB_FLAGS_TABLE", "pitech-flags")
S3_BUCKET = os.getenv("S3_BUCKET", "pitech-uploads-2025")

# Initializing AWS Resources
dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

reports_table = dynamodb.Table(DYNAMODB_REPORTS_TABLE) 
responses_table = dynamodb.Table(DYNAMODB_RESPONSES_TABLE) 
flags_table = dynamodb.Table(DYNAMODB_FLAGS_TABLE) 

# Helper function to generate signed URLs
def generate_presigned_url(image_keys: List[str]) -> List[str]:
    
    signed_urls = []
    for image_key in image_keys:
        try:
            signed_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET, 'Key': image_key},
                ExpiresIn=3600
            )
            signed_urls.append(signed_url)
        except Exception as e:
            print(f"Error generating presigned URL for {image_key}: {e}")
            signed_urls.append("https://{S3_BUCKET}.s3.ap-northeast-1.amazonaws.com/{image_key}")
    
    return signed_urls

# Models
class Reports(BaseModel):
    report_id: str
    type: str
    item_name: str
    description: str
    contact_info: str
    status: str
    photo: List[str] = []
    photo_urls: List[str] = []
    is_surrendered: bool
    management_code: str # encrypted string
    created_at: str
    updated_at: str

class Responses(BaseModel):
    report_id: str
    response_id: str # SK
    name: str
    contact_info: str
    message: str
    created_at: str

class Flags(BaseModel):
    flag_id: str
    report_id: str
    reason: str
    created_at: str

# Schemas
class ReportCreate(BaseModel):
    type: str
    item_name: str
    description: str
    contact_info: str
    photo: Optional[List[str]] = []
    is_surrendered: bool = False

class ReportUpdate(BaseModel):
    item_name: Optional[str]
    description: Optional[str]
    contact_info: Optional[str]
    status: Optional[str]
    photo: Optional[List[str]]
    is_surrendered: Optional[bool]

class ResponseCreate(BaseModel):
    name: str
    contact_info: str
    message: str

class FlagCreate(BaseModel):
    reason: str


# Routes (API Endpoints)
@app.get("/")
async def read_root():
    return {"message": "Welcome to the Lost & Found API!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)