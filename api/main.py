from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import boto3
import bcrypt
import uuid
from typing import List, Optional
from datetime import datetime
from urllib.parse import urlparse

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

# Shared academic structure = Hardcoded data for demo purposes (Class Directory Page)
academic_structure = {
    "colleges": [
        {
            "name": "CCIS",
            "programs": [
                {
                    "name": "BSIT",
                    "year_levels": [
                        {"year": "1st Year", "sections": ["IT 1-1", "IT 1-1N", "IT 1-2", "IT 1-2N", "IT 1-3", "IT 1-4", "IT 1-5"]},
                        {"year": "2nd Year", "sections": ["IT 2-1", "IT 2-1N", "IT 2-2", "IT 2-2N", "IT 2-3", "IT 2-4", "IT 2-5"]},
                        {"year": "3rd Year", "sections": ["IT 3-1", "IT 3-1N", "IT 3-2", "IT 3-2N", "IT 3-3", "IT 3-4", "IT 3-5"]},
                        {"year": "4th Year", "sections": ["IT 4-1", "IT 4-1N", "IT 4-2", "IT 4-2N", "IT 4-3", "IT 4-4", "IT 4-5"]}
                    ]
                },
                {
                    "name": "BSCS",
                    "year_levels": [
                        {"year": "1st Year", "sections": ["CS 1-1", "CS 1-1N", "CS 1-2", "CS 1-3", "CS 1-4", "CS 1-5"]},
                        {"year": "2nd Year", "sections": ["CS 2-1", "CS 2-1N", "CS 2-2", "CS 2-3", "CS 2-4", "CS 2-5"]},
                        {"year": "3rd Year", "sections": ["CS 3-1", "CS 3-1N", "CS 3-2", "CS 3-3", "CS 3-4", "CS 3-5"]},
                        {"year": "4th Year", "sections": ["CS 4-1", "CS 4-1N", "CS 4-2", "CS 4-3", "CS 4-4", "CS 4-5"]}
                    ]
                }
            ]
        },
        {"name": "COC", "programs": []},
        {"name": "CAL", "programs": []}
    ]
}

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
    flag_count: int = 0

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
    is_surrendered: bool = False
    management_code: str

class ReportUpdate(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    contact_info: Optional[str] = None
    status: Optional[str] = None
    photo: Optional[List[str]] = None
    is_surrendered: Optional[bool] = None

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

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Create a new report
@app.post("/reports", response_model=Reports)
async def submit_report(report: ReportCreate):
    
    if not report.type or not report.description or not report.contact_info or not report.management_code:
        raise HTTPException(status_code=400, detail="Missing required fields: type, description, contact_info, management_code")
    
    report_id = str(uuid.uuid4())
    status = "completed" if report.is_surrendered else "unclaimed"
    timestamp = datetime.utcnow().isoformat()

    # Hash the management code
    hashed_management_code = bcrypt.hashpw(report.management_code.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Create report item
    report_item = {
        'report_id': report_id,
        'type': report.type,
        'item_name': report.item_name,
        'description': report.description,
        'contact_info': report.contact_info,
        'status': status,
        'photo': [], 
        'photo_urls': [],  
        'is_surrendered': report.is_surrendered,
        'management_code': hashed_management_code,
        'created_at': timestamp,
        'updated_at': timestamp,
        'flag_count': 0
    }

    # Save to DynamoDB
    try:
        reports_table.put_item(Item=report_item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving report: {str(e)}")
    
    message = "Lost item report submitted successfully!" if report.type.lower() == "lost" else "Found item report submitted successfully!"

    return {
        "message": message,
        "report_id": report_id,
        **report_item
    }

# Saves uploaded image
@app.post("/reports/{report_id}/upload_photo")
async def upload_photo(report_id: str, photo: UploadFile = File(...)):
    try:
        # Fetch report
        report = reports_table.get_item(Key={"report_id": report_id}).get("Item")

        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        old_urls = report.get("photo_urls", [])

        # Delete old photos
        for url in old_urls:
            if url.startswith("https://"):
                key = url.split(".amazonaws.com/")[-1]
            elif url.startswith("s3://"):
                key = url.replace(f"s3://{S3_BUCKET}/", "")
            else:
                continue  

            try:
                s3_client.delete_object(Bucket=S3_BUCKET, Key=key)
            except Exception as e:
                print(f"Failed to delete old image: {e}")  

        # Upload new photo
        contents = await photo.read()
        photo_key = f"reports/{report_id}/{uuid.uuid4()}.jpg"

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=photo_key,
            Body=contents,
            ContentType=photo.content_type
        )

        new_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{photo_key}"

        # Update Reports table
        reports_table.update_item(
            Key={"report_id": report_id},
            UpdateExpression="SET photo_urls = :urls, photo = :single, updated_at = :updated",
            ExpressionAttributeValues={
                ":urls": [new_url],
                ":single": new_url,
                ":updated": datetime.utcnow().isoformat()
            }
        )

        return {
            "message": "Photo uploaded successfully",
            "photo_url": new_url
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# Create a new response
@app.post("/reports/{report_id}/responses", response_model=Responses)
async def submit_response(report_id: str, response: ResponseCreate):
    
    if not response.name or not response.contact_info or not response.message:
        raise HTTPException(status_code=400, detail="Missing required fields: name, contact_info, message")
    
    # Get report type
    try:
        report_response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in report_response:
            raise HTTPException(status_code=404, detail="Report not found")
        report_type = report_response['Item']['type']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching report: {str(e)}")

    response_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()

    # Create response item
    response_item = {
        'report_id': report_id,
        'response_id': response_id,
        'type': report_type,
        'name': response.name,
        'contact_info': response.contact_info,
        'message': response.message,
        'created_at': timestamp
    }

    # Save
    try:
        responses_table.put_item(Item=response_item)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving response: {str(e)}")
    
    return response_item

# Create a flag report
@app.post("/reports/{report_id}/flags", response_model=Flags)
async def flag_report(report_id: str, flag: FlagCreate):

    try:
        # Fetch the report
        response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in response:
            raise HTTPException(status_code=404, detail="Report not found")
        
        report = response['Item']

        # Create the flag
        flag_data = {
            'flag_id': str(uuid.uuid4()),
            'report_id': report_id,
            'reason': flag.reason,
            'created_at': datetime.utcnow().isoformat()
        }

        # Save data into Flags table
        flags_table.put_item(Item=flag_data)
        
        # Update the report
        current_count = report.get('flag_count', 0)
        new_count = current_count + 1

        reports_table.update_item(
            Key={'report_id': report_id},
            UpdateExpression="SET flag_count = :count",
            ExpressionAttributeValues={':count': new_count}
        )

        # Delete the report if exceed the threshold
        if new_count >= 3:
            # Delete photos - S3
            photos = report.get('photo', [])
            for photo_key in photos:
                try:
                    s3_client.delete_object(Bucket=S3_BUCKET, Key=photo_key)
                except Exception as e:
                    print(f"Error deleting photo {photo_key}: {e}")
                
            
            # Delete responses
            try:
                responses_response = responses_table.query(
                    KeyConditionExpression='report_id = :report_id',
                    ExpressionAttributeValues={
                        ':report_id': report_id
                    }
                )
                
                for response_item in responses_response.get('Items', []):
                    responses_table.delete_item(
                        Key={
                            'report_id': report_id,
                            'response_id': response_item['response_id']
                        }
                    )
            except Exception as e:
                print(f"Error deleting responses: {e}")

            # Delete the report
            reports_table.delete_item(Key={'report_id': report_id})

        # Return the flag object
        return Flags(
            flag_id=flag_data['flag_id'],
            report_id=report_id,
            reason=flag.reason,
            created_at=flag_data['created_at']
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding flag: {str(e)}")

# Get all reports
@app.get("/reports", response_model=List[Reports])
async def get_all_reports():
    
    try:
        response = reports_table.scan()

        reports = []
        for item in response.get('Items', []):
            photo_urls = []
            if item.get('photo_urls'):
                photo_urls = item['photo_urls']
            elif item.get('photo'):
                # Fallback
                photo_urls = generate_presigned_url(item['photo'])
            
            # Build the report object
            report = Reports(
                report_id=item['report_id'],
                type=item['type'],
                item_name=item['item_name'],
                description=item['description'],
                contact_info=item['contact_info'],
                status=item['status'],
                photo=item.get('photo', []),
                photo_urls=photo_urls,
                is_surrendered=item.get('is_surrendered', False),
                management_code=item['management_code'],   
                created_at=item['created_at'],
                updated_at=item['updated_at']
            )
            reports.append(report)

        return reports
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching reports: {str(e)}")

# Get all responses
@app.get("/reports/{report_id}/responses", response_model=List[Responses])
async def get_all_responses(report_id: str, management_code: str):
    
    try:
        # Fetch the report
        report_response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in report_response:
            raise HTTPException(status_code=404, detail="Report not found")

        report = report_response['Item']

        # Validate the management_code
        if not bcrypt.checkpw(management_code.encode('utf-8'), report['management_code'].encode('utf-8')):
            raise HTTPException(status_code=403, detail="Invalid management code")
        
        # Fetch related responses
        responses_response = responses_table.query(
            KeyConditionExpression='report_id = :report_id',
            ExpressionAttributeValues={':report_id': report_id}
        )

        responses = []
        for item in responses_response.get('Items', []):
            responses.append({
                "report_id": item["report_id"],
                "response_id": item["response_id"],
                "name": item["name"],
                "contact_info": item["contact_info"],
                "message": item["message"],
                "created_at": item["created_at"]
            })

        return responses
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching responses: {str(e)}")

# Get all finders data
@app.get("/finder/data")
async def get_finder_data():
    return academic_structure

# Get representative data
@app.get("/finder/representative/{section_id}")
async def get_representative(section_id: str):
    
    section_id = section_id.upper()

    # Extract all valid sections from the data
    valid_sections = set()
    for college in academic_structure["colleges"]:
        for program in college.get("programs", []):
            for year_level in program.get("year_levels", []):
                for section in year_level.get("sections", []):
                    valid_sections.add(section.upper())

    # Check if section exists
    if section_id not in valid_sections:
        return {"message": f"Section {section_id} does not exist in academic structure."}
    
    # Hardcoded rep data
    class_representatives = {
        # BSIT - 1st Year
        "IT 1-1": {"full_name": "Rep IT 1-1", "webmail": "rep.it11@pup.edu.ph", "messenger_link": "https://m.me/rep.it11", "contact_number": "09000000001", "official_group_chat": "https://chat.whatsapp.com/invite/IT11"},
        "IT 1-1N": {"full_name": "Rep IT 1-1N", "webmail": "rep.it11n@pup.edu.ph", "messenger_link": "https://m.me/rep.it11n", "contact_number": "09000000002", "official_group_chat": "https://chat.whatsapp.com/invite/IT11N"},
        "IT 1-2": {"full_name": "Rep IT 1-2", "webmail": "rep.it12@pup.edu.ph", "messenger_link": "https://m.me/rep.it12", "contact_number": "09000000003", "official_group_chat": "https://chat.whatsapp.com/invite/IT12"},
        "IT 1-2N": {"full_name": "Rep IT 1-2N", "webmail": "rep.it12n@pup.edu.ph", "messenger_link": "https://m.me/rep.it12n", "contact_number": "09000000004", "official_group_chat": "https://chat.whatsapp.com/invite/IT12N"},
        "IT 1-3": {"full_name": "Rep IT 1-3", "webmail": "rep.it13@pup.edu.ph", "messenger_link": "https://m.me/rep.it13", "contact_number": "09000000005", "official_group_chat": "https://chat.whatsapp.com/invite/IT13"},
        "IT 1-4": {"full_name": "Rep IT 1-4", "webmail": "rep.it14@pup.edu.ph", "messenger_link": "https://m.me/rep.it14", "contact_number": "09000000006", "official_group_chat": "https://chat.whatsapp.com/invite/IT14"},
        "IT 1-5": {"full_name": "Rep IT 1-5", "webmail": "rep.it15@pup.edu.ph", "messenger_link": "https://m.me/rep.it15", "contact_number": "09000000007", "official_group_chat": "https://chat.whatsapp.com/invite/IT15"},

        # BSIT - 2nd Year
        "IT 2-1": {"full_name": "Rep IT 2-1", "webmail": "rep.it21@pup.edu.ph", "messenger_link": "https://m.me/rep.it21", "contact_number": "09000000008", "official_group_chat": "https://chat.whatsapp.com/invite/IT21"},
        "IT 2-1N": {"full_name": "Rep IT 2-1N", "webmail": "rep.it21n@pup.edu.ph", "messenger_link": "https://m.me/rep.it21n", "contact_number": "09000000009", "official_group_chat": "https://chat.whatsapp.com/invite/IT21N"},
        "IT 2-2": {"full_name": "Rep IT 2-2", "webmail": "rep.it22@pup.edu.ph", "messenger_link": "https://m.me/rep.it22", "contact_number": "09000000010", "official_group_chat": "https://chat.whatsapp.com/invite/IT22"},
        "IT 2-2N": {"full_name": "Rep IT 2-2N", "webmail": "rep.it22n@pup.edu.ph", "messenger_link": "https://m.me/rep.it22n", "contact_number": "09000000011", "official_group_chat": "https://chat.whatsapp.com/invite/IT22N"},
        "IT 2-3": {"full_name": "Rep IT 2-3", "webmail": "rep.it23@pup.edu.ph", "messenger_link": "https://m.me/rep.it23", "contact_number": "09000000012", "official_group_chat": "https://chat.whatsapp.com/invite/IT23"},
        "IT 2-4": {"full_name": "Rep IT 2-4", "webmail": "rep.it24@pup.edu.ph", "messenger_link": "https://m.me/rep.it24", "contact_number": "09000000013", "official_group_chat": "https://chat.whatsapp.com/invite/IT24"},
        "IT 2-5": {"full_name": "Rep IT 2-5", "webmail": "rep.it25@pup.edu.ph", "messenger_link": "https://m.me/rep.it25", "contact_number": "09000000014", "official_group_chat": "https://chat.whatsapp.com/invite/IT25"},

        # BSIT - 3rd Year
        "IT 3-1": {"full_name": "Rep IT 3-1", "webmail": "rep.it31@pup.edu.ph", "messenger_link": "https://m.me/rep.it31", "contact_number": "09000000015", "official_group_chat": "https://chat.whatsapp.com/invite/IT31"},
        "IT 3-1N": {"full_name": "Rep IT 3-1N", "webmail": "rep.it31n@pup.edu.ph", "messenger_link": "https://m.me/rep.it31n", "contact_number": "09000000016", "official_group_chat": "https://chat.whatsapp.com/invite/IT31N"},
        "IT 3-2": {"full_name": "Rep IT 3-2", "webmail": "rep.it32@pup.edu.ph", "messenger_link": "https://m.me/rep.it32", "contact_number": "09000000017", "official_group_chat": "https://chat.whatsapp.com/invite/IT32"},
        "IT 3-2N": {"full_name": "Rep IT 3-2N", "webmail": "rep.it32n@pup.edu.ph", "messenger_link": "https://m.me/rep.it32n", "contact_number": "09000000018", "official_group_chat": "https://chat.whatsapp.com/invite/IT32N"},
        "IT 3-3": {"full_name": "Rep IT 3-3", "webmail": "rep.it33@pup.edu.ph", "messenger_link": "https://m.me/rep.it33", "contact_number": "09000000019", "official_group_chat": "https://chat.whatsapp.com/invite/IT33"},
        "IT 3-4": {"full_name": "Rep IT 3-4", "webmail": "rep.it34@pup.edu.ph", "messenger_link": "https://m.me/rep.it34", "contact_number": "09000000020", "official_group_chat": "https://chat.whatsapp.com/invite/IT34"},
        "IT 3-5": {"full_name": "Rep IT 3-5", "webmail": "rep.it35@pup.edu.ph", "messenger_link": "https://m.me/rep.it35", "contact_number": "09000000021", "official_group_chat": "https://chat.whatsapp.com/invite/IT35"},

        # BSIT - 4th Year
        "IT 4-1": {"full_name": "Rep IT 4-1", "webmail": "rep.it41@pup.edu.ph", "messenger_link": "https://m.me/rep.it41", "contact_number": "09000000022", "official_group_chat": "https://chat.whatsapp.com/invite/IT41"},
        "IT 4-1N": {"full_name": "Rep IT 4-1N", "webmail": "rep.it41n@pup.edu.ph", "messenger_link": "https://m.me/rep.it41n", "contact_number": "09000000023", "official_group_chat": "https://chat.whatsapp.com/invite/IT41N"},
        "IT 4-2": {"full_name": "Rep IT 4-2", "webmail": "rep.it42@pup.edu.ph", "messenger_link": "https://m.me/rep.it42", "contact_number": "09000000024", "official_group_chat": "https://chat.whatsapp.com/invite/IT42"},
        "IT 4-2N": {"full_name": "Rep IT 4-2N", "webmail": "rep.it42n@pup.edu.ph", "messenger_link": "https://m.me/rep.it42n", "contact_number": "09000000025", "official_group_chat": "https://chat.whatsapp.com/invite/IT42N"},
        "IT 4-3": {"full_name": "Rep IT 4-3", "webmail": "rep.it43@pup.edu.ph", "messenger_link": "https://m.me/rep.it43", "contact_number": "09000000026", "official_group_chat": "https://chat.whatsapp.com/invite/IT43"},
        "IT 4-4": {"full_name": "Rep IT 4-4", "webmail": "rep.it44@pup.edu.ph", "messenger_link": "https://m.me/rep.it44", "contact_number": "09000000027", "official_group_chat": "https://chat.whatsapp.com/invite/IT44"},
        "IT 4-5": {"full_name": "Rep IT 4-5", "webmail": "rep.it45@pup.edu.ph", "messenger_link": "https://m.me/rep.it45", "contact_number": "09000000028", "official_group_chat": "https://chat.whatsapp.com/invite/IT45"},

        # BSCS - 1st Year
        "CS 1-1": {"full_name": "Rep CS 1-1", "webmail": "rep.cs11@pup.edu.ph", "messenger_link": "https://m.me/rep.cs11", "contact_number": "09000000029", "official_group_chat": "https://chat.whatsapp.com/invite/CS11"},
        "CS 1-1N": {"full_name": "Rep CS 1-1N", "webmail": "rep.cs11n@pup.edu.ph", "messenger_link": "https://m.me/rep.cs11n", "contact_number": "09000000030", "official_group_chat": "https://chat.whatsapp.com/invite/CS11N"},
        "CS 1-2": {"full_name": "Rep CS 1-2", "webmail": "rep.cs12@pup.edu.ph", "messenger_link": "https://m.me/rep.cs12", "contact_number": "09000000031", "official_group_chat": "https://chat.whatsapp.com/invite/CS12"},
        "CS 1-3": {"full_name": "Rep CS 1-3", "webmail": "rep.cs13@pup.edu.ph", "messenger_link": "https://m.me/rep.cs13", "contact_number": "09000000032", "official_group_chat": "https://chat.whatsapp.com/invite/CS13"},
        "CS 1-4": {"full_name": "Rep CS 1-4", "webmail": "rep.cs14@pup.edu.ph", "messenger_link": "https://m.me/rep.cs14", "contact_number": "09000000033", "official_group_chat": "https://chat.whatsapp.com/invite/CS14"},
        "CS 1-5": {"full_name": "Rep CS 1-5", "webmail": "rep.cs15@pup.edu.ph", "messenger_link": "https://m.me/rep.cs15", "contact_number": "09000000034", "official_group_chat": "https://chat.whatsapp.com/invite/CS15"},

        # BSCS - 2nd Year
        "CS 2-1": {"full_name": "Rep CS 2-1", "webmail": "rep.cs21@pup.edu.ph", "messenger_link": "https://m.me/rep.cs21", "contact_number": "09000000035", "official_group_chat": "https://chat.whatsapp.com/invite/CS21"},
        "CS 2-1N": {"full_name": "Rep CS 2-1N", "webmail": "rep.cs21n@pup.edu.ph", "messenger_link": "https://m.me/rep.cs21n", "contact_number": "09000000036", "official_group_chat": "https://chat.whatsapp.com/invite/CS21N"},
        "CS 2-2": {"full_name": "Rep CS 2-2", "webmail": "rep.cs22@pup.edu.ph", "messenger_link": "https://m.me/rep.cs22", "contact_number": "09000000037", "official_group_chat": "https://chat.whatsapp.com/invite/CS22"},
        "CS 2-3": {"full_name": "Rep CS 2-3", "webmail": "rep.cs23@pup.edu.ph", "messenger_link": "https://m.me/rep.cs23", "contact_number": "09000000038", "official_group_chat": "https://chat.whatsapp.com/invite/CS23"},
        "CS 2-4": {"full_name": "Rep CS 2-4", "webmail": "rep.cs24@pup.edu.ph", "messenger_link": "https://m.me/rep.cs24", "contact_number": "09000000039", "official_group_chat": "https://chat.whatsapp.com/invite/CS24"},
        "CS 2-5": {"full_name": "Rep CS 2-5", "webmail": "rep.cs25@pup.edu.ph", "messenger_link": "https://m.me/rep.cs25", "contact_number": "09000000040", "official_group_chat": "https://chat.whatsapp.com/invite/CS25"},

        # BSCS - 3rd Year
        "CS 3-1": {"full_name": "Rep CS 3-1", "webmail": "rep.cs31@pup.edu.ph", "messenger_link": "https://m.me/rep.cs31", "contact_number": "09000000041", "official_group_chat": "https://chat.whatsapp.com/invite/CS31"},
        "CS 3-1N": {"full_name": "Rep CS 3-1N", "webmail": "rep.cs31n@pup.edu.ph", "messenger_link": "https://m.me/rep.cs31n", "contact_number": "09000000042", "official_group_chat": "https://chat.whatsapp.com/invite/CS31N"},
        "CS 3-2": {"full_name": "Rep CS 3-2", "webmail": "rep.cs32@pup.edu.ph", "messenger_link": "https://m.me/rep.cs32", "contact_number": "09000000043", "official_group_chat": "https://chat.whatsapp.com/invite/CS32"},
        "CS 3-3": {"full_name": "Rep CS 3-3", "webmail": "rep.cs33@pup.edu.ph", "messenger_link": "https://m.me/rep.cs33", "contact_number": "09000000044", "official_group_chat": "https://chat.whatsapp.com/invite/CS33"},
        "CS 3-4": {"full_name": "Rep CS 3-4", "webmail": "rep.cs34@pup.edu.ph", "messenger_link": "https://m.me/rep.cs34", "contact_number": "09000000045", "official_group_chat": "https://chat.whatsapp.com/invite/CS34"},
        "CS 3-5": {"full_name": "Rep CS 3-5", "webmail": "rep.cs35@pup.edu.ph", "messenger_link": "https://m.me/rep.cs35", "contact_number": "09000000046", "official_group_chat": "https://chat.whatsapp.com/invite/CS35"},

        # BSCS - 4th Year
        "CS 4-1": {"full_name": "Rep CS 4-1", "webmail": "rep.cs41@pup.edu.ph", "messenger_link": "https://m.me/rep.cs41", "contact_number": "09000000047", "official_group_chat": "https://chat.whatsapp.com/invite/CS41"},
        "CS 4-1N": {"full_name": "Rep CS 4-1N", "webmail": "rep.cs41n@pup.edu.ph", "messenger_link": "https://m.me/rep.cs41n", "contact_number": "09000000048", "official_group_chat": "https://chat.whatsapp.com/invite/CS41N"},
        "CS 4-2": {"full_name": "Rep CS 4-2", "webmail": "rep.cs42@pup.edu.ph", "messenger_link": "https://m.me/rep.cs42", "contact_number": "09000000049", "official_group_chat": "https://chat.whatsapp.com/invite/CS42"},
        "CS 4-3": {"full_name": "Rep CS 4-3", "webmail": "rep.cs43@pup.edu.ph", "messenger_link": "https://m.me/rep.cs43", "contact_number": "09000000050", "official_group_chat": "https://chat.whatsapp.com/invite/CS43"},
        "CS 4-4": {"full_name": "Rep CS 4-4", "webmail": "rep.cs44@pup.edu.ph", "messenger_link": "https://m.me/rep.cs44", "contact_number": "09000000051", "official_group_chat": "https://chat.whatsapp.com/invite/CS44"},
        "CS 4-5": {"full_name": "Rep CS 4-5", "webmail": "rep.cs45@pup.edu.ph", "messenger_link": "https://m.me/rep.cs45", "contact_number": "09000000052", "official_group_chat": "https://chat.whatsapp.com/invite/CS45"}
    }

    rep_info = class_representatives.get(section_id)
    if rep_info:
        return {"section_id": section_id, "representative": rep_info}
    else:
        return {"message": f"No representative assigned yet for section {section_id}."}

# Updating a specific report
@app.put("/reports/{report_id}", response_model=Reports)
async def update_report(report_id: str, report_update: ReportUpdate, management_code: str):
    try:
        # Fetch the report
        report_response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in report_response:
            raise HTTPException(status_code=404, detail="Report not found")
        
        existing_report = report_response['Item']

        # Verify management code
        if not bcrypt.checkpw(management_code.encode('utf-8'), existing_report['management_code'].encode('utf-8')):
            raise HTTPException(status_code=403, detail="Invalid management code")

        # Build update
        update_expression = []
        expression_attribute_values = {}
        expression_attribute_names = {}

        update_expression.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat()

        # Optional fields
        if report_update.item_name is not None:
            update_expression.append("#item_name = :item_name")
            expression_attribute_names["#item_name"] = "item_name"
            expression_attribute_values[":item_name"] = report_update.item_name
        
        if report_update.description is not None:
            update_expression.append("#description = :description")
            expression_attribute_names["#description"] = "description"
            expression_attribute_values[":description"] = report_update.description

        if report_update.contact_info is not None:
            update_expression.append("#contact_info = :contact_info")
            expression_attribute_names["#contact_info"] = "contact_info"
            expression_attribute_values[":contact_info"] = report_update.contact_info

        if report_update.status is not None:
            update_expression.append("#status = :status")
            expression_attribute_names["#status"] = "status"
            expression_attribute_values[":status"] = report_update.status

        if report_update.is_surrendered is not None:
            update_expression.append("#is_surrendered = :is_surrendered")
            expression_attribute_names["#is_surrendered"] = "is_surrendered"
            expression_attribute_values[":is_surrendered"] = report_update.is_surrendered

        if not update_expression:
            raise HTTPException(status_code=400, detail="No fields provided for update.")

        # Update
        response = reports_table.update_item(
            Key={'report_id': report_id},
            UpdateExpression="SET " + ", ".join(update_expression),
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues='ALL_NEW'
        )

        updated_report = response['Attributes']

        return Reports(
            report_id=updated_report['report_id'],
            type=updated_report['type'],
            item_name=updated_report['item_name'],
            description=updated_report['description'],
            contact_info=updated_report['contact_info'],
            status=updated_report['status'],
            photo=updated_report.get('photo', []),
            photo_urls=updated_report.get('photo_urls', []),
            is_surrendered=updated_report.get('is_surrendered', False),
            management_code=updated_report['management_code'],
            created_at=updated_report['created_at'],
            updated_at=updated_report['updated_at'],
            flag_count=updated_report.get('flag_count', 0)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating report: {str(e)}")

# Deleting a specific report
@app.delete("/reports/{report_id}")
async def delete_report(report_id: str, management_code: str):
    try:
        # Fetch existing report
        report_response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in report_response:
            raise HTTPException(status_code=404, detail="Report not found")
        
        existing_report = report_response['Item']

        # Verify management code
        if not bcrypt.checkpw(management_code.encode('utf-8'), existing_report['management_code'].encode('utf-8')):
            raise HTTPException(status_code=403, detail="Invalid management code")
        
        # Delete associated photo(s) from S3
        photo_urls = existing_report.get("photo_urls", [])
        for url in photo_urls:
            try:
                parsed = urlparse(url)
                photo_key = parsed.path.lstrip('/') 
                s3_client.delete_object(Bucket=S3_BUCKET, Key=photo_key)
                print(f"Deleted S3 photo: {photo_key}")
            except Exception as e:
                print(f"Error deleting photo {url}: {e}")

        # Delete all associated responses
        try:
            responses_response = responses_table.query(
                KeyConditionExpression='report_id = :report_id',
                ExpressionAttributeValues={':report_id': report_id}
            )
            for response_item in responses_response.get('Items', []):
                responses_table.delete_item(
                    Key={
                        'report_id': report_id,
                        'response_id': response_item['response_id']
                    }
                )
        except Exception as e:
            print(f"Error deleting responses: {e}")

        # Delete associated flags
        try:
            flags_response = flags_table.query(
                KeyConditionExpression='report_id = :report_id',
                ExpressionAttributeValues={':report_id': report_id}
            )
            for flag_item in flags_response.get('Items', []):
                flags_table.delete_item(
                    Key={
                        'report_id': report_id,
                        'flag_id': flag_item['flag_id']
                    }
                )
        except Exception as e:
            print(f"Error deleting flags: {e}")

        # Delete the report itself
        reports_table.delete_item(Key={'report_id': report_id})

        return {"message": "Report and all associated data deleted successfully!"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting report: {str(e)}")

# Marking a report as completed
@app.patch("/reports/{report_id}/status", response_model=Reports)
async def mark_completed(report_id: str, management_code: str):
    
    try:
        # Fetch the report
        report_response = reports_table.get_item(Key={'report_id': report_id})
        if 'Item' not in report_response:
            raise HTTPException(status_code=404, detail="Report not found")
        
        existing_report = report_response['Item']

        # Verify management code
        if not bcrypt.checkpw(management_code.encode('utf-8'), existing_report['management_code'].encode('utf-8')):
            raise HTTPException(status_code=403, detail="Invalid management code")
        
        # Update status to completed
        response = reports_table.update_item(
            Key={'report_id': report_id},
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={'#status':'status'},
            ExpressionAttributeValues={
                ':status': 'completed',
                ':updated_at': datetime.utcnow().isoformat()
            },
            ReturnValues='ALL_NEW'
        )

        updated_report = response['Attributes']

        # Generate presigned URLs for photos
        photo_urls = []
        if updated_report.get('photo_urls'):
            photo_urls = updated_report['photo_urls']
        elif updated_report.get('photo'):
            photo_urls = generate_presigned_url(updated_report['photo'])
        
        # Build and return the updated report
        return Reports(
            report_id=updated_report['report_id'],
            type=updated_report['type'],
            item_name=updated_report['item_name'],
            description=updated_report['description'],
            contact_info=updated_report['contact_info'],
            status=updated_report['status'],
            photo=updated_report.get('photo', []),
            photo_urls=photo_urls,
            is_surrendered=updated_report.get('is_surrendered', False),
            management_code=updated_report['management_code'],
            created_at=updated_report['created_at'],
            updated_at=updated_report['updated_at']
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking report as completed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)