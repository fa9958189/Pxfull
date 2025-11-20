// Copie este arquivo para env.js e preencha com as credenciais do Supabase.
// Exemplo:
// window.APP_CONFIG = {
//   supabaseUrl: 'https://abcxyz.supabase.co',
//   supabaseAnonKey: 'seu_anon_key',
//   authSchema: 'public'
// };

window.APP_CONFIG = window.APP_CONFIG || {};

// Preencha com os valores reais do seu projeto Supabase.
window.APP_CONFIG.supabaseUrl = window.APP_CONFIG.supabaseUrl || '';
window.APP_CONFIG.supabaseAnonKey = window.APP_CONFIG.supabaseAnonKey || '';
// Opcional: defina um schema de autenticação diferente do padrão.
window.APP_CONFIG.authSchema = window.APP_CONFIG.authSchema || 'public';
