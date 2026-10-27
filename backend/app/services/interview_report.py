import json

from app.ai.gemini_service import client


def generate_interview_report(
    questions_and_answers: str
):
    prompt = f"""
You are an expert technical interview evaluator.

Analyze the following interview questions, student answers,
and their individual scores.

Interview Data:
{questions_and_answers}

Generate a final interview report.

The report must contain:

1. Overall score out of 10
2. Strengths
3. Weaknesses
4. Recommendations for improvement

Return ONLY valid JSON in exactly this format:

{{
    "overall_score": 0,
    "strengths": "...",
    "weaknesses": "...",
    "recommendations": "..."
}}
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )

    result = json.loads(response.text)

    return result