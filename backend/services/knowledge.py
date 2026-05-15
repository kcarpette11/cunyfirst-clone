import math
import re
from typing import List, Dict

# ===== Text processing utilities for TF-IDF ============================================================

def tokenize(text: str) -> List[str]:
    """Tokenize text for TF-IDF calculations"""
    stopwords = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "and", "or", "but", "in", "on", "at", "to", "for", "of",
        "with", "that", "this", "it", "its", "not", "can", "do",
        "has", "have", "had", "will", "would", "could", "should",
    }
    tokens = re.sub(r"[^a-z0-9\s]", " ", text.lower()).split()
    return [t for t in tokens if t not in stopwords and len(t) > 2]

# ===== TF-IDF implementation ============================================================

def build_idf(corpus: List[str]) -> Dict[str, float]:
    """Build IDF dictionary for the corpus"""
    total_docs = len(corpus)
    doc_freq: Dict[str, int] = {}
    
    for doc in corpus:
        for term in set(tokenize(doc)):
            doc_freq[term] = doc_freq.get(term, 0) + 1
    
    return {
        term: math.log((total_docs + 1) / (freq + 1)) + 1
        for term, freq in doc_freq.items()
    }

def tfidf_scores(query: str, corpus: List[str], idf: Dict[str, float]) -> List[float]:
    """Calculate TF-IDF scores for query against corpus"""
    query_terms = tokenize(query)
    scores = []
    
    for doc in corpus:
        doc_terms = tokenize(doc)
        term_freq: Dict[str, float] = {}
        
        for term in doc_terms:
            term_freq[term] = term_freq.get(term, 0) + 1
        
        doc_len = len(doc_terms) or 1
        
        score = sum(
            (term_freq.get(term, 0) / doc_len) * idf.get(term, 0)
            for term in query_terms
        )
        scores.append(score)
    
    return scores

# ===== Relevance retrieval ============================================================

def retrieve_relevant(
    question: str,
    corpus: List[str],
    idf: Dict[str, float],
    top_k: int = 6,
    threshold: float = 0.02,
) -> List[str]:
    """Retrieve relevant documents from corpus"""
    scores = tfidf_scores(question, corpus, idf)
    ranked = sorted(zip(scores, corpus), key=lambda x: x[0], reverse=True)
    
    return [
        doc for score, doc in ranked[:top_k]
        if score >= threshold
    ]

# ===== Static knowledge base ============================================================

# ===== Local Knowledge Building ============================================================
STATIC_KNOWLEDGE: List[str] = [
    "College0 is an AI-enabled graduate college management system.",
    "There are 4 user types: Registrar, Instructor, Student, and Visitor.",
    "The semester has 4 periods: class set-up, course registration, class running, and grading.",
    "Students must register for 2 to 4 courses per semester.",
    "Students can register only if there is no time conflict and the course is not full.",
    "If a course is full, students are added to a waitlist. Only the instructor can admit students from the waitlist.",
    "Courses with fewer than 3 students are cancelled at the start of the running period.",
    "Students with fewer than 2 courses at the start of the running period receive a warning.",
    "A student can retake a class only if they previously received an F in it.",
    "Reviews can be submitted during the class running period. Stars range from 1 to 5.",
    "Reviews with 1-2 taboo words are censored and the author receives 1 warning.",
    "Reviews with 3 or more taboo words are hidden and the author receives 2 warnings.",
    "Only registrars can see who wrote which review.",
    "An instructor is warned if their class average rating falls below 2.",
    "An instructor who accumulates 3 warnings is suspended.",
    "During grading, instructors assign grades: A, B, C, D, or F.",
    "Students with overall GPA below 2.0 or who fail the same course twice are terminated automatically.",
    "Students with GPA between 2.0 and 2.25 receive a warning and must interview with the registrar.",
    "Students finishing 8 classes can apply for graduation and earn a Bachelor's degree.",
    "Visitors can apply to be students or instructors.",
    "Registrars approve or reject applications.",
    "The program quota is the maximum number of students the college can enroll.",
    "Taboo words are configured by the registrar and are used to moderate reviews.",
    "New students must change their password on first login.",
]

# ===== Public interface to access static knowledge ============================================================

def get_static_knowledge() -> List[str]:
    """Return static knowledge base"""
    return STATIC_KNOWLEDGE.copy()