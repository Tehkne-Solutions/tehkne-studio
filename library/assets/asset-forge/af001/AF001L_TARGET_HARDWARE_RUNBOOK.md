# AF-001L — Target Hardware Runbook

**Tehkné Solutions**

Este runbook prepara uma máquina física para executar o gate **AF-001L Target Hardware Bench** do asset `TS_ELEC_MOTOR_DC_A` v0.6.5.

## Estado autoritativo

- Asset: `TS_ELEC_MOTOR_DC_A`
- Versão: `0.6.5-hero-candidate`
- Status atual: `HERO_CANDIDATE`
- LOD0: `3292` triângulos
- GLB: `243672` bytes
- SHA-256 GLB: `ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552`
- `GOLDEN_ASSET` continua bloqueado até existir um artifact físico AF-001L com `TARGET_HARDWARE_PASS`.

## 1. Máquina alvo

Use um computador físico com GPU de hardware e sessão gráfica interativa. Para o primeiro bench oficial, Windows x64 é o caminho recomendado.

Requisitos mínimos operacionais:

- Windows 10/11 x64 atualizado;
- GPU física com driver do fabricante instalado;
- Google Chrome/Chromium disponível;
- Node.js compatível com o repositório (`>=22`);
- npm disponível;
- acesso ao repositório `Tehkne-Solutions/tehkne-studio`;
- conexão estável com GitHub Actions.

Não use VM, container gráfico, RDP sem aceleração real, SwiftShader, llvmpipe, softpipe, Microsoft Basic Render Driver, lavapipe ou outro software renderer.

## 2. Preflight local

Na raiz do repositório, em PowerShell:

```powershell
PowerShell -ExecutionPolicy Bypass `
  -File .\tools\asset_forge\af001_v065\check_target_hardware_windows.ps1 `
  -HardwareId "LAB-PC-01"
```

O preflight deve terminar com `AF001L_TARGET_HARDWARE_PREFLIGHT PASS`.

O script não substitui o bench. Ele apenas bloqueia máquinas obviamente inadequadas antes do registro do runner.

## 3. Registrar o self-hosted runner

No GitHub do repositório:

1. Abra **Settings → Actions → Runners**.
2. Escolha **New self-hosted runner**.
3. Selecione **Windows / x64**.
4. Execute no computador físico os comandos gerados pelo GitHub.
5. Na configuração, adicione o label customizado `tehkne-af001l`.
6. Use um nome estável para o runner, por exemplo `LAB-PC-01`.

### Segurança do token

O token de registro exibido pelo GitHub é efêmero e secreto.

- nunca salve o token no repositório;
- nunca cole o token em issue, PR, artifact ou log permanente;
- use apenas o comando de configuração fornecido pela UI do GitHub;
- se houver suspeita de exposição, remova o runner e gere outro token.

## 4. Runner deve ser interativo

O AF-001L executa Chromium **headful** (`headless: false`). Portanto o runner oficial do bench deve estar associado a uma sessão gráfica interativa.

No Windows, depois da configuração, inicie o runner com:

```powershell
.\run.cmd
```

Para este gate, **não instale/inicie o runner como serviço**. Um serviço Windows roda fora da sessão gráfica interativa e pode impedir o Chrome headful de representar o hardware real corretamente.

Mantenha a sessão do usuário aberta durante o bench. Em máquina de laboratório dedicada, bloqueio de tela, suspensão e economia agressiva de GPU devem estar desativados durante a execução.

## 5. Validar o runner no GitHub

Antes do dispatch, confirme em **Settings → Actions → Runners**:

- runner `Online`;
- label `self-hosted`;
- label `Windows`/arquitetura correspondente;
- label customizado `tehkne-af001l`.

O workflow físico exige `runs-on: [self-hosted, tehkne-af001l]`. Sem esse label ele permanecerá aguardando runner e não produzirá evidência.

## 6. Executar AF-001L

Abra **Actions → AF-001L Target Hardware Bench → Run workflow**.

Use:

- `hardware_id`: identificador estável da máquina, por exemplo `LAB-PC-01`;
- `physical_attestation`: exatamente `PHYSICAL_HARDWARE_CONFIRMED`.

O workflow executará, no runner físico:

1. checkout;
2. instalação de dependências;
3. security audit;
4. `verify:af001l:contract`;
5. build web;
6. instalação do Chromium Playwright;
7. `bench:af001l:hardware` em Chrome headful;
8. upload do artifact `af001l-target-hardware-<sha>`.

## 7. Critérios para TARGET_HARDWARE_PASS

O bench é fail-closed e exige simultaneamente:

- `hardware_id` presente;
- attestation `PHYSICAL_HARDWARE_CONFIRMED`;
- contexto `self-hosted:tehkne-af001l`;
- GPU/WebGL disponível;
- vendor e renderer reportados;
- nenhum marcador de software renderer;
- GLB com `243672` bytes;
- SHA-256 real do GLB igual a `ad73d83d0dcd8485a8c2a7a680f83090a98d637cea455dde4915f0d771cd6552`;
- transport SHA igual a `f6b1062238c941f81bbd5c38e154add9bb4ab56b81c06f9c45989c9604dd90c8`;
- node gate `PASS`;
- mínimo de `30` amostras;
- média de frame `<100 ms`;
- P95 `<150 ms`;
- seis screenshots: 3/4, frontal, lateral, traseira, eixo/bearing e terminais;
- zero `pageerror`;
- zero console error.

## 8. Evidência esperada

O artifact físico deve conter:

- `af001l-three-quarter.png`
- `af001l-front.png`
- `af001l-side.png`
- `af001l-rear.png`
- `af001l-bearing.png`
- `af001l-terminals.png`
- `af001l-target-hardware-context.json`

O JSON deve registrar `verdict: "TARGET_HARDWARE_PASS"`, identificação do hardware/runner, GPU vendor/renderer, fingerprints do asset e métricas do benchmark.

## 9. Promoção Golden

A existência do workflow ou o merge do gate **não** autorizam promoção.

Somente depois de revisar um artifact físico válido com `TARGET_HARDWARE_PASS` o processo de promoção poderá atualizar o manifesto para `GOLDEN_ASSET`. Até esse momento, `HERO_CANDIDATE` permanece obrigatório.

---

**Tehkné Solutions**
