from sqlalchemy import Column, BigInteger, String, Float, Date, Text, Integer, ForeignKey
from app.database import Base
from pgvector.sqlalchemy import Vector

class Restaurant(Base):
    __tablename__ = "restaurants"
    camis = Column(BigInteger, primary_key=True)
    dba = Column(String)
    boro = Column(String)
    cuisine_description = Column(String)


class Inspection(Base):
    __tablename__ = "inspections"
    inspection_id = Column(Integer, primary_key=True, autoincrement=True)
    camis = Column(BigInteger, ForeignKey("restaurants.camis"))
    inspection_date = Column(Date)
    action = Column(String)
    violation_code = Column(String)
    violation_description = Column(Text)
    critical_flag = Column(String)
    score = Column(Integer)
    grade = Column(String)
    grade_date = Column(Date)
    record_date = Column(Date)
    inspection_type = Column(String)


class ViolationCode(Base):
    __tablename__ = "violation_codes"
    violation_code = Column(String, primary_key=True)
    category = Column(String)
    severity_tier = Column(String)
    base_points = Column(Integer)


class RiskScore(Base):
    __tablename__ = "risk_scores"
    camis = Column(BigInteger, ForeignKey("restaurants.camis"), primary_key=True)
    risk_score = Column(Float)
    risk_percentile = Column(Float)
    criticality = Column(String)
    trend = Column(String)
    computed_at = Column(Date)


class ViolationEmbedding(Base):
    __tablename__ = "violation_embeddings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    camis = Column(BigInteger, ForeignKey("restaurants.camis"))
    violation_text = Column(Text)
    embedding = Column(Vector(384))