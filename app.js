
(() => {
  const cfg = window.FOCUS_CONFIG || {};
  let client = null;
  let driverGpsWatch = null;
  let driverRealtimeChannel = null;

  const $ = (id) => document.getElementById(id);

  const setMessage = (id, message, isError = false) => {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('warning', isError);
  };

  const accountType = location.pathname.toLowerCase().includes('motorista')
    ? 'driver'
    : 'passenger';

  function switchMode(mode) {
    $('signupForm')?.classList.toggle('hidden', mode !== 'signup');
    $('loginForm')?.classList.toggle('hidden', mode !== 'login');
    $('accountPanel')?.classList.add('hidden');
  }

  async function showAccount(user) {
    $('signupForm')?.classList.add('hidden');
    $('loginForm')?.classList.add('hidden');
    $('accountPanel')?.classList.remove('hidden');

    if ($('accountInfo')) {
      $('accountInfo').textContent =
        `Você está conectado como ${user.email || 'usuário Focus'}.`;
    }

    const { data: profile, error } = await client
      .from('profiles')
      .select('account_type,full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    const actualType = profile?.account_type || 'passenger';
    const migrationArea = $('migrationArea');

    if (migrationArea) {
      migrationArea.classList.toggle(
        'hidden',
        !(accountType === 'passenger' && actualType === 'passenger')
      );
    }

    if ($('accountTypeInfo')) {
      $('accountTypeInfo').textContent =
        actualType === 'driver'
          ? 'Tipo de conta: motorista.'
          : 'Tipo de conta: passageiro.';
    }

    if (actualType === 'passenger' && accountType === 'driver') {
      setMessage(
        'loginMessage',
        'Esta conta está cadastrada como passageiro. Para solicitar a mudança para motorista, entre pela página de passageiro.',
        true
      );
    }

    if (actualType === 'driver' && accountType === 'passenger') {
      if ($('migrationArea')) {
        $('migrationArea').classList.add('hidden');
      }

      if ($('accountTypeInfo')) {
        $('accountTypeInfo').textContent =
          'Sua conta já foi aprovada como motorista. Acesse a área do motorista.';
      }
    }

    if (migrationArea) {
      await loadMigrationStatus(user.id);
    }
    if (actualType === 'driver' && accountType === 'driver') {
      await loadDriverVerification(user.id);
      await loadDriverHub(user.id);
    }
  }

  async function loadMigrationStatus(userId) {
    const form = $('migrationForm');
    if (!form) return;

    const { data, error } = await client
      .from('driver_migration_requests')
      .select('status,requested_at,admin_note')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(
        'migrationMessage',
        'Não foi possível consultar sua solicitação: ' + error.message,
        true
      );
      return;
    }

    if (data?.status === 'pending') {
      form.classList.add('hidden');
      setMessage(
        'migrationMessage',
        'Sua solicitação está pendente de análise administrativa. Você continua como passageiro até a aprovação.'
      );
    } else if (data?.status === 'approved') {
      form.classList.add('hidden');
      setMessage(
        'migrationMessage',
        'Sua migração foi aprovada. Sua conta agora é de motorista; entre pela área do motorista.'
      );
    } else if (data?.status === 'rejected') {
      form.classList.remove('hidden');
      setMessage(
        'migrationMessage',
        'Sua solicitação anterior foi rejeitada. Você pode enviar uma nova solicitação.' +
        (data.admin_note ? ' Observação: ' + data.admin_note : ''),
        true
      );
    } else {
      form.classList.remove('hidden');
      setMessage(
        'migrationMessage',
        'Preencha os dados do veículo para solicitar a mudança. A conta só será alterada após aprovação administrativa.'
      );
    }
  }

  const verificationBucket = 'driver-verifications';
  const verificationFields = [
    ['cnh','docCnh'],
    ['crlv','docCrlv'],
    ['criminal_certificate','docCriminal'],
    ['address_proof','docAddress'],
    ['selfie','docSelfie']
  ];

  async function loadDriverVerification(userId) {
    const panel = $('driverVerificationPanel');
    if (!panel || accountType !== 'driver') return;

    panel.classList.remove('hidden');

    const { data, error } = await client
      .from('driver_document_submissions')
      .select('status,review_note,submitted_at,decided_at')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(
        'verificationMessage',
        'Não foi possível consultar os documentos: ' + error.message,
        true
      );
      return;
    }

    const statusBox = $('driverVerificationStatus');

    if (data) {
      statusBox.classList.remove('hidden');

      const labels = {
        pending: 'Documentos enviados. Aguardando análise da Focus.',
        approved: 'Documentos aprovados. Sua etapa documental foi concluída.',
        rejected: 'Documentos reprovados. Confira o motivo e envie novamente.'
      };

      statusBox.textContent =
        (labels[data.status] || 'Status: ' + data.status) +
        (data.review_note ? ' Motivo/observação: ' + data.review_note : '');

      $('driverVerificationForm').classList.toggle(
        'hidden',
        data.status === 'pending' || data.status === 'approved'
      );
    } else {
      statusBox.classList.add('hidden');
      $('driverVerificationForm').classList.remove('hidden');
    }
  }

  async function submitDriverVerification(event) {
    event.preventDefault();

    const user = (await client.auth.getUser()).data.user;

    if (!user) {
      setMessage(
        'verificationMessage',
        'Entre na sua conta para enviar os documentos.',
        true
      );
      return;
    }

    const files = {};

    for (const [key, id] of verificationFields) {
      const file = $(id)?.files?.[0];

      if (!file) {
        setMessage(
          'verificationMessage',
          'Anexe todos os cinco itens obrigatórios.',
          true
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setMessage(
          'verificationMessage',
          'Cada arquivo deve ter no máximo 10 MB.',
          true
        );
        return;
      }

      const allowed =
        file.type === 'application/pdf' || file.type.startsWith('image/');

      if (!allowed || (key === 'selfie' && !file.type.startsWith('image/'))) {
        setMessage(
          'verificationMessage',
          'Formato inválido. Use PDF ou imagem nos documentos e imagem na selfie.',
          true
        );
        return;
      }

      files[key] = file;
    }

    const btn = $('driverVerificationForm').querySelector(
      'button[type="submit"]'
    );

    btn.disabled = true;
    btn.textContent = 'Enviando arquivos...';

    try {
      const paths = {};

      for (const [key, file] of Object.entries(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/${Date.now()}_${key}_${safeName}`;

        const { error } = await client.storage
          .from(verificationBucket)
          .upload(path, file, {
            upsert: false,
            contentType: file.type
          });

        if (error) throw error;
        paths[key] = path;
      }

      const { error } = await client
        .from('driver_document_submissions')
        .insert({
          user_id: user.id,
          cnh_path: paths.cnh,
          crlv_path: paths.crlv,
          criminal_certificate_path: paths.criminal_certificate,
          address_proof_path: paths.address_proof,
          selfie_path: paths.selfie,
          status: 'pending'
        });

      if (error) throw error;

      $('driverVerificationForm').reset();

      setMessage(
        'verificationMessage',
        'Documentos enviados com sucesso. Aguarde a análise administrativa.'
      );

      await loadDriverVerification(user.id);
      await loadDriverHub(user.id);
    } catch (error) {
      console.error(error);
      setMessage(
        'verificationMessage',
        'Falha ao enviar: ' + (error.message || error),
        true
      );
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar documentos para análise';
    }
  }

  async function loadDriverHub(userId) {
    if (accountType !== 'driver' || !$('driverOperationsPanel')) return;

    const [
      { data: dp, error: dpError },
      { data: profile, error: profileError }
    ] = await Promise.all([
      client
        .from('driver_profiles')
        .select(
          'vehicle_model,vehicle_plate,vehicle_year,driver_status,is_online,admin_online_enabled,profile_completed_at'
        )
        .eq('user_id', userId)
        .maybeSingle(),

      client
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle()
    ]);

    if (dpError) throw dpError;
    if (profileError) throw profileError;

    $('driverCompletionPanel').classList.toggle(
      'hidden',
      dp?.driver_status !== 'approved'
    );

    $('driverAdditionalPanel').classList.remove('hidden');
    $('driverOperationsPanel').classList.remove('hidden');

    if (dp) {
      $('completeVehicleModel').value = dp.vehicle_model || '';
      $('completeVehiclePlate').value = dp.vehicle_plate || '';
      $('completeVehicleYear').value = dp.vehicle_year || '';

      $('driverCompletionPanel').classList.toggle(
        'hidden',
        dp.driver_status !== 'approved' || !!dp.profile_completed_at
      );

      const allowed =
        dp.driver_status === 'approved' &&
        !!dp.profile_completed_at &&
        dp.admin_online_enabled;

      $('driverGoOnline').disabled = !allowed || !!dp.is_online;
      $('driverGoOffline').disabled = !dp.is_online;

      $('driverOperationalStatus').textContent =
        dp.driver_status !== 'approved'
          ? 'Documentação ainda não aprovada.'
          : !dp.profile_completed_at
            ? 'Conclua seu cadastro para continuar.'
            : !dp.admin_online_enabled
              ? 'Cadastro concluído. Aguardando liberação operacional da Focus.'
              : dp.is_online
                ? 'Você está ONLINE.'
                : 'Você está liberado para ficar online.';
    }

    await Promise.all([
      loadAdditionalDocuments(userId),
      loadDriverMessages(userId)
    ]);

    if (driverRealtimeChannel) {
      client.removeChannel(driverRealtimeChannel);
    }

    driverRealtimeChannel = client
      .channel('driver-hub-' + userId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_admin_messages',
          filter: 'driver_id=eq.' + userId
        },
        () => loadDriverMessages(userId).catch(console.error)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_additional_document_requests',
          filter: 'user_id=eq.' + userId
        },
        () => loadAdditionalDocuments(userId).catch(console.error)
      )
      .subscribe();
  }

  async function loadAdditionalDocuments(userId) {
    const { data, error } = await client
      .from('driver_additional_document_requests')
      .select(
        'id,document_name,instructions,status,review_note,requested_at'
      )
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    const host = $('additionalDocsList');

    if (!data?.length) {
      host.textContent = 'Nenhum documento adicional solicitado.';
      return;
    }

    host.innerHTML = data.map(d => `
      <div class="card" style="margin:10px 0">
        <strong>${escapeHtml(d.document_name)}</strong>
        <p>${escapeHtml(d.instructions || '')}</p>
        <p class="small muted">
          Status: ${escapeHtml(d.status)}
          ${d.review_note ? '— ' + escapeHtml(d.review_note) : ''}
        </p>
        ${
          ['requested', 'rejected'].includes(d.status)
            ? `
              <form data-additional-form="${d.id}">
                <input type="file" required accept="image/*,.pdf">
                <button class="btn" type="submit">Enviar documento</button>
              </form>
            `
            : ''
        }
      </div>
    `).join('');
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  async function loadDriverMessages(userId) {
    const { data, error } = await client
      .from('driver_admin_messages')
      .select('id,message,sender_role,created_at,read_at')
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const host = $('driverMessages');

    host.innerHTML = (data || []).length
      ? (data || []).map(m => `
          <div class="notice">
            <strong>${m.sender_role === 'admin' ? 'Focus' : 'Você'}</strong>
            · ${new Date(m.created_at).toLocaleString('pt-BR')}
            <p>${escapeHtml(m.message)}</p>
          </div>
        `).join('')
      : 'Nenhuma mensagem recebida.';

    const unread = (data || [])
      .filter(m => m.sender_role === 'admin' && !m.read_at)
      .map(m => m.id);

    if (unread.length) {
      await client
        .from('driver_admin_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread);
    }
  }

  async function completeDriverProfile(e) {
    e.preventDefault();

    const user = (await client.auth.getUser()).data.user;
    if (!user) return;

    const file = $('driverAvatar').files[0];

    if (!file) {
      setMessage(
        'completionMessage',
        'Envie uma foto de perfil.',
        true
      );
      return;
    }

    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setMessage(
        'completionMessage',
        'Use uma imagem de até 5 MB.',
        true
      );
      return;
    }

    const path =
      `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const up = await client.storage
      .from('driver-profile')
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (up.error) {
      setMessage('completionMessage', up.error.message, true);
      return;
    }

    const { error } = await client.rpc(
      'focus_complete_driver_profile',
      {
        p_avatar_path: path,
        p_vehicle_model: $('completeVehicleModel').value.trim(),
        p_vehicle_plate: $('completeVehiclePlate').value.trim().toUpperCase(),
        p_vehicle_year: Number($('completeVehicleYear').value)
      }
    );

    if (error) {
      setMessage('completionMessage', error.message, true);
      return;
    }

    setMessage(
      'completionMessage',
      'Cadastro finalizado. Aguarde a liberação operacional da Focus.'
    );

    await loadDriverHub(user.id);
  }

  async function submitAdditionalDocument(e) {
    const form = e.target.closest('[data-additional-form]');
    if (!form) return;

    e.preventDefault();

    const user = (await client.auth.getUser()).data.user;
    const file = form.querySelector('input[type=file]').files[0];

    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('O arquivo deve ter até 10 MB.');
      return;
    }

    const path =
      `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const up = await client.storage
      .from('driver-additional-docs')
      .upload(path, file, {
        upsert: false,
        contentType: file.type
      });

    if (up.error) {
      alert(up.error.message);
      return;
    }

    const { error } = await client.rpc(
      'focus_driver_submit_additional_document',
      {
        p_request_id: form.dataset.additionalForm,
        p_file_path: path
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    await loadAdditionalDocuments(user.id);
  }

  async function setDriverOnline(online) {
    const user = (await client.auth.getUser()).data.user;
    if (!user) return;

    if (!online) {
      if (driverGpsWatch !== null) {
        navigator.geolocation.clearWatch(driverGpsWatch);
        driverGpsWatch = null;
      }

      const { error } = await client.rpc(
        'focus_driver_set_online',
        { p_online: false }
      );

      if (error) alert(error.message);

      await loadDriverHub(user.id);

      $('driverGpsStatus').textContent =
        'Compartilhamento de localização encerrado.';

      return;
    }

    if (!navigator.geolocation) {
      alert('Este navegador não oferece GPS.');
      return;
    }

    $('driverGpsStatus').textContent =
      'Aguardando autorização e primeira posição do GPS…';

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { error: onlineError } = await client.rpc(
          'focus_driver_set_online',
          { p_online: true }
        );

        if (onlineError) {
          $('driverGpsStatus').textContent = onlineError.message;
          return;
        }

        const send = async p => {
          const { error } = await client.rpc(
            'focus_driver_update_live_location',
            {
              p_latitude: p.coords.latitude,
              p_longitude: p.coords.longitude,
              p_accuracy: p.coords.accuracy,
              p_heading: p.coords.heading,
              p_speed: p.coords.speed
            }
          );

          if (error) {
            $('driverGpsStatus').textContent =
              'Falha ao atualizar GPS: ' + error.message;
          } else {
            $('driverGpsStatus').textContent =
              'GPS ativo · última atualização ' +
              new Date().toLocaleTimeString('pt-BR');
          }
        };

        await send(pos);

        driverGpsWatch = navigator.geolocation.watchPosition(
          send,
          async err => {
            $('driverGpsStatus').textContent =
              'GPS indisponível: ' + err.message;
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 20000
          }
        );

        await loadDriverHub(user.id);
      },
      err => {
        $('driverGpsStatus').textContent =
          'Não foi possível obter GPS: ' + err.message;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;

    if (data.session?.user) {
      await showAccount(data.session.user);
    }
  }

  async function signup(event) {
    event.preventDefault();

    const fullName = $('fullName')?.value.trim();
    const email = $('email')?.value.trim();
    const phone = $('phone')?.value.trim();
    const password = $('password')?.value;

    if (!fullName || !email || !phone || !password) return;

    if (password.length < 8) {
      setMessage(
        'signupMessage',
        'A senha precisa ter pelo menos 8 caracteres.',
        true
      );
      return;
    }

    const metadata = {
      full_name: fullName,
      phone,
      account_type: accountType
    };

    if (accountType === 'driver') {
      metadata.vehicle_model = $('vehicleModel')?.value.trim();
      metadata.vehicle_plate =
        $('vehiclePlate')?.value.trim().toUpperCase();
      metadata.vehicle_year = $('vehicleYear')?.value;
    }

    const button = $('signupForm')
      ?.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = 'Criando conta...';
    }

    setMessage('signupMessage', 'Enviando cadastro ao Supabase...');

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });

      if (error) throw error;

      if (data.session && data.user) {
        await showAccount(data.user);
        setMessage('signupMessage', 'Conta criada e conectada.');
      } else {
        setMessage(
          'signupMessage',
          'Cadastro recebido. Se o e-mail já estiver cadastrado, entre na conta existente. Para virar motorista, solicite a migração pela área do passageiro.'
        );

        $('signupForm')?.reset();
      }
    } catch (error) {
      console.error('Erro no cadastro Focus:', error);

      setMessage(
        'signupMessage',
        error.message || 'Não foi possível criar a conta.',
        true
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Criar minha conta';
      }
    }
  }

  async function login(event) {
    event.preventDefault();

    const email = $('loginEmail')?.value.trim();
    const password = $('loginPassword')?.value;

    const button = $('loginForm')
      ?.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = 'Entrando...';
    }

    setMessage('loginMessage', 'Conectando...');

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('account_type')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const actualType = profile?.account_type || 'passenger';

      if (actualType !== accountType) {
        await client.auth.signOut();

        if (actualType === 'passenger' && accountType === 'driver') {
          throw new Error(
            'Esta conta é de passageiro. Para se tornar motorista, entre pela área do passageiro e solicite a migração no seu perfil.'
          );
        }

        throw new Error(
          'Esta conta já está cadastrada como motorista. Entre pela página do motorista.'
        );
      }

      await showAccount(data.user);
    } catch (error) {
      console.error('Erro no login Focus:', error);

      setMessage(
        'loginMessage',
        error.message || 'Não foi possível entrar.',
        true
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Entrar';
      }
    }
  }

  async function requestMigration(event) {
    event.preventDefault();

    const vehicleModel = $('migrationVehicleModel')?.value.trim();
    const vehiclePlate =
      $('migrationVehiclePlate')?.value.trim().toUpperCase();
    const vehicleYear = Number($('migrationVehicleYear')?.value);

    if (!vehicleModel || !vehiclePlate || !vehicleYear) {
      setMessage(
        'migrationMessage',
        'Preencha todos os dados do veículo.',
        true
      );
      return;
    }

    const button = $('migrationForm')
      ?.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando...';
    }

    try {
      const { error } = await client.rpc(
        'focus_request_driver_migration',
        {
          p_vehicle_model: vehicleModel,
          p_vehicle_plate: vehiclePlate,
          p_vehicle_year: vehicleYear
        }
      );

      if (error) throw error;

      $('migrationForm')?.reset();
      $('migrationForm')?.classList.add('hidden');

      setMessage(
        'migrationMessage',
        'Solicitação enviada! Você continua como passageiro até a análise e aprovação do administrador.'
      );
    } catch (error) {
      setMessage(
        'migrationMessage',
        error.message || 'Não foi possível enviar a solicitação.',
        true
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Solicitar migração para motorista';
      }
    }
  }

  async function logout() {
    const { error } = await client.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    $('accountPanel')?.classList.add('hidden');
    switchMode('login');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const status = $('backendState');

    if (!$('signupForm') && !$('loginForm')) return;

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      if (status) {
        status.textContent =
          'Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no config.js.';
      }

      setMessage(
        'signupMessage',
        'Supabase não configurado. Confira o arquivo config.js.',
        true
      );
      return;
    }

    if (!window.supabase?.createClient) {
      if (status) {
        status.textContent =
          'Não foi possível carregar a biblioteca do Supabase.';
      }
      return;
    }

    client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    );

    if (status) {
      status.textContent =
        'Supabase conectado. Cadastro e login disponíveis.';
    }

    $('signupForm')?.addEventListener('submit', signup);
    $('loginForm')?.addEventListener('submit', login);
    $('migrationForm')?.addEventListener('submit', requestMigration);
    $('driverVerificationForm')?.addEventListener(
      'submit',
      submitDriverVerification
    );
    $('driverCompletionForm')?.addEventListener(
      'submit',
      completeDriverProfile
    );
    $('additionalDocsList')?.addEventListener(
      'submit',
      submitAdditionalDocument
    );
    $('driverGoOnline')?.addEventListener(
      'click',
      () => setDriverOnline(true)
    );
    $('driverGoOffline')?.addEventListener(
      'click',
      () => setDriverOnline(false)
    );
    $('logoutButton')?.addEventListener('click', logout);

    $('showLogin')?.addEventListener('click', e => {
      e.preventDefault();
      switchMode('login');
    });

    $('showSignup')?.addEventListener('click', e => {
      e.preventDefault();
      switchMode('signup');
    });

    try {
      await refreshSession();
    } catch (error) {
      console.error(error);
    }
  });
})();
