// Configuração do Supabase e API para a SPA em React
window.APP_CONFIG = window.APP_CONFIG || {};

window.APP_CONFIG.supabaseUrl =
  window.APP_CONFIG.supabaseUrl || 'https://gklpjwjzluqsnavwhwxf.supabase.co';

window.APP_CONFIG.supabaseAnonKey =
  window.APP_CONFIG.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrbHBqd2p6bHVxc25hdndod3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjAxMDAsImV4cCI6MjA3OTEzNjEwMH0.hmGYAafjH7LADrMljXEr_pmZKQsW_Jt2019PhzW_t9M';

window.APP_CONFIG.authSchema =
  window.APP_CONFIG.authSchema || 'public';

// URL do backend Node/Express
window.APP_CONFIG.apiBaseUrl =
  window.APP_CONFIG.apiBaseUrl || 'http://192.168.11.190:3001';
