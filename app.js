const cfg=window.FOCUS_CONFIG||{};
const ready=!!(cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&cfg.GOOGLE_MAPS_API_KEY);

function setPreview(inputId,imgId){
  const input=document.getElementById(inputId),img=document.getElementById(imgId);
  if(!input||!img)return;
  input.addEventListener('change',()=>{
    const f=input.files&&input.files[0];
    if(!f)return;
    if(!f.type.startsWith('image/')){
      alert('Selecione um arquivo de imagem.');
      input.value='';
      return;
    }
    const url=URL.createObjectURL(f);
    img.src=url;
    img.classList.remove('hidden');
    const mirror=document.getElementById(inputId==='documentPhoto'?'documentCompare':'selfieCompare');
    const label=document.getElementById(inputId==='documentPhoto'?'documentCompareLabel':'selfieCompareLabel');
    if(mirror){
      mirror.src=url;
      mirror.classList.remove('hidden');
    }
    if(label)label.textContent=f.name;
    updateVerificationState();
  });
}

function showBackendState(){
  const el=document.getElementById('backendState');
  if(el)el.innerHTML=ready
    ?'<span class="status">Chaves configuradas — verificação real ainda não ativada</span>'
    :'<span class="status" style="background:#382b13;color:#f3d58b">Modo protótipo — Supabase e Maps ainda não conectados</span>';
}

function updateVerificationState(){
  const d=document.getElementById('documentPhoto');
  const s=document.getElementById('selfiePhoto');
  const l=document.getElementById('livenessDemo');
  const r=document.getElementById('verificationResult');
  if(!r)return;
  const count=[d?.files?.length,s?.files?.length,l?.value].filter(Boolean).length;
  r.textContent=count===3
    ?'Arquivos selecionados. A análise automática real ainda depende da integração com o fornecedor.'
    :`Etapas demonstrativas preenchidas: ${count}/3.`;
}

function submitDemo(e){
  e.preventDefault();
  const d=document.getElementById('documentPhoto');
  const s=document.getElementById('selfiePhoto');
  const l=document.getElementById('livenessDemo');

  if(!d?.files?.length||!s?.files?.length||!l?.value){
    alert('Para testar o fluxo, selecione o documento, a captura facial e a etapa demonstrativa de prova de vida.');
    return;
  }

  const r=document.getElementById('verificationResult');
  if(r)r.innerHTML='<strong>Status: PENDENTE DE ANÁLISE.</strong><br>Este resultado é apenas demonstrativo. Nenhum rosto foi comparado, nenhuma prova de vida foi executada e nenhum arquivo foi enviado ou armazenado. Na versão real, a decisão automática será fornecida pelo serviço especializado; falhas ou baixa confiança irão para a fila do administrador.';

  alert('Fluxo demonstrativo concluído: cadastro marcado como pendente. Nenhum dado foi enviado ou armazenado.');
}

document.addEventListener('DOMContentLoaded',()=>{
  setPreview('avatar','avatarPreview');
  setPreview('documentPhoto','documentPreview');
  setPreview('selfiePhoto','selfiePreview');
  showBackendState();

  ['documentPhoto','selfiePhoto','livenessDemo'].forEach(id=>
    document.getElementById(id)?.addEventListener('change',updateVerificationState)
  );

  const f=document.getElementById('signupForm');
  if(f)f.addEventListener('submit',submitDemo);
});