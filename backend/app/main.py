from fastapi import FastAPI

app = FastAPI(title="BeeChef API")

@app.get("/")
def read_root():
    return {"message": "BeeChef Backend API System!"}