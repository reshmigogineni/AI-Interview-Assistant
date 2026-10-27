from pydantic import BaseModel, ConfigDict


class StudentProfileCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    branch: str
    year: int
    skills: str | None = None
    interests: str | None = None