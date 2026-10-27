from app.database.session import Base, engine
from app.models import User

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")