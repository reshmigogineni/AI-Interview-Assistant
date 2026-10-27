from sqlalchemy import Column, Integer, Text, ForeignKey, Float

from app.database.session import Base


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer,
        ForeignKey("interview_questions.id"),
        nullable=False
    )

    answer_text = Column(Text, nullable=False)

    relevance_score = Column(Float)
    technical_score = Column(Float)
    clarity_score = Column(Float)
    completeness_score = Column(Float)
    total_score = Column(Float)

    feedback = Column(Text)