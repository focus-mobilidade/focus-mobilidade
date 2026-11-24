
(() => {
  const cfg = window.FOCUS_CONFIG || {};
  let client = null;

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
    $('logoutButton')?.addEventListener('click', logout);

    $('showLogin')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchMode('login');
    });

    $('showSignup')?.addEventListener('click', (e) => {
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
