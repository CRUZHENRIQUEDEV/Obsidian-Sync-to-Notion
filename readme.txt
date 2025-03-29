# Obsidian Sync to Notion

Um plugin para o Obsidian que permite sincronizar suas notas Markdown diretamente com o Notion, preservando a estrutura de pastas e hierarquia.

## 🎯 Objetivo

Este plugin sincroniza automaticamente suas notas do Obsidian com o Notion, mantendo:

- ✅ O conteúdo das notas Markdown
- ✅ A estrutura de pastas do Vault representada como páginas aninhadas no Notion
- ✅ A possibilidade de atualização incremental
- ✅ Uma interface de configuração simples dentro do Obsidian

## 🚀 Como Instalar

### Instalação Manual
1. Baixe a última versão do plugin na página de Releases
2. Extraia o arquivo zip no diretório `[seu-vault]/.obsidian/plugins/`
3. Reinicie o Obsidian
4. Ative o plugin em Configurações > Plugins da Comunidade

### Instalação via BRAT (futuramente)
1. Instale o plugin [Obsidian BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Adicione este repositório usando o BRAT
3. Ative o plugin em Configurações > Plugins da Comunidade

## ⚙️ Configuração

1. Crie uma integração do Notion em [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copie o token da integração
3. No Notion, compartilhe uma página com sua integração (botão "..." > "Adicionar conexões" > selecione sua integração)
4. Copie o ID da página da URL do Notion (o ID vem após o nome do seu workspace na URL)
5. No Obsidian, vá para Configurações > Sync to Notion e adicione:
   - Token da API do Notion
   - ID da Página Raiz

## 📝 Como Usar

1. Configure o plugin conforme as instruções acima
2. Use o comando "Sincronizar com Notion" via paleta de comandos (Ctrl/Cmd + P)
3. Suas notas serão sincronizadas com o Notion, mantendo a estrutura de pastas

## 🛣️ Roadmap

- [ ] Suporte a bancos de dados do Notion
- [ ] Sincronização reversa (Notion → Obsidian)
- [ ] Suporte a mídia (imagens, links, arquivos)
- [ ] Sincronização automática contínua (background)
- [ ] Interface para visualizar status da sincronização
- [ ] Logs de erro detalhados e feedback visual

## 🧑‍💻 Desenvolvimento

### Pré-requisitos
- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) ou [npm](https://www.npmjs.com/)

### Configuração do Ambiente de Desenvolvimento
1. Clone o repositório
2. Execute `npm install` ou `yarn` para instalar as dependências
3. Execute `npm run dev` para iniciar o modo de desenvolvimento

### Build
- Execute `npm run build` para criar uma versão de produção

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.