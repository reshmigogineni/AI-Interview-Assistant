from sqlalchemy import Column, Integer, Float, Text, ForeignKey, DateTime
from datetime import datetime

from app.database.session import Base


class InterviewReport(Base):
    __tablename__ = "interview_reports"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer,
        ForeignKey("interview_sessions.id"),
        nullable=False
    )

    overall_score = Column(Float)

    strengths = Column(Text)
    weaknesses = Column(Text)
    recommendations = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)