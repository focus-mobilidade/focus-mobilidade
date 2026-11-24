
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

  function showAccount(user) {
    $('signupForm')?.classList.add('hidden');
    $('loginForm')?.classList.add('hidden');
    $('accountPanel')?.classList.remove('hidden');

    if ($('accountInfo')) {
      $('accountInfo').textContent =
        `Você está conectado como ${user.email || 'usuário Focus'}.`;
    }
  }

  async function refreshSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session?.user) showAccount(data.session.user);
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
      metadata.vehicle_plate = $('vehiclePlate')?.value.trim().toUpperCase();
      metadata.vehicle_year = $('vehicleYear')?.value;
    }

    const button = $('signupForm')?.querySelector('button[type="submit"]');

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
        showAccount(data.user);
        setMessage('signupMessage', 'Conta criada e conectada.');
      } else {
        setMessage(
          'signupMessage',
          'Cadastro recebido! Confira seu e-mail para confirmar a conta. Depois volte aqui e entre com sua senha. O perfil será criado automaticamente pelo banco.'
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

    const button = $('loginForm')?.querySelector('button[type="submit"]');

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

      const actualType = data.user?.user_metadata?.account_type;

      if (actualType && actualType !== accountType) {
        await client.auth.signOut();

        throw new Error(
          `Esta conta está cadastrada como ${
            actualType === 'driver' ? 'motorista' : 'passageiro'
          }. Entre pela página correta.`
        );
      }

      showAccount(data.user);
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
