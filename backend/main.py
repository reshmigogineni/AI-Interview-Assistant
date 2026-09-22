from fastapi import FastAPI

app = FastAPI(title="AI Interview Assistant API")


@app.get("/")
def root():
    return {
        "message": "AI Interview Assistant API is running!"
    }