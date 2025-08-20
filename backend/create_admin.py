import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
from passlib.context import CryptContext
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin_user():
    print("Creating admin user...")
    
    # Check if admin already exists
    existing_admin = await db.users.find_one({"email": "admin@busbook.com"})
    if existing_admin:
        print("Admin user already exists!")
        return
    
    # Create admin user
    admin_data = {
        "id": str(uuid.uuid4()),
        "email": "admin@busbook.com",
        "password": pwd_context.hash("admin123"),  # Change this password in production
        "full_name": "System Administrator",
        "phone": "9999999999",
        "role": "admin",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_data)
    print("✅ Admin user created successfully!")
    print("Email: admin@busbook.com")
    print("Password: admin123")
    print("⚠️  Please change the password in production!")

if __name__ == "__main__":
    asyncio.run(create_admin_user())