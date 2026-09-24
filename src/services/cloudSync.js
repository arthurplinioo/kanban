const API_BASE = 'https://api.github.com';
export const DEFAULT_SYNC_FILE = 'taskflow-board.json';

function authHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseResponse(response, fallbackMessage) {
  if (response.ok) return response.json();

  let detail = fallbackMessage;
  try {
    const payload = await response.json();
    detail = payload?.message || detail;
  } catch {
    detail = response.statusText || detail;
  }
  throw new Error(detail);
}

function parseBoardFile(gist, fileName) {
  const files = gist?.files || {};
  const file = files[fileName] || Object.values(files).find(item => item?.filename === fileName);
  if (!file) return null;
  return file;
}

export const cloudSync = {
  async createBoard({ token, fileName = DEFAULT_SYNC_FILE, board, deviceId }) {
    const content = JSON.stringify({
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      deviceId,
      board,
    }, null, 2);

    const response = await fetch(`${API_BASE}/gists`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        description: 'TaskFlow cloud sync',
        public: false,
        files: {
          [fileName]: { content },
        },
      }),
    });

    const gist = await parseResponse(response, 'Nao foi possivel criar o Gist de sincronizacao.');
    const file = parseBoardFile(gist, fileName);
    return {
      gistId: gist.id,
      updatedAt: gist.updated_at,
      payload: JSON.parse(file?.content || content),
    };
  },

  async readBoard({ token, gistId, fileName = DEFAULT_SYNC_FILE }) {
    const response = await fetch(`${API_BASE}/gists/${gistId}`, {
      headers: authHeaders(token),
    });
    const gist = await parseResponse(response, 'Nao foi possivel ler o Gist de sincronizacao.');
    const file = parseBoardFile(gist, fileName);
    if (!file) return null;

    let content = file.content;
    if (!content && file.raw_url) {
      const rawResponse = await fetch(file.raw_url);
      if (!rawResponse.ok) throw new Error('Nao foi possivel baixar o arquivo bruto do Gist.');
      content = await rawResponse.text();
    }

    if (!content) return null;
    return {
      gistId: gist.id,
      updatedAt: gist.updated_at,
      payload: JSON.parse(content),
    };
  },

  async updateBoard({ token, gistId, fileName = DEFAULT_SYNC_FILE, board, deviceId }) {
    const content = JSON.stringify({
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      deviceId,
      board,
    }, null, 2);

    const response = await fetch(`${API_BASE}/gists/${gistId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({
        files: {
          [fileName]: { content },
        },
      }),
    });

    const gist = await parseResponse(response, 'Nao foi possivel atualizar o Gist de sincronizacao.');
    const file = parseBoardFile(gist, fileName);
    return {
      gistId: gist.id,
      updatedAt: gist.updated_at,
      payload: JSON.parse(file?.content || content),
    };
  },
};
