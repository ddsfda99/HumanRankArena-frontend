const DEFAULT_API_BASE = 'http://127.0.0.1:8765';
const TEXT_BATTLE_ENDPOINT = '/api/generate-text-battle';

const TEXT_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-3-5-sonnet-20241022',
  'gemini-2.0-flash-exp',
  'llama-3.2-3b-preview',
];

const IMAGE_MODELS = [
  'gemini-2.5-flash-image-preview',
  'dall-e-3',
  'dall-e-2',
  'midjourney',
];

const configuredApiBase =
  typeof window.__ARENA_API_BASE__ === 'string' ? window.__ARENA_API_BASE__.trim() : '';
const apiBase = (configuredApiBase || DEFAULT_API_BASE).replace(/\/+$/, '');

const taskButtons = Array.from(document.querySelectorAll('.task-item'));
const taskPanels = Array.from(document.querySelectorAll('.task-panel'));

const imagePanel = getPanel('image');
const imagePromptInput = imagePanel?.querySelector('#imagePrompt') || null;
const imageGenerateBtn = imagePanel?.querySelector('#imageGenerateBtn') || null;
const imageA = imagePanel?.querySelector('.candidate[data-id="A"] img') || null;
const imageB = imagePanel?.querySelector('.candidate[data-id="B"] img') || null;

let activeTask =
  taskButtons.find((button) => button.classList.contains('is-active'))?.dataset.task ||
  taskButtons[0]?.dataset.task ||
  'math';

let imageIsGenerating = false;
const textGeneratingMap = new WeakMap();

function getPanel(taskId) {
  return taskPanels.find((panel) => panel.dataset.task === taskId) || null;
}

function getCurrentPanel() {
  return getPanel(activeTask);
}

function pickRandomPair(pool) {
  if (!Array.isArray(pool) || pool.length < 2) {
    throw new Error('Model pool must contain at least two items.');
  }

  const indexA = Math.floor(Math.random() * pool.length);
  let indexB = Math.floor(Math.random() * (pool.length - 1));
  if (indexB >= indexA) {
    indexB += 1;
  }

  return [pool[indexA], pool[indexB]];
}

function setResult(panel, message, type = 'info') {
  const result = panel.querySelector('.result');
  if (!result) return;

  result.classList.remove('is-loading', 'is-error');
  if (type === 'loading') result.classList.add('is-loading');
  if (type === 'error') result.classList.add('is-error');

  const line = document.createElement('p');
  line.textContent = message;
  result.replaceChildren(line);
}

function clearSelection(panel) {
  panel.querySelectorAll('.candidate').forEach((card) => {
    card.classList.remove('is-selected');
  });
}

function setWinner(panel, winner) {
  panel.querySelectorAll('.candidate').forEach((card) => {
    card.classList.toggle('is-selected', card.dataset.id === winner);
  });

  setResult(panel, `Current pick: ${winner} is better.`);
}

function bindVotes(panel) {
  const cards = Array.from(panel.querySelectorAll('.candidate'));
  const voteButtons = Array.from(panel.querySelectorAll('.vote-btn'));

  cards.forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.vote-btn')) {
        return;
      }
      setWinner(panel, card.dataset.id);
    });
  });

  voteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setWinner(panel, button.dataset.vote);
    });
  });
}

function switchTask(taskId) {
  activeTask = taskId;

  taskButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.task === taskId);
  });

  taskPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.task === taskId);
  });
}

function getTextControls(panel) {
  const problemInput = panel.querySelector('.text-problem-input');
  const generateBtn = panel.querySelector('.text-generate-btn');
  const answerABox = panel.querySelector('.text-response[data-answer="A"]');
  const answerBBox = panel.querySelector('.text-response[data-answer="B"]');

  if (!problemInput || !generateBtn || !answerABox || !answerBBox) {
    return null;
  }

  return {
    problemInput,
    generateBtn,
    answerABox,
    answerBBox,
  };
}

function setTextGeneratingState(panel, isGenerating) {
  const controls = getTextControls(panel);
  if (!controls) return;

  controls.generateBtn.disabled = isGenerating;
  controls.generateBtn.textContent = isGenerating ? 'Generating...' : 'Generate Answers';
}

function setImageGeneratingState(isGenerating) {
  if (!imageGenerateBtn) return;

  imageGenerateBtn.disabled = isGenerating;
  imageGenerateBtn.textContent = isGenerating ? 'Generating...' : 'Generate New Pair';
}

function normalizeUrl(raw) {
  if (typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;

  try {
    return new URL(value, `${apiBase}/`).toString();
  } catch {
    return value;
  }
}

function readFirstString(payload, keys) {
  if (!payload || typeof payload !== 'object') return '';

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function renderAnswer(box, text) {
  const pre = document.createElement('pre');
  pre.className = 'answer-text';
  pre.textContent = text;
  box.replaceChildren(pre);
}

function setModelBadge(panel, side, modelName) {
  const node = panel.querySelector(`.model-name[data-model-name="${side}"]`);
  if (node) {
    node.textContent = modelName;
  }
}

function setImageModelBadge(side, modelName) {
  if (!imagePanel) return;
  const node = imagePanel.querySelector(`.model-name[data-image-model-name="${side}"]`);
  if (node) {
    node.textContent = modelName;
  }
}

async function generateTextBattle(panel) {
  const controls = getTextControls(panel);
  if (!controls) {
    return;
  }

  if (textGeneratingMap.get(panel)) {
    return;
  }

  const task = panel.dataset.task;
  const problem = controls.problemInput.value.trim();

  if (!problem) {
    setResult(panel, 'Problem cannot be empty.', 'error');
    return;
  }

  const [modelA, modelB] = pickRandomPair(TEXT_MODELS);

  clearSelection(panel);
  setModelBadge(panel, 'A', modelA);
  setModelBadge(panel, 'B', modelB);
  setTextGeneratingState(panel, true);
  textGeneratingMap.set(panel, true);
  setResult(panel, `Generating answers with ${modelA} vs ${modelB}...`, 'loading');

  try {
    const response = await fetch(`${apiBase}${TEXT_BATTLE_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task, problem, modelA, modelB }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    const answerA = readFirstString(payload, ['answerA', 'responseA', 'outputA', 'textA', 'candidateA']);
    const answerB = readFirstString(payload, ['answerB', 'responseB', 'outputB', 'textB', 'candidateB']);

    if (!answerA || !answerB) {
      throw new Error('The API response did not contain both answers.');
    }

    const modelNameA = readFirstString(payload, ['modelA', 'model_a', 'modelNameA']) || modelA;
    const modelNameB = readFirstString(payload, ['modelB', 'model_b', 'modelNameB']) || modelB;

    setModelBadge(panel, 'A', modelNameA);
    setModelBadge(panel, 'B', modelNameB);
    renderAnswer(controls.answerABox, answerA);
    renderAnswer(controls.answerBBox, answerB);

    setResult(panel, `New answers are ready (${modelNameA} vs ${modelNameB}). Choose the better one.`);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    setResult(panel, `Generation failed: ${message}`, 'error');
  } finally {
    setTextGeneratingState(panel, false);
    textGeneratingMap.set(panel, false);
  }
}

async function generateImageBattle() {
  if (!imagePanel || !imagePromptInput || !imageA || !imageB) {
    return;
  }

  if (imageIsGenerating) {
    return;
  }

  const prompt = imagePromptInput.value.trim();
  if (!prompt) {
    setResult(imagePanel, 'Prompt cannot be empty.', 'error');
    return;
  }

  const [modelA, modelB] = pickRandomPair(IMAGE_MODELS);

  clearSelection(imagePanel);
  setImageModelBadge('A', modelA);
  setImageModelBadge('B', modelB);
  setImageGeneratingState(true);
  imageIsGenerating = true;
  setResult(imagePanel, `Generating images with ${modelA} vs ${modelB}...`, 'loading');

  try {
    const response = await fetch(`${apiBase}/api/generate-battle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, modelA, modelB }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    const imageUrlA = normalizeUrl(payload.imageA);
    const imageUrlB = normalizeUrl(payload.imageB);

    if (!imageUrlA || !imageUrlB) {
      throw new Error('The API response did not contain both images.');
    }

    const modelNameA = readFirstString(payload, ['modelA', 'model_a', 'modelNameA']) || modelA;
    const modelNameB = readFirstString(payload, ['modelB', 'model_b', 'modelNameB']) || modelB;

    imageA.src = imageUrlA;
    imageB.src = imageUrlB;
    imageA.alt = 'Generated candidate image A';
    imageB.alt = 'Generated candidate image B';
    setImageModelBadge('A', modelNameA);
    setImageModelBadge('B', modelNameB);

    setResult(imagePanel, `New candidates are ready (${modelNameA} vs ${modelNameB}). Choose the better one.`);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    setResult(imagePanel, `Generation failed: ${message}`, 'error');
  } finally {
    setImageGeneratingState(false);
    imageIsGenerating = false;
  }
}

function bindTextTask(panel) {
  const controls = getTextControls(panel);
  if (!controls) {
    return;
  }

  controls.generateBtn.addEventListener('click', () => {
    generateTextBattle(panel);
  });

  controls.problemInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      generateTextBattle(panel);
    }
  });
}

taskPanels.forEach((panel) => {
  bindVotes(panel);

  if (panel.dataset.taskType === 'text') {
    bindTextTask(panel);
  }
});

taskButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchTask(button.dataset.task);
  });
});

if (imageGenerateBtn) {
  imageGenerateBtn.addEventListener('click', generateImageBattle);
}

if (imagePromptInput) {
  imagePromptInput.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      generateImageBattle();
    }
  });
}

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const tagName = target instanceof HTMLElement ? target.tagName.toLowerCase() : '';
  if (tagName === 'textarea' || tagName === 'input' || (target instanceof HTMLElement && target.isContentEditable)) {
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const panel = getCurrentPanel();
  if (!panel) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === 'a') setWinner(panel, 'A');
  if (key === 'b') setWinner(panel, 'B');
});

switchTask(activeTask);
