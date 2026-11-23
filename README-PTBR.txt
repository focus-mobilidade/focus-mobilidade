FOCUS MOBILIDADE URBANA — PACOTE INICIAL PARA GITHUB PAGES

CONTEÚDO
- index.html: página inicial e acesso às três áreas
- passageiro.html: protótipo do cadastro de passageiro
- motorista.html: protótipo do cadastro de motorista
- admin.html: página informativa do painel administrativo (sem login ainda)
- styles.css / app.js: estilos e comportamentos demonstrativos
- config.js: configuração vazia; não contém chaves
- config.example.js: modelo de configuração
- assets/logo.png: logo usada no protótipo

PUBLICAÇÃO
1. Envie TODOS os arquivos e a pasta assets para a raiz do repositório focus-mobilidade.
2. Faça Commit changes na branch main.
3. Em Settings > Pages, escolha Deploy from a branch, branch main, pasta /(root), Save.
4. Aguarde o GitHub publicar e confirme a URL indicada na tela Pages.

IMPORTANTE — NÃO É PRODUÇÃO
Esta entrega é um protótipo visual e de navegação. Nenhum cadastro é enviado, nenhum arquivo é armazenado e nenhuma verificação biométrica, liveness, localização, corrida ou pagamento é executado. Não inserir dados reais nem enviar documentos reais.

ANTES DE ATIVAR CADASTROS REAIS
- Criar esquema SQL do Supabase e habilitar RLS em todas as tabelas.
- Criar buckets privados para documentos e capturas biométricas, com políticas restritas e exclusão automática conforme os prazos definidos.
- Implementar Supabase Auth e autorização administrativa no servidor; nunca confiar em papel/permissão editável pelo navegador.
- Escolher e contratar fornecedor de verificação de identidade com comparação facial e prova de vida, integrar por Edge Function/backend e tratar falhas como revisão manual.
- Definir política de privacidade, base legal LGPD, retenção e descarte com orientação jurídica.
- Configurar renovação facial do motorista a cada 3 meses e bloqueio de status online quando vencida.
- Configurar Google Maps com chave restrita ao domínio publicado e APIs necessárias; não usar chave sem restrição.
- Não colocar sb_secret_ ou service_role em arquivos do GitHub Pages. Apenas chave publicável, com RLS corretamente configurada.
- Implementar localização com permissão explícita, indicador de compartilhamento e limites de coleta; GitHub Pages não fornece rastreamento em segundo plano nativo.

CONFIGURAÇÃO
O config.js está intencionalmente vazio. Só preencher depois de o backend e as restrições estarem prontos. O config.example.js mostra os nomes das propriedades esperadas. Nunca publique segredos.
