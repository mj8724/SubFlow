from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.api import router as api_router

app = FastAPI(title="AutoSub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to AutoSub API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8888, reload=True)
