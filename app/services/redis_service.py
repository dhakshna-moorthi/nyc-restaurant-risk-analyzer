import redis
import os
from dotenv import load_dotenv

load_dotenv()

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

def get_cached(key: str):
    return redis_client.get(key)

def set_cached(key: str, value: str, ttl_days: int = 30):
    redis_client.setex(key, ttl_days * 24 * 60 * 60, value)

def delete_cached(key: str):
    redis_client.delete(key)