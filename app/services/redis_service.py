import os
from dotenv import load_dotenv
from upstash_redis import Redis

load_dotenv()

redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN")
)

def get_cached(key: str):
    return redis_client.get(key)

def set_cached(key: str, value: str, ttl_days: int = 30):
    redis_client.setex(key, ttl_days * 24 * 60 * 60, value)

def delete_cached(key: str):
    redis_client.delete(key)
