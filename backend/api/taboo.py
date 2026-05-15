import re
from fastapi import APIRouter, HTTPException
from models.request_models import TabooWordRequest
from database import get_conn

router = APIRouter()

def filter_taboo(text: str) -> tuple[str, int]:
    with get_conn() as conn:
        rows = conn.execute("SELECT word FROM taboo_words").fetchall()
        words = [r['word'] for r in rows]

    count = 0
    for word in words:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        matches = pattern.findall(text)
        if matches:
            count += len(matches)
            censored = word[0] + '*' * (len(word) - 1)
            text = pattern.sub(censored, text)

    return text, count

@router.get("/api/taboo-words")
async def get_taboo_words():
    """Get all taboo words"""
    with get_conn() as conn:
        words = conn.execute("SELECT word FROM taboo_words ORDER BY word").fetchall()
        return {"words": [w['word'] for w in words]}

@router.post("/api/taboo-word/add")
async def add_taboo_word(req: TabooWordRequest):
    """Add a new taboo word"""
    word = req.word.lower().strip()
    if not word:
        return {"success": False, "message": "Word cannot be empty"}
    
    with get_conn() as conn:
        try:
            conn.execute("INSERT INTO taboo_words (word) VALUES (?)", (word,))
            return {"success": True, "message": f"Added '{word}'"}
        except Exception as e:
            return {"success": False, "message": "Word already exists"}

@router.post("/api/taboo-word/remove")
async def remove_taboo_word(req: TabooWordRequest):
    """Remove a taboo word"""
    word = req.word.lower().strip()
    
    with get_conn() as conn:
        conn.execute("DELETE FROM taboo_words WHERE word = ?", (word,))
        return {"success": True, "message": f"Removed '{word}'"}

@router.delete("/api/taboo-word/{word}")
async def delete_taboo_word(word: str):
    """Delete a taboo word (alternative RESTful endpoint)"""
    word = word.lower().strip()
    
    with get_conn() as conn:
        conn.execute("DELETE FROM taboo_words WHERE word = ?", (word,))
        return {"success": True, "message": f"Removed '{word}'"}