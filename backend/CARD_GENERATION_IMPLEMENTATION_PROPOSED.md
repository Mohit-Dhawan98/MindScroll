# Implementation Strategy — 80/20 Plan for MindScroll Card Extraction

**Purpose:** Give the Data‑Science (DS) + Engineering team a pragmatic roadmap that focuses on the *20 % of work* that yields *≈80 % of user‑visible value* for automatic micro‑learning card generation from PDFs, ePubs, and web articles.

---

## 1 | Guiding Principles

1. **Start simple, iterate fast.** Ship a thin but end‑to‑end vertical slice that already delivers usable summary + flash + quiz cards.
2. **Leverage proven, off‑the‑shelf NLP pieces** (Sentence‑Transformers, TextRank, GPT‑4, FAISS) before investing in custom research.
3. **Ground everything in source text** (retrieval or rules) to avoid hallucinations.
4. **Automate evaluation** early (accuracy checks, duplicate filtering) so manual QA doesn’t become a bottleneck.

---

## 2 | Phase 1 (“20 % Effort → 80 % Output”) — 4 Weeks

*Outcome:* Fully automated pipeline that ingests a book/article and outputs three card types:

* **Summary Cards:** 3–7 bullet key takeaways per chapter/topic.
* **Flashcards:** 20–40 Q‑A pairs.
* **Quiz Cards:** 10 MCQs with distractors.

### 2.1 Architecture Snapshot

```
PDF/ePub/HTML ─▶ Parser & Chunker ─▶ Embeddings (all‑MiniLM) ─▶ FAISS index
                                   └▶ TextRank per chunk        │
                                                     ▲        │ Semantic search
                                                     │        ▼
                     LLM (GPT‑4)  ◀── RAG prompt ─── Retriever (chunks)
                                              │
                ├── Summary generation         │
                ├── Flashcard Q‑A generation   │
                └── MCQ generation w/ simple   │
                    similarity‑based distractors
```

### 2.2 Key Deliverables & Owners

| # | Deliverable                                          | Lead        | Acceptance Criteria                                           | Research Backing                                   |
| - | ---------------------------------------------------- | ----------- | ------------------------------------------------------------- | -------------------------------------------------- |
| 1 | **Universal Parser & Chunker** (PDF→text, HTML→text) | Backend Eng | 95 % pages parsed; chunks ≤1 000 tokens                       | *PyMuPDF* docs; Stanford NLP tokenization papers   |
| 2 | **Embedding + Vector DB**                            | DS          | All chunks embedded (all‑MiniLM L6‑v2); FAISS search ≤200 ms  | (Reimers & Gurevych 2020) Sentence‑BERT            |
| 3 | **TextRank Extractive Summarizer**                   | DS          | Top‑N sentences cover ≥85 % ROUGE‑1 vs. chapter               | (Mihalcea & Tarau 2004) TextRank                   |
| 4 | **RAG Prompts for GPT‑4**                            | DS          | Avg. summary ≤120 words/chapter; grounded citations           | (Lewis et al. 2020) RAG; OpenAI doc best‑practices |
| 5 | **Flashcard Q‑A Generator**                          | DS          | ≥20 factual Q‑A per book; answer string appears in source     | (Sun et al. 2020) QG via LMs                       |
| 6 | **MCQ Distractor Selector**                          | DS          | ≥3 distractors per Q with cosine≥0.5 to answer, not identical | (Guo et al. 2023) semantic distractors             |
| 7 | **Automatic QA Filter** (BERT QA self‑check)         | DS          | ≥90 % generated Qs validated true                             | (Khashabi et al. 2022) QA consistency              |
| 8 | **JSON Card Export & Stub UI Feed**                  | Frontend    | Cards render in dev app; swipe works; answer reveal toggles   | Figma wire → Flutter proof                         |

> **Milestone Definition of Done:** One sample PDF processed → cards visible in app in ≤5 min with <5 % invalid cards in QA log.

---

## 3 | Phase 2 (“Next 20 % Effort → +15 % Value”) — Weeks 5‑8

Refine quality & breadth once Phase 1 is live.

1. **Topic Modeling (BERTopic)** for better coverage → cluster‑aware sampling of chunks.
2. **Knowledge‑Graph Triple Extraction** → richer flashcards & entity‑level quizzes.
3. **Hierarchical Summarization** (chunk→chapter→book) for cleaner multi‑granularity cards.
4. **Advanced Distractor Gen** using KG & WordNet for plausible confounders.
5. **Spaced‑Repetition Scheduling** (SM‑2 algo) driven by user scores.

---

## 4 | Phase 3 (Polish & Scale) — Weeks 9‑12

* Audio TTS clips (ElevenLabs).
* UI polish, dark‑mode, accessibility.
* Batch processing farm + queue.
* Analytics dashboard (ROUGE, answer‑match %, user retention).

---

## 5 | Research Footnotes

1. **TextRank** – Mihalcea & Tarau 2004, “TextRank: Bringing Order into Texts.”
2. **Sentence‑BERT** – Reimers & Gurevych 2019, “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.”
3. **RAG** – Lewis et al. 2020, “Retrieval‑Augmented Generation for Knowledge‑Intensive NLP Tasks.”
4. **BERTopic** – Grootendorst 2021, “BERTopic: Leveraging BERT and c-TF-IDF to create easily interpretable topics.”
5. **QG & QA Consistency** – Sun et al. 2020; Khashabi et al. 2022.
6. **Semantic Distractor Generation** – Guo et al. 2023, “Improving MCQ Distractors via Embedding Similarity.”

---

## 6 | Call to Action (Next‑Week Sprint)

* **Backend Eng:** Stand up parsing & FAISS index; deliver sample embeddings.
* **DS:** Prototype TextRank + GPT‑4 RAG summarization on one ePub.
* **Frontend:** Build minimal card viewer (JSON → Flutter cards).
* **All:** Meet Friday → live demo end‑to‑end path on “Atomic Habits” PDF.

---

*Follow this 80/20 plan to get a usable, high‑impact MVP fast. We can layer sophistication once users are learning happily!*
