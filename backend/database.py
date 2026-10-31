import os
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://totoro_admin:password@localhost:5432/totorodb"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class GraphRecord(Base):
    __tablename__ = "knowledge_graphs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    nodes_data = Column(JSON)
    edges_data = Column(JSON)
    summary = Column(Text)

# Auto-create tables on startup
def init_db():
    Base.metadata.create_dir(bind=engine)