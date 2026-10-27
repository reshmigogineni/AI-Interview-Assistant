import json
from app.ai.gemini_service import client


def evaluate_answer(question: str, answer: str):
    prompt = f"""
You are an expert technical interviewer evaluating a B.Tech student's interview answer.

Interview Question:
{question}

Student Answer:
{answer}

Evaluate the student's answer on these four criteria:

1. Relevance — Does the answer directly address the question?
2. Technical Accuracy — Is the technical information correct?
3. Clarity — Is the answer clear and understandable?
4. Completeness — Does the answer adequately cover the important points?

Give each criterion a score from 0 to 10.

Then calculate the total_score as the average of the four scores.

Also provide concise feedback for the student.

Return ONLY valid JSON in exactly this format:

{{
    "relevance_score": 0,
    "technical_score": 0,
    "clarity_score": 0,
    "completeness_score": 0,
    "total_score": 0,
    "feedback": "..."
}}
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt
    )

    result = json.loads(response.text)

    return result