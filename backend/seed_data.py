import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, date, time
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def seed_database():
    print("Seeding database with sample data...")
    
    # Clear existing data
    await db.bus_operators.delete_many({})
    await db.routes.delete_many({})
    await db.buses.delete_many({})
    await db.bus_schedules.delete_many({})
    
    # Seed bus operators
    operators = [
        {
            "id": str(uuid.uuid4()),
            "name": "RedBus Express",
            "contact_email": "contact@redbusexpress.com",
            "contact_phone": "+91-9876543210",
            "rating": 4.5,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "VRL Travels",
            "contact_email": "info@vrltravels.com",
            "contact_phone": "+91-9876543211",
            "rating": 4.2,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Orange Tours",
            "contact_email": "support@orangetours.com",
            "contact_phone": "+91-9876543212",
            "rating": 4.3,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "SRS Travels",
            "contact_email": "care@srstravels.com",
            "contact_phone": "+91-9876543213",
            "rating": 4.1,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.bus_operators.insert_many(operators)
    print(f"Inserted {len(operators)} bus operators")
    
    # Seed routes
    routes = [
        {
            "id": str(uuid.uuid4()),
            "origin": "Mumbai",
            "destination": "Pune",
            "distance_km": 150.0,
            "estimated_duration_hours": 3.5,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "origin": "Delhi",
            "destination": "Jaipur",
            "distance_km": 280.0,
            "estimated_duration_hours": 5.5,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "origin": "Bangalore",
            "destination": "Chennai",
            "distance_km": 350.0,
            "estimated_duration_hours": 6.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "origin": "Hyderabad",
            "destination": "Bangalore",
            "distance_km": 570.0,
            "estimated_duration_hours": 8.5,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "origin": "Chennai",
            "destination": "Bangalore",
            "distance_km": 350.0,
            "estimated_duration_hours": 6.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.routes.insert_many(routes)
    print(f"Inserted {len(routes)} routes")
    
    # Seed buses
    buses = []
    bus_types = ["AC Sleeper", "Non-AC Sleeper", "AC Semi-Sleeper", "AC Seater"]
    amenities_options = [
        ["WiFi", "Charging Port", "Blanket", "Water Bottle"],
        ["TV", "Music", "Reading Light", "Pillow"],
        ["AC", "Recliner Seat", "Snacks", "GPS Tracking"],
        ["WiFi", "Charging Port", "TV", "AC"]
    ]
    
    for i, operator in enumerate(operators):
        for j in range(2):  # 2 buses per operator
            bus_id = str(uuid.uuid4())
            buses.append({
                "id": bus_id,
                "operator_id": operator["id"],
                "bus_number": f"{operator['name'][:3].upper()}-{1000 + i*2 + j}",
                "bus_type": bus_types[j % len(bus_types)],
                "total_seats": 40 if "Sleeper" in bus_types[j % len(bus_types)] else 45,
                "amenities": amenities_options[j % len(amenities_options)],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    await db.buses.insert_many(buses)
    print(f"Inserted {len(buses)} buses")
    
    # Seed bus schedules for next 7 days
    schedules = []
    from datetime import timedelta
    
    for route in routes:
        for bus in buses:
            # Check if this operator serves this route (distribute randomly)
            if hash(bus["operator_id"] + route["id"]) % 3 == 0:  # ~33% routes per operator
                for day_offset in range(7):  # Next 7 days
                    schedule_date = date.today() + timedelta(days=day_offset)
                    
                    # Multiple schedules per day
                    departure_times = ["06:00:00", "10:30:00", "15:15:00", "20:45:00", "23:30:00"]
                    
                    for i, dep_time in enumerate(departure_times):
                        if hash(bus["id"] + str(day_offset) + dep_time) % 2 == 0:  # 50% chance
                            departure_time_obj = time.fromisoformat(dep_time)
                            
                            # Calculate arrival time
                            dep_minutes = departure_time_obj.hour * 60 + departure_time_obj.minute
                            duration_minutes = int(route["estimated_duration_hours"] * 60)
                            arr_minutes = (dep_minutes + duration_minutes) % (24 * 60)
                            arrival_time_obj = time(arr_minutes // 60, arr_minutes % 60)
                            
                            # Price calculation based on distance and bus type
                            base_price = route["distance_km"] * 2
                            if "AC" in bus["bus_type"]:
                                base_price *= 1.5
                            if "Sleeper" in bus["bus_type"]:
                                base_price *= 1.3
                            
                            schedules.append({
                                "id": str(uuid.uuid4()),
                                "bus_id": bus["id"],
                                "route_id": route["id"],
                                "departure_time": dep_time,
                                "arrival_time": arrival_time_obj.strftime('%H:%M:%S'),
                                "price": round(base_price, 2),
                                "date": schedule_date.isoformat(),
                                "available_seats": bus["total_seats"] - (hash(bus["id"] + str(day_offset)) % 10),  # Random bookings
                                "created_at": datetime.now(timezone.utc).isoformat()
                            })
    
    await db.bus_schedules.insert_many(schedules)
    print(f"Inserted {len(schedules)} bus schedules")
    
    print("Database seeding completed successfully!")
    
    # Print summary
    print("\n=== SEEDING SUMMARY ===")
    print(f"Bus Operators: {len(operators)}")
    print(f"Routes: {len(routes)}")
    print(f"Buses: {len(buses)}")
    print(f"Schedules: {len(schedules)}")
    print("\n=== SAMPLE ROUTES ===")
    for route in routes[:3]:
        print(f"- {route['origin']} → {route['destination']} ({route['distance_km']}km)")

if __name__ == "__main__":
    asyncio.run(seed_database())