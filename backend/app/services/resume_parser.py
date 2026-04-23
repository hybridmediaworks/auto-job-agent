"""
backend/app/services/resume_parser.py

Extract text from PDF/DOCX resumes and parse with Claude into ResumeData JSON.
"""

import io
import json
import re

import anthropic

_MODEL = "claude-sonnet-4-6"

_SYSTEM_PROMPT = """You are a resume parser. Extract structured data from the provided resume text.
Return ONLY valid JSON with no markdown fences, explanations, or extra text.
The JSON must match this exact schema:
{
  "name": "string",
  "title": "string (professional title/headline)",
  "email": "string",
  "phone": "string",
  "location": "string (city, state or city, country)",
  "linkedin": "string or null",
  "github": "string or null",
  "portfolio": "string or null",
  "summary": "string (professional summary paragraph)",
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "start_date": "string (e.g. Jan 2020)",
      "end_date": "string (e.g. Dec 2022 or Present)",
      "bullets": ["string", ...]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "location": "string",
      "start_date": "string or null (e.g. Sep 2014)",
      "graduation": "string (e.g. May 2018)"
    }
  ],
  "skills": {
    "languages": ["string", ...],
    "frameworks": ["string", ...],
    "tools": ["string", ...]
  },
  "key_achievements": ["string", ...],
  "languages": [
    {
      "name": "string (e.g. English)",
      "level": "string (e.g. Native, Fluent, Professional, Conversational, Basic)",
      "proficiency": "number 1-5 (5=Native/Fluent, 4=Professional, 3=Conversational, 2=Basic, 1=Beginner)"
    }
  ],
  "projects": [
    {
      "name": "string",
      "start_date": "string or null (e.g. Jan 2020)",
      "end_date": "string or null",
      "description": "string (one sentence project description)",
      "bullets": ["string", ...]
    }
  ]
}
Rules:
- Use empty string "" for missing string fields (not null)
- Use [] for missing array fields
- For skills, categorize appropriately; if unsure, put in "tools"
- key_achievements should only include notable awards, certifications, or standout metrics
- Keep summary concise (2-4 sentences)
- languages: extract ALL spoken/written languages mentioned with their proficiency levels
- projects: extract ALL projects, side projects, personal projects, final year projects mentioned
"""


def extract_text_from_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_resume_with_claude(raw_text: str, anthropic_api_key: str) -> dict:
    client = anthropic.Anthropic(api_key=anthropic_api_key)
    response = client.messages.create(
        model=_MODEL,
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Parse this resume:\n\n{raw_text}"}],
        temperature=0,
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)
