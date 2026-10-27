from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.session import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    skills = Column(String(500))
    interests = Column(String(500))