import { useState, useEffect } from 'react';
import { PageTitle, Card, Input, Btn, Tag, Alert, SectionTitle } from '../../components/UI.jsx';

const API_BASE = 'http://localhost:8000';

export default function TabooWords({ navigate }) {
  const [loading, setLoading] = useState(true);
  const [tabooWords, setTabooWordsState] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);


  // Fetch taboo words from backend
  const fetchTabooWords = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/taboo-words`);
      const data = await response.json();
      setTabooWordsState(data.words || []);

    } catch (error) {
      console.error('Failed to fetch taboo words:', error);
      setMsg('Failed to load taboo words');
      setTimeout(() => setMsg(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabooWords();
  }, [refreshTrigger]);

  // ===== Actions ================================================================= 
  // Add a new word to the taboo list, with validation to prevent empty or duplicate entries

  const addWord = async () => {
    // Normalize to lowercase and guard against empty input or duplicates
    const w = newWord.trim().toLowerCase();
    if (!w) return;

    if (tabooWords.includes(w)) {
      setMsg('Word already in list.');
      setTimeout(() => setMsg(''), 2000);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/taboo-word/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: w })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`"${w}" added to taboo list.`);
        setNewWord('');
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to add taboo word:', error);
      setMsg('Failed to add taboo word');
      setTimeout(() => setMsg(''), 2000);
    }
  };

  // Remove word from taboo list
  const removeWord = async (word) => {
    try {
      const response = await fetch(`${API_BASE}/api/taboo-word/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      });

      const result = await response.json();

      if (result.success) {
        setMsg(`"${word}" removed.`);
        setRefreshTrigger(prev => prev + 1);
      } else {
        setMsg(`Error: ${result.message}`);
      }

      setTimeout(() => setMsg(''), 2000);
    } catch (error) {
      console.error('Failed to remove taboo word:', error);
      setMsg('Failed to remove taboo word');
      setTimeout(() => setMsg(''), 2000);
    }
  };


  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div>Loading taboo words...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <PageTitle sub="Manage the list of censored words in reviews">Taboo Words</PageTitle>

      {msg && <Alert type="info">{msg}</Alert>}

      {/* ── Add Word Card ────────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionTitle>Add New Taboo Word</SectionTitle>
        {/* Policy description: asterisk threshold and warning escalation rules */}
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '1rem', lineHeight: 1.5 }}>
          Words on this list are automatically censored in student reviews. Reviews with 1–2 occurrences are shown with asterisks; reviews with 3+ occurrences are hidden entirely and the author receives 2 warnings.
        </p>
        {/* Input supports Enter key as a shortcut for the Add button */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Input
            value={newWord}
            onChange={setNewWord}
            placeholder="Enter word..."
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
          />
          <Btn variant="primary" onClick={addWord}>Add</Btn>
        </div>
      </Card>

      {/* ── Current Words Card ───────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Current Taboo Words ({tabooWords.length})</SectionTitle>
        {tabooWords.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
            No taboo words defined.
          </p>
        )}
        {/* Tag cloud — each word chip has an inline × remove button */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {tabooWords.map(w => (
            <div
              key={w}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '0.3rem 0.6rem'
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{w}</span>
              {/* × button scales up on hover for a subtle affordance */}
              <button
                onClick={() => removeWord(w)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: 1,
                  padding: '0 2px',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}