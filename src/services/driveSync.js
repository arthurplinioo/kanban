// Sincroniza o quadro inteiro (colunas, tarefas, subtarefas) via um arquivo
// JSON guardado na pasta oculta "appDataFolder" do Google Drive do usuário.
// Usa o mesmo login Google já feito para o Google Agenda (services/googleCalendar.js) —
// nao precisa de token separado nem de outro provedor.
const FILE_NAME = 'taskflow-board.json';

function authHeaders() {
  const token = window.gapi?.client?.getToken()?.access_token;
  if (!token) throw new Error('Nao autenticado com o Google');
  return { Authorization: `Bearer ${token}` };
}

export const driveSync = {
  async findFile() {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q: `name='${FILE_NAME}' and trashed=false`,
      fields: 'files(id,modifiedTime)',
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Erro ao buscar arquivo no Drive (${res.status})`);
    const data = await res.json();
    return data.files?.[0] || null;
  },

  async download() {
    const file = await this.findFile();
    if (!file) return null;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Erro ao baixar dados do Drive (${res.status})`);
    const board = await res.json();
    return { board, modifiedTime: file.modifiedTime, fileId: file.id };
  },

  async upload(board) {
    const existing = await this.findFile();
    const boundary = 'taskflow-drive-boundary';
    const metadata = existing ? { name: FILE_NAME } : { name: FILE_NAME, parents: ['appDataFolder'] };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(board)}\r\n` +
      `--${boundary}--`;

    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=modifiedTime`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=modifiedTime`;

    const res = await fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { ...authHeaders(), 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) throw new Error(`Erro ao enviar dados para o Drive (${res.status})`);
    return res.json();
  },
};
