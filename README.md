# 🛰️ ICMBio WebGIS • Work Drones Geo
### Geoportal PWA de Alta Performance para Gestão e Fiscalização Ambiental
**Estação Ecológica (ESEC) da Guanabara & Área de Proteção Ambiental (APA) de Guapimirim - RJ**

---

## 📌 Visão Geral do Projeto
O **ICMBio WebGIS** foi desenvolvido sob a identidade visual e os padrões de engenharia geoespacial da **Work Drones Geo**. Trata-se de uma aplicação GIS Fullstack com suporte nativo a **PWA (Progressive Web App)**, projetada especificamente para fiscais e analistas ambientais do Instituto Chico Mendes de Conservação da Biodiversidade (ICMBio) operarem em campo com celulares e tablets, mesmo em áreas remotas e canais de manguezais **completamente sem sinal de internet**.

---

## 🚀 Principais Funcionalidades

### 1. Integração de Imagens de Satélite Sentinel-2 (Série Temporal 2023 - 2026)
- **Janela de Estiagem:** Cenas selecionadas entre maio e agosto para minimizar a interferência de nuvens (&lt; 1% de cobertura sobre a BBOX das UCs).
- **Processamento Dinâmico em Nuvem (COG / Titiler):**
  - **Cor Verdadeira (TCI / RGB):** Composição das bandas de alta resolução (10 metros).
  - **Índice de Vegetação (NDVI):** Cálculo da razão normalizada no sensor MSI:
    $$\text{NDVI} = \frac{\text{B08 (NIR)} - \text{B04 (Red)}}{\text{B08 (NIR)} + \text{B04 (Red)}}$$
    Renderizado dinamicamente via escala cromática `rdylgn` calibrada para biomas de manguezais.
- **Detecção de Mudança Temporal:** Chaveamento instantâneo entre os anos 2023, 2024, 2025 e 2026 com slider contínuo de opacidade para detectar supressões florestais e regeneração natural de mangue.

| Ano | Satélite | Data da Passagem | Nuvens (%) | Condição |
| :---: | :---: | :---: | :---: | :---: |
| **2023** | Sentinel-2B | 11/08/2023 | 0.01% | Estiagem / Céu Limpo |
| **2024** | Sentinel-2B | 15/08/2024 | 0.13% | Estiagem / Céu Limpo |
| **2025** | Sentinel-2C | 16/07/2025 | 0.90% | Estiagem / Céu Limpo |
| **2026** | Sentinel-2C | 20/08/2026 | 0.34% | Estiagem / Céu Limpo |

---

### 2. Identidade Visual ("Work Drones Geo")
- **Design System Florestal:** Paleta baseada em verde floresta escuro (`#132A13` / `#1B4332`), superfícies de alto contraste (`#081C15`), acentuação em verde esmeralda (`#52B788`) e tipografia geoespacial refinada.
- Logotipo oficial da Work Drones Geo vetorizado (SVG) integrado ao painel lateral retrátil e cabeçalho.
- Interface projetada para uso sob forte luz solar em embarcações e operações com drones em campo.

---

### 3. Rastreamento GPS em Tempo Real & Suporte 100% Offline (PWA)
- **Patrulhamento em Manguezais:** O botão flutuante de bússola/GPS ativa o rastreamento de alta acurácia (`enableHighAccuracy: true`), renderizando a posição do fiscal em tempo real, círculo de erro métrico (&plusmn;X m) e modo de seguimento (*Follow Me*).
- **Conversão Cartográfica Instantânea:** O HUD de telemetria exibe simultaneamente as coordenadas em graus decimais (WGS84) e projetadas no padrão oficial do ICMBio (**SIRGAS 2000 UTM Fuso 23 Sul**, meridiano central 45°W).
- **Service Worker (`sw.js`):** Pré-carrega o App Shell completo, polígonos oficiais das UCs e ícones em cache local, garantindo inicialização instantânea e operação fluida mesmo em modo avião ou sem sinal de telefonia.

---

### 4. Módulo de Fiscalização Colaborativa (Push Automático no GitHub)
Dispensa servidores que hibernam ou bancos de dados pagos através de uma arquitetura **GitOps Serverless**:
- **Registro de Ocorrências:** Permite marcar pontos de intercorrência (Supressão de Manguezal, Construção Irregular, Descarte de Resíduos, Queimada, Caça/Pesca Ilegal) via GPS atual ou toque no mapa.
- **Captura Fotográfica Integrada:** Captura direta pela câmera do celular com compressão automática em Canvas HTML5 (otimizada para JPEG Base64 leve).
- **Commit Atômico via GitHub REST API:** Ao salvar a ocorrência, o WebGIS obtém o SHA mais recente do arquivo `data/ocorrencias.geojson`, realiza o merge da nova feição e efetua um `PUT` com commit automático assinado pelo fiscal.
- **Fila Offline com IndexedDB:** Se o fiscal registrar ocorrências sem internet nos canais da baía, elas são guardadas com segurança no banco local `ICMBioGeoDB`. Assim que o celular reconecta (Wi-Fi ou 4G), o sistema executa sincronização em lote com 1 clique!
- **Exportação Multiformato:** Botões para download imediato em **GeoJSON**, **KML** (Google Earth / Litchi) e **CSV**.

---

## 📁 Estrutura de Arquivos do Projeto

```
c:/ICMBIO-ESEC-GEOPORTAL/
│
├── index.html                   # Estrutura semântica e interface da aplicação
├── manifest.webmanifest         # Configuração PWA (instalação no celular)
├── manifest.json                # Fallback PWA
├── sw.js                        # Service Worker com cache offline e estratégia de tiles
├── netlify.toml                 # Regras de cache, MIME types e headers de produção
├── README.md                    # Manual operacional completo
│
├── css/
│   └── style.css                # Design System Work Drones Geo (Glassmorphism & HUD)
│
├── js/
│   ├── app.js                   # Orquestrador geral, PWA install e monitor de rede
│   ├── map.js                   # Motor do Leaflet, camadas UCs, GPS e projeção UTM 23S
│   ├── sentinel.js              # Gerenciador da série temporal Sentinel-2 (RGB/NDVI)
│   ├── occurrences.js           # Cadastro de campo, fotos e exportadores (KML/CSV)
│   ├── github-sync.js           # Comunicação com GitHub REST API v3 e merge atômico
│   └── offline-store.js         # Persistência IndexedDB e fila de pendências
│
├── data/
│   ├── esec_guanabara.geojson   # Polígono oficial da Estação Ecológica da Guanabara
│   ├── apa_guapimirim.geojson   # Polígono oficial da APA de Guapimirim
│   ├── sentinel_catalog.json    # Catálogo de cenas 2023-2026 com URLs dinâmicas COG
│   ├── meta_ucs.json            # Bounding box e centróides de navegação
│   └── ocorrencias.geojson      # Base vetorial de ocorrências (comitada no GitHub)
│
├── assets/
│   ├── logo_workdrones.svg      # Logotipo vetorizado da Work Drones Geo
│   ├── icon.svg                 # Ícone da aplicação em vetor
│   ├── icon-192.png             # Ícone PWA 192x192
│   └── icon-512.png             # Ícone PWA 512x512
│
├── lib/
│   └── leaflet/                 # Leaflet 1.9.4 local (100% offline)
│       ├── leaflet.js
│       ├── leaflet.css
│       └── images/
│
└── scripts/                     # Scripts Python auxiliares de automação geoespacial
    ├── convert_limits.py        # Conversão de KML/KMZ para GeoJSON
    ├── build_sentinel_catalog.py# Busca STAC e construtor de links COG
    ├── generate_icons.py        # Gerador de ícones PWA
    └── test_server.py           # Validador de integridade HTTP
```

---

## 🌐 Como Hospedar Gratuitamente no Netlify

### Método 1: Via GitHub (Recomendado com Deploy Contínuo)
1. Crie um novo repositório no seu GitHub (ex: `icmbio-esec-geoportal`).
2. Faça o push dos arquivos desta pasta:
   ```bash
   git init
   git add .
   git commit -m "feat: release inicial do WebGIS ICMBio Work Drones Geo"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/icmbio-esec-geoportal.git
   git push -u origin main
   ```
3. Acesse [netlify.com](https://www.netlify.com/) e clique em **"Add new site"** &gt; **"Import an existing project"** &gt; **"GitHub"**.
4. Selecione o repositório `icmbio-esec-geoportal`.
5. Em **Publish directory**, deixe como `.` (a raiz do projeto). O arquivo `netlify.toml` já cuidará de todas as configurações de cache e PWA automaticamente!
6. Clique em **"Deploy Site"**. O portal estará online com HTTPS gratuito em poucos segundos!

### Método 2: Deploy Direto via Netlify Drop (Sem Git)
1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arraste e solte a pasta `c:\ICMBIO-ESEC-GEOPORTAL` diretamente na janela do navegador.
3. O Netlify publicará o site instantaneamente com URL pública e SSL ativado.

---

## 🔑 Como Configurar o Push Automático do GitHub

Para que a equipe registre ocorrências que são salvas automaticamente no repositório:
1. No GitHub, vá em **Settings** &gt; **Developer Settings** &gt; **Personal access tokens** &gt; **Fine-grained tokens** (ou *Tokens (classic)*).
2. Crie um token com a permissão:
   - `repo` (para repositórios privados) ou `Contents: Read and write` (para tokens granulares).
3. No WebGIS (no celular ou computador), abra o menu lateral &gt; aba **"GitHub"** &gt; clique em **"Configurar Token e Repositório"**.
4. Preencha:
   - **Repositório:** `SEU_USUARIO/icmbio-esec-geoportal`
   - **Token:** Cole seu token `ghp_...`
   - **Branch:** `main`
5. Clique em **"Testar Conexão"** e depois em **"Salvar Configurações"**.
6. Pronto! As credenciais ficam salvas em segurança apenas no navegador local do fiscal.

---

## 📱 Como Instalar no Celular como PWA Nativo

### No Android (Google Chrome):
1. Acesse o link do Netlify no Chrome do celular.
2. O botão verde **"📲 Instalar App"** surgirá no topo da tela, ou toque nos três pontinhos do navegador e selecione **"Instalar aplicativo"** (ou "Adicionar à tela inicial").
3. O ícone da Work Drones Geo será fixado na tela inicial e abrirá em tela cheia (standalone) como um app nativo da Play Store.

### No iOS (Apple Safari):
1. Acesse a URL no Safari do iPhone/iPad.
2. Toque no botão de compartilhamento (quadrado com seta para cima).
3. Selecione **"Adicionar à Tela de Início"**.
4. O app passa a rodar sem a barra de navegação do navegador e com acesso à câmera e GPS offline.

---

## 🛠️ Tecnologias Utilizadas
- **Core GIS:** Leaflet 1.9.4 empacotado localmente para execução offline.
- **Sensoriamento Remoto:** STAC API & Microsoft Planetary Computer (Sentinel-2 L2A COGs com Titiler).
- **PWA & Offline:** Service Workers API, Cache Storage, IndexedDB (`ICMBioGeoDB`).
- **Automação GitOps:** GitHub REST API v3 (Blobs, Commits e Trees atômicos via Base64 UTF-8).
- **Cartografia Oficial:** Referencial Geodésico SIRGAS 2000 / Projeção UTM Fuso 23S.
- **Identidade Visual:** Work Drones Geo Design System (Paleta Florestal & Glassmorphism).
