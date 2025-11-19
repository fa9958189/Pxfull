# Gestão Pessoal – React + Supabase

Este projeto foi migrado para uma SPA em React rodando direto no browser por meio do Babel Standalone. Não é necessário nenhum bundler ou servidor de desenvolvimento — basta abrir `index.html`.

## Como configurar o Supabase
1. Crie um projeto no [Supabase](https://supabase.com/).
2. Crie as tabelas `profiles`, `transactions` e `events` (todas com a coluna `user_id` do tipo `uuid`).
3. Opcional: crie a função RPC `create_dashboard_user` (ou um Edge Function) para provisionar novos usuários quando o administrador usar o formulário “Gerenciar Usuários”.
4. Copie `env.example.js` para `env.js` e preencha `supabaseUrl`, `supabaseAnonKey` e, se desejar, `authSchema`.
5. Publique o projeto em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages) ou abra o `index.html` localmente.

## Fluxo offline
Enquanto você não configurar o Supabase, o dashboard mantém todas as transações e eventos no `localStorage`. Assim que o Supabase estiver pronto e você fizer login, os dados passam a ser sincronizados.

## Estrutura
- `index.html`: ponto de entrada com os imports do React, Babel, Chart.js e Supabase.
- `src/app.jsx`: código React com os formulários, filtros, gráficos e chamadas ao Supabase.
- `styles.css`: reaproveita o layout original (tema escuro) com pequenos ajustes para componentes do React.
