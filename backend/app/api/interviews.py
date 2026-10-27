from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.gemini_service import generate_interview_question
from app.scoring.evaluation import evaluate_answer


router = APIRouter(prefix="/interview", tags=["Interview"])


class QuestionRequest(BaseModel):
    branch: str
    skills: str
    difficulty: str


class AnswerRequest(BaseModel):
    question: str
    answer: str


@router.post("/question")
def get_question(data: QuestionRequest):

    question = generate_interview_question(
        data.branch,
        data.skills,
        data.difficulty
    )

    return {
        "question": question
    }


@router.post("/evaluate")
def evaluate_student_answer(data: AnswerRequest):

    result = evaluate_answer(
        data.question,
        data.answer
    )

    return result