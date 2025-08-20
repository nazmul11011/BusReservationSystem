from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, time, timedelta
import hashlib
import jwt
from passlib.context import CryptContext
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_SECRET = "your-secret-key-change-in-production"

# Enums
class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"

class BookingStatus(str, Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

class TripStatus(str, Enum):
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Helper functions for MongoDB serialization
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, date) and not isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, time):
                data[key] = value.strftime('%H:%M:%S')
            elif isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = prepare_for_mongo(value)
            elif isinstance(value, list):
                data[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        if '_id' in item:
            del item['_id']
        for key, value in item.items():
            if isinstance(value, str):
                # Try to parse date strings
                if key.endswith('_date') or key == 'date':
                    try:
                        item[key] = datetime.fromisoformat(value).date()
                    except:
                        pass
                elif key.endswith('_time') or key == 'departure_time' or key == 'arrival_time':
                    try:
                        item[key] = datetime.strptime(value, '%H:%M:%S').time()
                    except:
                        pass
                elif key.endswith('_at') or key == 'created_at' or key == 'updated_at':
                    try:
                        item[key] = datetime.fromisoformat(value)
                    except:
                        pass
            elif isinstance(value, dict):
                item[key] = parse_from_mongo(value)
            elif isinstance(value, list):
                item[key] = [parse_from_mongo(v) if isinstance(v, dict) else v for v in value]
    return item

# Enhanced Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    phone: str
    role: UserRole = UserRole.USER
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: UserRole = UserRole.USER

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BusOperator(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_email: str
    contact_phone: str
    rating: float = 0.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusOperatorCreate(BaseModel):
    name: str
    contact_email: str
    contact_phone: str

class Route(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    origin: str
    destination: str
    distance_km: float
    estimated_duration_hours: float
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteCreate(BaseModel):
    origin: str
    destination: str
    distance_km: float
    estimated_duration_hours: float

class Bus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_id: str
    bus_number: str
    bus_type: str  # AC, Non-AC, Sleeper, Semi-Sleeper
    total_seats: int
    amenities: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusCreate(BaseModel):
    operator_id: str
    bus_number: str
    bus_type: str
    total_seats: int
    amenities: List[str] = []

class BusSchedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bus_id: str
    route_id: str
    departure_time: time
    arrival_time: time
    price: float
    date: date
    available_seats: int
    status: TripStatus = TripStatus.SCHEDULED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BusScheduleCreate(BaseModel):
    bus_id: str
    route_id: str
    departure_time: time
    arrival_time: time
    price: float
    date: date

class SeatMap(BaseModel):
    seat_number: str
    is_booked: bool = False
    passenger_name: Optional[str] = None
    passenger_age: Optional[int] = None
    passenger_gender: Optional[str] = None

class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    schedule_id: str
    seats: List[SeatMap]
    total_amount: float
    status: BookingStatus = BookingStatus.CONFIRMED
    payment_status: str = "paid"  # paid, pending, failed
    booking_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    passenger_details: List[Dict[str, Any]] = []
    can_cancel: bool = True
    cancellation_date: Optional[datetime] = None
    refund_amount: Optional[float] = None

class BookingCreate(BaseModel):
    schedule_id: str
    seats: List[str]  # seat numbers
    passenger_details: List[Dict[str, Any]]

class BusSearch(BaseModel):
    origin: str
    destination: str
    date: date

class BookingFilter(BaseModel):
    status: Optional[BookingStatus] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None

class AdminStats(BaseModel):
    total_bookings: int
    total_revenue: float
    active_users: int
    popular_routes: List[Dict[str, Any]]
    booking_trends: List[Dict[str, Any]]
    operator_performance: List[Dict[str, Any]]

# Auth functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_jwt_token(user_id: str, role: str = "user") -> str:
    payload = {
        "user_id": user_id, 
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = await db.users.find_one({"id": user_id})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**parse_from_mongo(user_data))
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Routes
@api_router.get("/")
async def root():
    return {"message": "Bus Booking System API"}

# Auth routes
@api_router.post("/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role
    )
    
    user_dict = prepare_for_mongo(user.dict())
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    # Create JWT token
    token = create_jwt_token(user.id, user.role.value)
    
    return {"message": "User created successfully", "token": token, "user": user}

@api_router.post("/login")
async def login(login_data: UserLogin):
    user_data = await db.users.find_one({"email": login_data.email})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, user_data["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(**parse_from_mongo(user_data))
    token = create_jwt_token(user.id, user.role.value)
    
    return {"message": "Login successful", "token": token, "user": user}

@api_router.get("/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

# Bus search and booking routes
@api_router.post("/search-buses")
async def search_buses(search_data: BusSearch):
    # Find schedules for the given route and date
    schedules = await db.bus_schedules.find({
        "date": search_data.date.isoformat(),
        "status": "scheduled"
    }).to_list(100)
    
    results = []
    for schedule in schedules:
        schedule = parse_from_mongo(schedule)
        
        # Get route info
        route = await db.routes.find_one({"id": schedule["route_id"], "is_active": True})
        if not route:
            continue
        route = parse_from_mongo(route)
        
        # Check if route matches search criteria
        if (route["origin"].lower() != search_data.origin.lower() or 
            route["destination"].lower() != search_data.destination.lower()):
            continue
        
        # Get bus info
        bus = await db.buses.find_one({"id": schedule["bus_id"], "is_active": True})
        if not bus:
            continue
        bus = parse_from_mongo(bus)
        
        # Get operator info
        operator = await db.bus_operators.find_one({"id": bus["operator_id"], "is_active": True})
        if not operator:
            continue
        operator = parse_from_mongo(operator)
        
        result = {
            "schedule_id": schedule["id"],
            "bus_number": bus["bus_number"],
            "bus_type": bus["bus_type"],
            "operator_name": operator["name"],
            "operator_rating": operator["rating"],
            "departure_time": schedule["departure_time"],
            "arrival_time": schedule["arrival_time"],
            "duration": route["estimated_duration_hours"],
            "price": schedule["price"],
            "available_seats": schedule["available_seats"],
            "amenities": bus["amenities"],
            "total_seats": bus["total_seats"]
        }
        results.append(result)
    
    return {"buses": results}

@api_router.get("/bus-seats/{schedule_id}")
async def get_bus_seats(schedule_id: str):
    schedule = await db.bus_schedules.find_one({"id": schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    bus = await db.buses.find_one({"id": schedule["bus_id"]})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    # Get existing bookings for this schedule
    bookings = await db.bookings.find({"schedule_id": schedule_id, "status": "confirmed"}).to_list(100)
    
    booked_seats = set()
    for booking in bookings:
        for seat in booking["seats"]:
            booked_seats.add(seat["seat_number"])
    
    # Generate seat map (simple 2x2 layout for demo)
    total_seats = bus["total_seats"]
    seats = []
    
    for i in range(1, total_seats + 1):
        seat_number = f"{i:02d}"
        is_booked = seat_number in booked_seats
        seats.append({
            "seat_number": seat_number,
            "is_booked": is_booked,
            "position": {
                "row": (i - 1) // 4 + 1,
                "column": (i - 1) % 4 + 1
            }
        })
    
    return {"seats": seats, "total_seats": total_seats}

@api_router.post("/book-tickets")
async def book_tickets(booking_data: BookingCreate, current_user: User = Depends(get_current_user)):
    # Verify schedule exists
    schedule = await db.bus_schedules.find_one({"id": booking_data.schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check if booking is allowed (not past departure time)
    schedule_date = datetime.fromisoformat(schedule["date"]).date()
    departure_time = datetime.strptime(schedule["departure_time"], '%H:%M:%S').time()
    departure_datetime = datetime.combine(schedule_date, departure_time)
    
    if departure_datetime < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot book tickets for past trips")
    
    # Check seat availability
    existing_bookings = await db.bookings.find({
        "schedule_id": booking_data.schedule_id,
        "status": "confirmed"
    }).to_list(100)
    
    booked_seat_numbers = set()
    for booking in existing_bookings:
        for seat in booking["seats"]:
            booked_seat_numbers.add(seat["seat_number"])
    
    # Check if any requested seats are already booked
    for seat_number in booking_data.seats:
        if seat_number in booked_seat_numbers:
            raise HTTPException(status_code=400, detail=f"Seat {seat_number} is already booked")
    
    # Create seat map with passenger details
    seat_map = []
    for i, seat_number in enumerate(booking_data.seats):
        passenger = booking_data.passenger_details[i] if i < len(booking_data.passenger_details) else {}
        seat_map.append(SeatMap(
            seat_number=seat_number,
            is_booked=True,
            passenger_name=passenger.get("name"),
            passenger_age=passenger.get("age"),
            passenger_gender=passenger.get("gender")
        ))
    
    # Calculate total amount
    total_amount = len(booking_data.seats) * schedule["price"]
    
    # Check if cancellation is allowed (more than 2 hours before departure)
    can_cancel = departure_datetime > datetime.now() + timedelta(hours=2)
    
    # Create booking
    booking = Booking(
        user_id=current_user.id,
        schedule_id=booking_data.schedule_id,
        seats=seat_map,
        total_amount=total_amount,
        passenger_details=booking_data.passenger_details,
        can_cancel=can_cancel
    )
    
    booking_dict = prepare_for_mongo(booking.dict())
    await db.bookings.insert_one(booking_dict)
    
    # Update available seats in schedule
    new_available_seats = schedule["available_seats"] - len(booking_data.seats)
    await db.bus_schedules.update_one(
        {"id": booking_data.schedule_id},
        {"$set": {"available_seats": new_available_seats}}
    )
    
    return {"message": "Booking created successfully", "booking": booking}

@api_router.get("/my-bookings")
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50)
):
    # Build filter
    filter_dict = {"user_id": current_user.id}
    if status:
        filter_dict["status"] = status
    
    # Get total count
    total_count = await db.bookings.count_documents(filter_dict)
    
    # Get bookings with pagination
    skip = (page - 1) * limit
    bookings = await db.bookings.find(filter_dict).sort("booking_date", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for booking in bookings:
        booking = parse_from_mongo(booking)
        
        # Get schedule details
        schedule = await db.bus_schedules.find_one({"id": booking["schedule_id"]})
        if schedule:
            schedule = parse_from_mongo(schedule)
            
            # Get route details
            route = await db.routes.find_one({"id": schedule["route_id"]})
            if route:
                route = parse_from_mongo(route)
                
                # Get bus details
                bus = await db.buses.find_one({"id": schedule["bus_id"]})
                if bus:
                    bus = parse_from_mongo(bus)
                    
                    # Get operator details
                    operator = await db.bus_operators.find_one({"id": bus["operator_id"]})
                    if operator:
                        operator = parse_from_mongo(operator)
                        
                        booking_detail = {
                            **booking,
                            "route": route,
                            "bus": bus,
                            "operator": operator,
                            "schedule": schedule
                        }
                        result.append(booking_detail)
    
    return {
        "bookings": result,
        "total_count": total_count,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit
    }

@api_router.post("/cancel-booking/{booking_id}")
async def cancel_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    # Get booking
    booking = await db.bookings.find_one({"id": booking_id, "user_id": current_user.id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = parse_from_mongo(booking)
    
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Booking cannot be cancelled")
    
    if not booking.get("can_cancel", False):
        raise HTTPException(status_code=400, detail="Cancellation not allowed (less than 2 hours before departure)")
    
    # Calculate refund amount (90% of total amount)
    refund_amount = booking["total_amount"] * 0.9
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": "cancelled",
                "cancellation_date": datetime.now(timezone.utc).isoformat(),
                "refund_amount": refund_amount
            }
        }
    )
    
    # Update available seats in schedule
    schedule = await db.bus_schedules.find_one({"id": booking["schedule_id"]})
    if schedule:
        new_available_seats = schedule["available_seats"] + len(booking["seats"])
        await db.bus_schedules.update_one(
            {"id": booking["schedule_id"]},
            {"$set": {"available_seats": new_available_seats}}
        )
    
    return {"message": "Booking cancelled successfully", "refund_amount": refund_amount}

# Admin Routes
@api_router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(admin_user: User = Depends(get_admin_user)):
    # Total bookings
    total_bookings = await db.bookings.count_documents({})
    
    # Total revenue
    revenue_pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.bookings.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Active users
    active_users = await db.users.count_documents({"is_active": True})
    
    # Popular routes
    route_pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$lookup": {
            "from": "bus_schedules",
            "localField": "schedule_id",
            "foreignField": "id",
            "as": "schedule"
        }},
        {"$unwind": "$schedule"},
        {"$lookup": {
            "from": "routes",
            "localField": "schedule.route_id",
            "foreignField": "id",
            "as": "route"
        }},
        {"$unwind": "$route"},
        {"$group": {
            "_id": {
                "origin": "$route.origin",
                "destination": "$route.destination"
            },
            "bookings": {"$sum": 1},
            "revenue": {"$sum": "$total_amount"}
        }},
        {"$sort": {"bookings": -1}},
        {"$limit": 5}
    ]
    popular_routes = await db.bookings.aggregate(route_pipeline).to_list(5)
    
    # Booking trends (last 7 days)
    trends_pipeline = [
        {"$match": {
            "booking_date": {
                "$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            }
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$booking_date"}}}},
            "bookings": {"$sum": 1},
            "revenue": {"$sum": "$total_amount"}
        }},
        {"$sort": {"_id": 1}}
    ]
    booking_trends = await db.bookings.aggregate(trends_pipeline).to_list(7)
    
    # Operator performance
    operator_pipeline = [
        {"$match": {"status": "confirmed"}},
        {"$lookup": {
            "from": "bus_schedules",
            "localField": "schedule_id",
            "foreignField": "id",
            "as": "schedule"
        }},
        {"$unwind": "$schedule"},
        {"$lookup": {
            "from": "buses",
            "localField": "schedule.bus_id",
            "foreignField": "id",
            "as": "bus"
        }},
        {"$unwind": "$bus"},
        {"$lookup": {
            "from": "bus_operators",
            "localField": "bus.operator_id",
            "foreignField": "id",
            "as": "operator"
        }},
        {"$unwind": "$operator"},
        {"$group": {
            "_id": "$operator.id",
            "name": {"$first": "$operator.name"},
            "bookings": {"$sum": 1},
            "revenue": {"$sum": "$total_amount"}
        }},
        {"$sort": {"revenue": -1}}
    ]
    operator_performance = await db.bookings.aggregate(operator_pipeline).to_list(10)
    
    return AdminStats(
        total_bookings=total_bookings,
        total_revenue=total_revenue,
        active_users=active_users,
        popular_routes=popular_routes,
        booking_trends=booking_trends,
        operator_performance=operator_performance
    )

@api_router.get("/admin/bookings")
async def get_all_bookings(
    admin_user: User = Depends(get_admin_user),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    # Build filter
    filter_dict = {}
    if status:
        filter_dict["status"] = status
    
    # Get total count
    total_count = await db.bookings.count_documents(filter_dict)
    
    # Get bookings with pagination
    skip = (page - 1) * limit
    bookings = await db.bookings.find(filter_dict).sort("booking_date", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for booking in bookings:
        booking = parse_from_mongo(booking)
        
        # Get user details
        user = await db.users.find_one({"id": booking["user_id"]})
        if user:
            user = parse_from_mongo(user)
            booking["user"] = {"id": user["id"], "email": user["email"], "full_name": user["full_name"]}
        
        # Get schedule details
        schedule = await db.bus_schedules.find_one({"id": booking["schedule_id"]})
        if schedule:
            schedule = parse_from_mongo(schedule)
            
            # Get route details
            route = await db.routes.find_one({"id": schedule["route_id"]})
            if route:
                route = parse_from_mongo(route)
                
                # Get bus details
                bus = await db.buses.find_one({"id": schedule["bus_id"]})
                if bus:
                    bus = parse_from_mongo(bus)
                    
                    # Get operator details
                    operator = await db.bus_operators.find_one({"id": bus["operator_id"]})
                    if operator:
                        operator = parse_from_mongo(operator)
                        
                        booking_detail = {
                            **booking,
                            "route": route,
                            "bus": bus,
                            "operator": operator,
                            "schedule": schedule
                        }
                        result.append(booking_detail)
    
    return {
        "bookings": result,
        "total_count": total_count,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit
    }

@api_router.post("/admin/cancel-booking/{booking_id}")
async def admin_cancel_booking(booking_id: str, admin_user: User = Depends(get_admin_user)):
    # Get booking
    booking = await db.bookings.find_one({"id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = parse_from_mongo(booking)
    
    if booking["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Booking cannot be cancelled")
    
    # Admin can cancel anytime - full refund
    refund_amount = booking["total_amount"]
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": "cancelled",
                "cancellation_date": datetime.now(timezone.utc).isoformat(),
                "refund_amount": refund_amount
            }
        }
    )
    
    # Update available seats in schedule
    schedule = await db.bus_schedules.find_one({"id": booking["schedule_id"]})
    if schedule:
        new_available_seats = schedule["available_seats"] + len(booking["seats"])
        await db.bus_schedules.update_one(
            {"id": booking["schedule_id"]},
            {"$set": {"available_seats": new_available_seats}}
        )
    
    return {"message": "Booking cancelled successfully", "refund_amount": refund_amount}

# Admin CRUD Routes
@api_router.post("/admin/operators", response_model=BusOperator)
async def create_operator(operator_data: BusOperatorCreate, admin_user: User = Depends(get_admin_user)):
    operator = BusOperator(**operator_data.dict())
    operator_dict = prepare_for_mongo(operator.dict())
    await db.bus_operators.insert_one(operator_dict)
    return operator

@api_router.get("/admin/operators")
async def get_operators(admin_user: User = Depends(get_admin_user)):
    operators = await db.bus_operators.find({"is_active": True}).to_list(100)
    return [parse_from_mongo(op) for op in operators]

@api_router.post("/admin/routes", response_model=Route)
async def create_route(route_data: RouteCreate, admin_user: User = Depends(get_admin_user)):
    route = Route(**route_data.dict())
    route_dict = prepare_for_mongo(route.dict())
    await db.routes.insert_one(route_dict)
    return route

@api_router.get("/admin/routes")
async def get_routes(admin_user: User = Depends(get_admin_user)):
    routes = await db.routes.find({"is_active": True}).to_list(100)
    return [parse_from_mongo(route) for route in routes]

@api_router.post("/admin/buses", response_model=Bus)
async def create_bus(bus_data: BusCreate, admin_user: User = Depends(get_admin_user)):
    # Verify operator exists
    operator = await db.bus_operators.find_one({"id": bus_data.operator_id, "is_active": True})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    bus = Bus(**bus_data.dict())
    bus_dict = prepare_for_mongo(bus.dict())
    await db.buses.insert_one(bus_dict)
    return bus

@api_router.get("/admin/buses")
async def get_buses(admin_user: User = Depends(get_admin_user)):
    buses = await db.buses.find({"is_active": True}).to_list(100)
    result = []
    for bus in buses:
        bus = parse_from_mongo(bus)
        operator = await db.bus_operators.find_one({"id": bus["operator_id"]})
        if operator:
            bus["operator"] = parse_from_mongo(operator)
        result.append(bus)
    return result

@api_router.post("/admin/schedules", response_model=BusSchedule)
async def create_schedule(schedule_data: BusScheduleCreate, admin_user: User = Depends(get_admin_user)):
    # Verify bus exists
    bus = await db.buses.find_one({"id": schedule_data.bus_id, "is_active": True})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    
    # Verify route exists
    route = await db.routes.find_one({"id": schedule_data.route_id, "is_active": True})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    schedule = BusSchedule(**schedule_data.dict(), available_seats=bus["total_seats"])
    schedule_dict = prepare_for_mongo(schedule.dict())
    await db.bus_schedules.insert_one(schedule_dict)
    return schedule

@api_router.get("/admin/schedules")
async def get_schedules(
    admin_user: User = Depends(get_admin_user),
    date: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    # Build filter
    filter_dict = {}
    if date:
        filter_dict["date"] = date.isoformat()
    
    # Get total count
    total_count = await db.bus_schedules.count_documents(filter_dict)
    
    # Get schedules with pagination
    skip = (page - 1) * limit
    schedules = await db.bus_schedules.find(filter_dict).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for schedule in schedules:
        schedule = parse_from_mongo(schedule)
        
        # Get bus details
        bus = await db.buses.find_one({"id": schedule["bus_id"]})
        if bus:
            bus = parse_from_mongo(bus)
            schedule["bus"] = bus
            
            # Get operator details
            operator = await db.bus_operators.find_one({"id": bus["operator_id"]})
            if operator:
                schedule["operator"] = parse_from_mongo(operator)
        
        # Get route details
        route = await db.routes.find_one({"id": schedule["route_id"]})
        if route:
            schedule["route"] = parse_from_mongo(route)
        
        result.append(schedule)
    
    return {
        "schedules": result,
        "total_count": total_count,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit
    }

@api_router.put("/admin/cancel-trip/{schedule_id}")
async def cancel_trip(schedule_id: str, admin_user: User = Depends(get_admin_user)):
    # Update schedule status
    result = await db.bus_schedules.update_one(
        {"id": schedule_id},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Cancel all confirmed bookings for this trip
    bookings = await db.bookings.find({"schedule_id": schedule_id, "status": "confirmed"}).to_list(100)
    
    for booking in bookings:
        refund_amount = booking["total_amount"]  # Full refund for trip cancellation
        await db.bookings.update_one(
            {"id": booking["id"]},
            {
                "$set": {
                    "status": "cancelled",
                    "cancellation_date": datetime.now(timezone.utc).isoformat(),
                    "refund_amount": refund_amount
                }
            }
        )
    
    return {"message": f"Trip cancelled. {len(bookings)} bookings cancelled with full refund."}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()