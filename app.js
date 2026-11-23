
const cfg = window.FOCUS_CONFIG || {};
const ready = !!(
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  cfg.GOOGLE_MAPS_API_KEY
);

function setPreview(inputId, imgId) {
  const input = document.getElementById(inputId);
  const img = document.getElementById(imgId);
  if (!input || !img) return;

  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) return;

    if (!f.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.');
      input.value = '';
      return;
    }

    img.src = URL.createObjectURL(f);
    img.classList.remove('hidden');
  });
}

function showBackendState() {
  const el = document.getElementById('backendState');
  if (el) {
    el.innerHTML = ready
      ? '<span class="status">Configuração preenchida — integração ainda depende do backend</span>'
      : '<span class="status" style="background:#382b13;color:#f3d58b">Modo protótipo — Supabase e Maps ainda não conectados</span>';
  }
}

function submitDemo(e) {
  e.preventDefault();
  alert('Este é um protótipo visual. Nenhum documento, selfie ou dado foi enviado ou armazenado. A validação real será habilitada após configurar Supabase seguro, armazenamento privado, RLS e um fornecedor de verificação de identidade.');
}

document.addEventListener('DOMContentLoaded', () => {
  setPreview('avatar', 'avatarPreview');
  setPreview('documentPhoto', 'documentPreview');
  setPreview('selfiePhoto', 'selfiePreview');
  showBackendState();

  const f = document.getElementById('signupForm');
  if (f) f.addEventListener('submit', submitDemo);
});
