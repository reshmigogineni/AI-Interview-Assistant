from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean

from app.database.session import Base


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"), nullable=False)

    question_number = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)

    category = Column(String(50), nullable=False)
    difficulty = Column(String(50), nullable=False)

    is_follow_up = Column(Boolean, default=False)