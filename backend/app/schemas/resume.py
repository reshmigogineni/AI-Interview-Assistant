from pydantic import BaseModel


class ResumeCreate(BaseModel):
    user_id: int
    filename: str
    extracted_text: str | None = None
    parsed_data: str | None = None