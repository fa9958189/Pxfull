# Gestão Pessoal – React + Supabase

Este projeto foi migrado para uma SPA em React rodando direto no browser por meio do Babel Standalone. Não é necessário nenhum bundler ou servidor de desenvolvimento — basta abrir `index.html`.

## Como configurar o Supabase
1. Crie um projeto no [Supabase](https://supabase.com/).
2. Crie as tabelas `profiles`, `transactions` e `events` (todas com a coluna `user_id` do tipo `uuid`).
3. Opcional: crie a função RPC `create_dashboard_user` (ou um Edge Function) para provisionar novos usuários quando o administrador usar o formulário “Gerenciar Usuários”.
4. Copie `env.example.js` para `env.js` e preencha `supabaseUrl`, `supabaseAnonKey` e, se desejar, `authSchema`.
5. Publique o projeto em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages) ou abra o `index.html` localmente.

### Senha e conexão direta com o Postgres
O Supabase fornece uma senha do banco (`Pxfull0pro80`) e os dados de host exibidos no painel (por exemplo `db.gkpkyjuxqunsawnwhwf.supabase.co`).

Para não precisar montar a string manualmente:

1. Copie `.env.example` para `.env.local` e ajuste os valores, caso tenha alterado a senha padrão no painel do Supabase.
2. Execute `npm run db:print`.
3. O script vai exibir a string `postgresql://...` completa e também o comando `psql` equivalente, pronto para colar em qualquer cliente PostgreSQL compatível com SSL.

> Dica: após validar a conexão, mantenha `.env.local` fora do Git (ele já está listado no `.gitignore`). Assim você preserva a senha do banco com segurança.

## Fluxo offline
Enquanto você não configurar o Supabase, o dashboard mantém todas as transações e eventos no `localStorage`. Assim que o Supabase estiver pronto e você fizer login, os dados passam a ser sincronizados.

## Estrutura
- `index.html`: ponto de entrada com os imports do React, Babel, Chart.js e Supabase.
- `src/app.jsx`: código React com os formulários, filtros, gráficos e chamadas ao Supabase.
- `styles.css`: reaproveita o layout original (tema escuro) com pequenos ajustes para componentes do React.
- `.env.example`: template com host, usuário e senha do Postgres do Supabase para ser copiado em `.env.local`.
- `scripts/print-db-connection.js`: utilitário Node que monta a string de conexão usando as variáveis acima.
