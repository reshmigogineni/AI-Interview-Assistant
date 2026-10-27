import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env
load_dotenv()

# Import API routers after loading environment variables
from app.api.users import router as users_router
from app.api.student_profiles import router as student_profiles_router
from app.api.resumes import router as resumes_router
from app.api.interviews import router as interviews_router
from app.api.interview_sessions import router as interview_sessions_router


# Initialize FastAPI application
app = FastAPI(
    title="AI Interview Assistant API",
    description="Backend API for the AI Interview Assistant project",
    version="1.0.0",
)


# Configure CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(users_router)
app.include_router(student_profiles_router)
app.include_router(resumes_router)
app.include_router(interviews_router)
app.include_router(interview_sessions_router)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "AI Interview Assistant API is running!"
    }


# Health-check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "AI Interview Assistant backend is running!"
    }