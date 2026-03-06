# HumanRankArena Frontend

Static arena UI with 4 tasks:
- `Math`, `Q&A`, `Coding`: user enters `problem`, picks 2 chat models, and compares answers.
- `Text-to-Image`: user enters prompt and compares 2 generated images.

## Run

```bash
python3 -m http.server 5173
```

Open `http://127.0.0.1:5173`.

## API target

The frontend reads backend base URL from `config.js`:

```js
window.__ARENA_API_BASE__ = "http://127.0.0.1:8765";
```

## API contract expected by frontend

### Text tasks (`Math`, `Q&A`, `Coding`)

`POST /api/generate-text-battle`

Request body:

```json
{
  "task": "math",
  "problem": "your question here",
  "modelA": "gpt-4o",
  "modelB": "claude-3-5-sonnet-20241022"
}
```

Response body (minimum required fields):

```json
{
  "answerA": "....",
  "answerB": "...."
}
```

Optional fields supported:
- `modelA`, `modelB` (to override display labels)

### Text-to-image task

`POST /api/generate-battle`

Request body:

```json
{
  "prompt": "...",
  "modelA": "gemini-2.5-flash-image-preview",
  "modelB": "dall-e-3"
}
```

Response body:

```json
{
  "modelA": "gemini-2.5-flash-image-preview",
  "modelB": "dall-e-3",
  "imageA": "data:image/... or url",
  "imageB": "data:image/... or url"
}
```

Supported image models:
- `gemini-2.5-flash-image-preview`
- `dall-e-3`
- `dall-e-2`
- `midjourney`
