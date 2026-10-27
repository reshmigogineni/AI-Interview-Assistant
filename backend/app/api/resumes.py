from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.resume import Resume
from app.services.resume_parser import extract_resume_text
from app.auth import get_current_user


router = APIRouter(
    prefix="/resumes",
    tags=["Resumes"]
)

UPLOAD_DIRECTORY = Path(__file__).resolve().parents[2] / "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Validate the filename and extension.
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please select a resume file."
        )

    original_filename = Path(file.filename).name
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported."
        )

    # Read the file with a size limit.
    file_content = await file.read(MAX_FILE_SIZE + 1)

    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty."
        )

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume size must not exceed 5 MB."
        )

    # Store each uploaded resume under a unique filename.
    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIRECTORY / stored_filename

    try:
        file_path.write_bytes(file_content)

        extracted_text = extract_resume_text(str(file_path))

        if not extracted_text or not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No readable text was found. Please upload "
                    "a text-based PDF or DOCX."
                )
            )

        new_resume = Resume(
            user_id=current_user.id,
            filename=original_filename,
            extracted_text=extracted_text
        )

        db.add(new_resume)
        db.commit()
        db.refresh(new_resume)

    except HTTPException:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise

    except Exception as exc:
        db.rollback()
        file_path.unlink(missing_ok=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Resume upload failed. Please try again."
        ) from exc

    finally:
        await file.close()

    return {
        "message": "Resume uploaded successfully",
        "resume_id": new_resume.id,
        "user_id": current_user.id,
        "filename": original_filename,
        "extracted_text": extracted_text
    }