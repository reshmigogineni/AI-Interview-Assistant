from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db

from app.models.interview_session import InterviewSession
from app.models.interview_question import InterviewQuestion
from app.models.answer import Answer
from app.models.interview_report import InterviewReport

from app.ai.gemini_service import generate_interview_question
from app.scoring.evaluation import evaluate_answer
from app.services.interview_report import generate_interview_report


router = APIRouter(
    prefix="/interview-session",
    tags=["Interview Session"]
)


# =========================================================
# HELPER: GET INTERVIEW SESSION
# =========================================================

def get_session_or_404(session_id: int, db: Session):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Interview session not found"
        )

    return session


def ensure_session_in_progress(session):
    if session.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="This interview has already been completed"
        )

    if session.status == "paused":
        raise HTTPException(
            status_code=400,
            detail="Interview is paused. Resume it before continuing."
        )


# =========================================================
# START INTERVIEW
# =========================================================

class InterviewSessionRequest(BaseModel):
    user_id: int
    interview_type: str
    difficulty: str
    question_count: int = Field(ge=5, le=30)


@router.post("/start")
def start_interview(
    data: InterviewSessionRequest,
    db: Session = Depends(get_db)
):
    session = InterviewSession(
        user_id=data.user_id,
        interview_type=data.interview_type,
        difficulty=data.difficulty,
        question_count=data.question_count,
        status="in_progress"
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "message": "Interview session started successfully",
        "session_id": session.id,
        "status": session.status,
        "interview_type": session.interview_type,
        "difficulty": session.difficulty,
        "question_count": session.question_count
    }


# =========================================================
# GENERATE INTERVIEW QUESTION
# =========================================================

class QuestionRequest(BaseModel):
    branch: str
    skills: str
    interview_type: str = "Technical"


@router.post("/{session_id}/question")
def generate_question(
    session_id: int,
    data: QuestionRequest,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    ensure_session_in_progress(session)

    # Fetch questions already generated for this session.
    existing_questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session_id
    ).order_by(
        InterviewQuestion.question_number
    ).all()

    # Find questions that have already been answered.
    answered_question_ids = {
        answer.question_id
        for answer in db.query(Answer).join(
            InterviewQuestion,
            Answer.question_id == InterviewQuestion.id
        ).filter(
            InterviewQuestion.session_id == session_id
        ).all()
    }

    # Return an existing unanswered question.
    # This prevents generating another question on refresh or resume.
    for existing_question in existing_questions:
        if existing_question.id not in answered_question_ids:
            return {
                "session_id": session_id,
                "question_id": existing_question.id,
                "question_number": existing_question.question_number,
                "total_questions": session.question_count,
                "question": existing_question.question,
                "category": existing_question.category,
                "difficulty": existing_question.difficulty
            }

    # Stop when the question limit has been reached.
    if len(existing_questions) >= session.question_count:
        raise HTTPException(
            status_code=400,
            detail="The selected question limit has been reached"
        )

    question_number = len(existing_questions) + 1

    # Pass all previously generated questions to Gemini.
    previous_questions = [
        question.question
        for question in existing_questions
    ]

    try:
        question_text = generate_interview_question(
            branch=data.branch,
            skills=data.skills,
            difficulty=session.difficulty,
            interview_type=data.interview_type,
            previous_questions=previous_questions
        )

    except Exception as e:
        # Log the real error in the backend terminal for debugging.
        print(
            f"Question generation failed for session "
            f"{session_id}: {e}"
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to generate an interview question right now. "
                "Please try again."
            )
        ) from e

    if not question_text or not question_text.strip():
        raise HTTPException(
            status_code=503,
            detail="Gemini returned an empty question. Please try again."
        )

    # Save the newly generated question.
    question = InterviewQuestion(
        session_id=session_id,
        question_number=question_number,
        question=question_text.strip(),
        category=data.interview_type,
        difficulty=session.difficulty,
        is_follow_up=False
    )

    db.add(question)
    db.commit()
    db.refresh(question)

    return {
        "session_id": session_id,
        "question_id": question.id,
        "question_number": question.question_number,
        "total_questions": session.question_count,
        "question": question.question,
        "category": question.category,
        "difficulty": question.difficulty
    }


# =========================================================
# SUBMIT ANSWER
# =========================================================

class AnswerRequest(BaseModel):
    question_id: int
    answer: str = Field(min_length=1)


@router.post("/{session_id}/answer")
def submit_answer(
    session_id: int,
    data: AnswerRequest,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    ensure_session_in_progress(session)

    question = db.query(InterviewQuestion).filter(
        InterviewQuestion.id == data.question_id,
        InterviewQuestion.session_id == session_id
    ).first()

    if not question:
        raise HTTPException(
            status_code=404,
            detail="Question not found for this interview session"
        )

    cleaned_answer = data.answer.strip()

    if not cleaned_answer:
        raise HTTPException(
            status_code=422,
            detail="Please provide an answer"
        )

    existing_answer = db.query(Answer).filter(
        Answer.question_id == question.id
    ).first()

    if existing_answer:
        raise HTTPException(
            status_code=400,
            detail="An answer has already been submitted for this question"
        )

    answer = Answer(
        question_id=question.id,
        answer_text=cleaned_answer,
        relevance_score=0,
        technical_score=0,
        clarity_score=0,
        completeness_score=0,
        total_score=0,
        feedback="Evaluation pending until the interview is completed."
    )

    db.add(answer)
    db.commit()
    db.refresh(answer)

    answered_count = db.query(Answer).join(
        InterviewQuestion,
        Answer.question_id == InterviewQuestion.id
    ).filter(
        InterviewQuestion.session_id == session_id
    ).count()

    return {
        "session_id": session_id,
        "question_id": question.id,
        "question_number": question.question_number,
        "answer_id": answer.id,
        "message": "Answer saved successfully.",
        "answered_count": answered_count,
        "question_count": session.question_count,
        "is_last_question": answered_count >= session.question_count
    }


# =========================================================
# PAUSE INTERVIEW
# =========================================================

@router.post("/{session_id}/pause")
def pause_interview(
    session_id: int,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    if session.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="Completed interviews cannot be paused"
        )

    if session.status == "paused":
        return {
            "message": "Interview is already paused",
            "session_id": session.id,
            "status": session.status
        }

    session.status = "paused"
    db.commit()
    db.refresh(session)

    return {
        "message": "Interview paused successfully",
        "session_id": session.id,
        "status": session.status
    }


# =========================================================
# RESUME INTERVIEW
# =========================================================

@router.post("/{session_id}/resume")
def resume_interview(
    session_id: int,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    if session.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="Completed interviews cannot be resumed"
        )

    if session.status != "paused":
        raise HTTPException(
            status_code=400,
            detail="Only paused interviews can be resumed"
        )

    session.status = "in_progress"
    db.commit()
    db.refresh(session)

    return {
        "message": "Interview resumed successfully",
        "session_id": session.id,
        "status": session.status
    }


# =========================================================
# GET INTERVIEW PROGRESS
# =========================================================

@router.get("/{session_id}/progress")
def get_interview_progress(
    session_id: int,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session_id
    ).order_by(
        InterviewQuestion.question_number
    ).all()

    answers = db.query(Answer).join(
        InterviewQuestion,
        Answer.question_id == InterviewQuestion.id
    ).filter(
        InterviewQuestion.session_id == session_id
    ).all()

    answered_question_ids = {
        answer.question_id for answer in answers
    }

    next_question = next(
        (
            question for question in questions
            if question.id not in answered_question_ids
        ),
        None
    )

    return {
        "session_id": session.id,
        "status": session.status,
        "interview_type": session.interview_type,
        "difficulty": session.difficulty,
        "question_count": session.question_count,
        "answered_count": len(answered_question_ids),
        "generated_question_count": len(questions),
        "next_question": (
            {
                "question_id": next_question.id,
                "question_number": next_question.question_number,
                "question": next_question.question,
                "category": next_question.category,
                "difficulty": next_question.difficulty
            }
            if next_question else None
        )
    }


# =========================================================
# GENERATE FINAL INTERVIEW REPORT
# =========================================================

@router.post("/{session_id}/report")
def generate_report(
    session_id: int,
    db: Session = Depends(get_db)
):
    session = get_session_or_404(session_id, db)

    # Return an existing report if already generated.
    existing_report = db.query(InterviewReport).filter(
        InterviewReport.session_id == session_id
    ).first()

    if existing_report:
        return {
            "session_id": session_id,
            "report_id": existing_report.id,
            "overall_score": existing_report.overall_score,
            "strengths": existing_report.strengths,
            "weaknesses": existing_report.weaknesses,
            "recommendations": existing_report.recommendations,
            "status": session.status
        }

    if session.status == "paused":
        raise HTTPException(
            status_code=400,
            detail="Resume the interview before generating the report."
        )

    if session.status == "completed":
        raise HTTPException(
            status_code=400,
            detail="This interview is already completed."
        )

    questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session_id
    ).order_by(
        InterviewQuestion.question_number
    ).all()

    if len(questions) != session.question_count:
        raise HTTPException(
            status_code=400,
            detail=(
                f"This interview requires {session.question_count} questions. "
                f"Currently, {len(questions)} questions exist."
            )
        )

    question_answers = []

    for question in questions:
        answer = db.query(Answer).filter(
            Answer.question_id == question.id
        ).first()

        if not answer:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Please answer question "
                    f"{question.question_number} before generating the report."
                )
            )

        question_answers.append((question, answer))

    try:
        interview_data = ""

        for question, answer in question_answers:
            evaluation = evaluate_answer(
                question=question.question,
                answer=answer.answer_text
            )

            answer.relevance_score = evaluation["relevance_score"]
            answer.technical_score = evaluation["technical_score"]
            answer.clarity_score = evaluation["clarity_score"]
            answer.completeness_score = evaluation["completeness_score"]
            answer.total_score = evaluation["total_score"]
            answer.feedback = evaluation["feedback"]

            interview_data += f"""
Question {question.question_number}:
{question.question}

Candidate Answer:
{answer.answer_text}

Evaluation:
Relevance: {answer.relevance_score}
Technical Accuracy: {answer.technical_score}
Clarity: {answer.clarity_score}
Completeness: {answer.completeness_score}
Total Score: {answer.total_score}

Feedback:
{answer.feedback}

----------------------------------------
"""

        # Save individual evaluations.
        db.commit()

        report_data = generate_interview_report(interview_data)

        report = InterviewReport(
            session_id=session_id,
            overall_score=report_data["overall_score"],
            strengths=report_data["strengths"],
            weaknesses=report_data["weaknesses"],
            recommendations=report_data["recommendations"]
        )

        db.add(report)

        session.status = "completed"
        session.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(report)

        return {
            "message": (
                "Interview completed and final evaluation generated successfully"
            ),
            "session_id": session.id,
            "report_id": report.id,
            "overall_score": report.overall_score,
            "strengths": report.strengths,
            "weaknesses": report.weaknesses,
            "recommendations": report.recommendations,
            "status": session.status
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as e:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to generate the final interview report: "
                f"{str(e)}"
            )
        )


# =========================================================
# GET PREVIOUS INTERVIEW HISTORY
# =========================================================

@router.get("/history/{user_id}")
def get_interview_history(
    user_id: int,
    db: Session = Depends(get_db)
):
    sessions = db.query(InterviewSession).filter(
        InterviewSession.user_id == user_id
    ).order_by(
        InterviewSession.id.desc()
    ).all()

    history = []

    for session in sessions:
        report = db.query(InterviewReport).filter(
            InterviewReport.session_id == session.id
        ).first()

        answered_count = db.query(Answer).join(
            InterviewQuestion,
            Answer.question_id == InterviewQuestion.id
        ).filter(
            InterviewQuestion.session_id == session.id
        ).count()

        history.append({
            "session_id": session.id,
            "interview_type": session.interview_type,
            "difficulty": session.difficulty,
            "question_count": session.question_count,
            "answered_count": answered_count,
            "status": session.status,
            "started_at": (
                session.started_at.isoformat()
                if session.started_at else None
            ),
            "completed_at": (
                session.completed_at.isoformat()
                if session.completed_at else None
            ),
            "report": (
                {
                    "report_id": report.id,
                    "overall_score": report.overall_score,
                    "strengths": report.strengths,
                    "weaknesses": report.weaknesses,
                    "recommendations": report.recommendations,
                    "created_at": (
                        report.created_at.isoformat()
                        if report.created_at else None
                    )
                }
                if report else None
            )
        })

    return {
        "user_id": user_id,
        "total_interviews": len(history),
        "interviews": history
    }
