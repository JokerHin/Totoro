import os
import logging
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Text, JSON, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("totoro-db")
logging.basicConfig(level=logging.INFO)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "uploaded_notes", "totoro.db")

# 1. Determine Database URL
# Support standard DATABASE_URL or individual RDS/ESO environment variables
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    db_host = os.getenv("DB_HOST") or os.getenv("POSTGRES_HOST")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "totoro_admin")
    db_password = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "password")
    db_name = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "totorodb")

    if db_host:
        DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    else:
        # Default local fallback
        DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

# 2. Resilient Database Engine with SQLite Fallback
def get_engine(url: str):
    # Ensure sqlite directory exists if using local sqlite
    if url.startswith("sqlite"):
        os.makedirs(os.path.dirname(DEFAULT_SQLITE_PATH), exist_ok=True)
        return create_engine(url, connect_args={"check_same_thread": False})
    
    try:
        engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"connect_timeout": 5}
        )
        # Test connection
        with engine.connect() as conn:
            pass
        logger.info(f"Successfully connected to PostgreSQL at {url.split('@')[-1] if '@' in url else 'RDS'}")
        return engine
    except Exception as e:
        logger.warning(
            f"Failed to connect to primary database ({url.split('@')[-1] if '@' in url else 'PostgreSQL'}): {e}. "
            "Falling back to local SQLite database for zero-downtime operation."
        )
        os.makedirs(os.path.dirname(DEFAULT_SQLITE_PATH), exist_ok=True)
        return create_engine(f"sqlite:///{DEFAULT_SQLITE_PATH}", connect_args={"check_same_thread": False})

engine = get_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 3. Models
class UploadedFileRecord(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String, index=True, nullable=False)
    file_type = Column(String, default="document")
    file_size = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    summary = Column(Text, default="")

class KnowledgeNodeRecord(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(String, primary_key=True, index=True)
    label = Column(String, index=True, nullable=False)
    type = Column(String, default="concept") # concept, big_topic, architecture, subtopic
    community = Column(String, default="General")
    color = Column(String, default="#3b82f6")
    content = Column(Text, default="") # Detailed study content & notes extracted from the document
    summary = Column(Text, default="") # 1-sentence quick summary
    source = Column(String, default="") # Module / Document name
    degree = Column(Integer, default=1)
    file_ids = Column(JSON, default=list) # List of file IDs referencing this node
    file_names = Column(JSON, default=list) # List of file names referencing this node

class KnowledgeEdgeRecord(Base):
    __tablename__ = "knowledge_edges"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    source = Column(String, index=True, nullable=False)
    target = Column(String, index=True, nullable=False)
    relation = Column(String, default="connects_to")
    file_ids = Column(JSON, default=list)

# 4. Database Initializer
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error during init_db: {e}")
