# ÁguaMonitor 🌊 - Sistema Supervisório de Nível de Reservatório

> Trabalho de Conclusão de Curso (TCC) apresentado ao Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte (IFRN) - Campus Apodi.

O **ÁguaMonitor** é um sistema IoT de baixo custo desenvolvido para monitorar e controlar automaticamente o nível de água em reservatórios. A solução utiliza um microcontrolador ESP8266 e sensores ultrassônicos integrados a uma interface web via Firebase, permitindo gestão remota e em tempo real.

## 📋 Sobre o Projeto

O projeto visa solucionar a ineficiência e os riscos da verificação manual de caixas d'água e reservatórios. O sistema oferece:
* **Monitoramento em Tempo Real:** Visualização do nível de água (em % e Litros) via Web.
* **Automação:** Controle automático da bomba d'água baseado em limites definidos.
* **Gestão Remota:** Painéis para usuários e administradores.
* **Histórico de Dados:** Gráficos de consumo e exportação de relatórios.

## 🚀 Funcionalidades

### Painel do Usuário (`index.html`)
* Visualização visual e percentual do nível da Caixa Principal e Reservatório.
* Status da bomba (Ligada/Desligada).
* Alternância entre modos de operação: **Automático**, **Manual** e **Modo Férias (Econômico)**.
* Gráfico de histórico de nível em tempo real.
* Exportação de dados para Excel (.xlsx).

### Painel do Administrador (`admin.html`)
* Acesso restrito via autenticação.
* Configuração remota dos limites de acionamento (nível mínimo e máximo).
* Logs de eventos do sistema (acionamentos, erros, reinicializações).
* Controle de manutenção (Pausar coleta, Reiniciar ESP8266 remotamente).
* Monitoramento de status de conexão (Watchdog/Heartbeat).

## 🛠️ Tecnologias Utilizadas

### Hardware
* **Microcontrolador:** ESP8266 NodeMCU.
* **Sensor:** Ultrassônico HC-SR04.
* **Atuador:** Módulo Relé 5V + Mini Bomba d'água.

### Software & Web
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Backend (BaaS):** Firebase Realtime Database & Firebase Authentication.
* **Bibliotecas JS:**
    * `Chart.js` (Visualização de gráficos).
    * `SheetJS / xlsx` (Exportação de planilhas).
* **Firmware:** C++ (Desenvolvido na IDE do Arduino).

## 📂 Estrutura do Projeto

```text
/
├── admin.html      # Interface do Painel Administrativo
├── admin.js        # Lógica do Admin (monitoramento, logs, configs)
├── dashboard.js    # Lógica do Usuário (gráficos, status, conexão)
├── index.html      # Interface do Painel do Usuário (Dashboard)
├── login.html      # Tela de Login/Autenticação
├── main.css        # Estilos globais e responsividade
├── style.css       # Estilos específicos da tela de login
└── TCC...pdf       # Documentação completa do projeto
```

### 👥 Autores

Trabalho desenvolvido pelos alunos do Curso Técnico em Informática do IFRN - Campus Apodi:

Gustavo Kauê Fernandes de Oliveira

Pedro Emanuel Silva Gurgel

Saulo Araújo Costa

Orientador: Prof. Francisco Eudes Oliveira Barrozo.

### 📄 Licença
Este projeto foi desenvolvido para fins acadêmicos. Consulte a instituição para detalhes sobre direitos de uso.

2025 - IFRN Campus Apodi
