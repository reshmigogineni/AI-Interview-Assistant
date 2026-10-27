import os

from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is missing. Please check your .env file."
    )

client = genai.Client(api_key=api_key)

MODEL_NAME = "gemini-3.5-flash-lite"


def test_gemini_connection():
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents="Reply with exactly: Gemini connection successful."
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return response.text.strip()


def generate_interview_question(
    branch: str,
    skills: str,
    difficulty: str,
    interview_type: str = "Technical",
    previous_questions: list[str] | None = None
):
    round_instructions = {
        "Aptitude": """
Create one quantitative aptitude, logical reasoning, or analytical
reasoning question suitable for a placement interview.

Include all information needed to solve the question.
Do not include the answer, hints, or solution.
""",

        "Technical": """
Ask one technical interview question related to the student's
academic branch, programming knowledge, or technical skills.

Focus on understanding, concepts, and technical accuracy.
Do not include the answer.
""",

        "Coding": """
Create one programming problem suitable for a placement interview.

Clearly specify:
- Problem statement
- Input format
- Output format
- Constraints, when relevant

Do not provide code, hints, or the solution.
""",

        "HR": """
Ask one HR interview question about communication, teamwork,
strengths, weaknesses, leadership, adaptability, or career goals.

Use a realistic placement-interview scenario where appropriate.
Ask only one question.
""",

        "Resume/Project": """
Ask one question about the student's project, personal contribution,
design decisions, technical challenges, or project outcomes.

Do not provide an answer.
"""
    }

    if interview_type not in round_instructions:
        raise ValueError(
            f"Unsupported interview round: {interview_type}. "
            f"Supported rounds: {', '.join(round_instructions.keys())}"
        )

    # Use an empty list when no previous questions are provided.
    previous_questions = previous_questions or []

    if previous_questions:
        previous_questions_text = "\n".join(
            f"{index}. {question}"
            for index, question in enumerate(
                previous_questions,
                start=1
            )
        )
    else:
        previous_questions_text = "No previous questions."

    prompt = f"""
You are an AI placement interviewer for B.Tech students.

Your task is to generate the next question in an ongoing mock interview.

INTERVIEW ROUND: {interview_type}
STUDENT BRANCH: {branch}
STUDENT SKILLS: {skills}
DIFFICULTY: {difficulty}

PREVIOUSLY ASKED QUESTIONS:
{previous_questions_text}

ROUND-SPECIFIC INSTRUCTIONS:
{round_instructions[interview_type]}

QUESTION VARIETY RULES:
1. Generate exactly ONE new question.
2. Do not repeat any previously asked question.
3. Avoid testing the same concept or topic covered by previous questions.
4. Choose a different concept, skill, scenario, or problem-solving approach.
5. Review the previous questions carefully before choosing a topic.
6. Keep the question relevant to the interview round and student skills.
7. Match the requested difficulty: {difficulty}.
8. Use clear, professional language appropriate for placement interviews.
9. Do not provide an answer, solution, hints, or evaluation.
10. Do not generate multiple questions.
11. For Coding rounds, use a different programming problem or approach
    from previous coding questions.
12. For HR rounds, explore a different competency or situation.
13. Return only the question or problem, without introductory commentary.

Generate the next question now.
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )

    if not response.text or not response.text.strip():
        raise RuntimeError(
            "Gemini could not generate a question. Please try again."
        )

    return response.text.strip()
