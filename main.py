import sqlite3 as sq
import fastapi
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

app = fastapi.FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

class addScore(BaseModel):
    username: str
    score: int
    difficulty: str

class Note(BaseModel):
    username: str
    note: str

@app.get("/top10/")
def top10():
    try:
        conn = sq.connect("database.db")
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM highscores ORDER BY score DESC LIMIT 10")
        result = cursor.fetchall()
        result = [{"username" : n[0], "score" : n[1], "difficulty" : n[2]} for n in result]

        return result
    except Exception as e:
        raise HTTPException(500, f"can not get the top 10, {e}")
    finally:
        conn.close()

@app.post("/add_score/")
def add_score(i: addScore):
    try:
        conn = sq.connect("database.db")
        cursor = conn.cursor()

        cursor.execute("INSERT INTO highscores (username, score, difficulty) VALUES (?, ?, ?)",(i.username, i.score, i.difficulty))
        conn.commit()

        return {"details":"Added successfully"}
    except Exception as e:
        raise HTTPException(500, f"Could not add the new score, {e}")
    finally:
        conn.close()

@app.get("/top5pr/{username}")
def top5pr(username: str):
    try:
        conn = sq.connect("database.db")
        cursor = conn.cursor()

        cursor.execute("SELECT score FROM highscores WHERE username = ?",(username,))
        result = cursor.fetchall()

        if not result:
            raise HTTPException(404, "user not found")
        return result[0]
    except HTTPException:
        raise HTTPException(404, "user not found")
    except Exception as e:
        raise HTTPException(500, f"an error occured, {e}")
    finally:
        conn.close()

@app.get("/notes/")
def get_notes(username: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    try:
        conn = sq.connect("database.db")
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM notes")
        result = cursor.fetchall()
        result = [{"username" : n[0], "note" : n[1], "date" : n[2]} for n in result]

        if username:
            result = list(filter(lambda n: n["username"]==username, result))
        if start_date:
            result = list(filter(lambda n: n["date"]>=start_date, result))
        if end_date:
            result = list(filter(lambda n: n["date"]<=end_date, result))

        return result
    except HTTPException:
        raise HTTPException(500, "")
    except Exception as e:
        raise HTTPException(500, f"an error occured, {e}")
    finally:
        conn.close()

@app.post("/add_note/")
def add_note(note: Note):
    try:
        conn = sq.connect("database.db")
        cursor = conn.cursor()

        cursor.execute("INSERT INTO notes (username, note, date) VALUES (?, ?, ?)",(note.username, note.note, datetime.now().strftime("%Y/%m/%d")))

        conn.commit()
        return {"details":"note added succesfully"}
    except HTTPException:
        raise HTTPException(500)
    except Exception as e:
        raise HTTPException(500, f"an error occured, {e}")
    finally:
        conn.close()
