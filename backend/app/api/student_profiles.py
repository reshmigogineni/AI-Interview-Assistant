from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.student_profile import StudentProfile
from app.schemas.student_profile import StudentProfileCreate
from app.auth import get_current_user


router = APIRouter(
    prefix="/student-profiles",
    tags=["Student Profiles"]
)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_student_profile(
    profile: StudentProfileCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Prevent creating a second profile for the same user.
    existing_profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == current_user.id
    ).first()

    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student profile already exists for this account."
        )

    new_profile = StudentProfile(
        user_id=current_user.id,
        branch=profile.branch,
        year=profile.year,
        skills=profile.skills,
        interests=profile.interests
    )

    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    return {
        "message": "Student profile created successfully",
        "profile_id": new_profile.id,
        "user_id": current_user.id
    }