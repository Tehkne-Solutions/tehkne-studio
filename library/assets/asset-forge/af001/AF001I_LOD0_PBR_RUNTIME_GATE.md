# AF-001I — LOD0 PBR Runtime Review

**Assinatura: Tehkné Solutions**

## Objetivo

Validar o `TS_ELEC_MOTOR_DC_A` Hero Candidate v0.5.1 em condições próximas da experiência real do Tehkné Studio.

AF-001I é diferente do AF-001H:

- AF-001H provou integridade, importação e smoke básico usando um LOD leve;
- AF-001I deve julgar **arte, materialidade e custo real do LOD0**.

## Asset candidato

`TS_ELEC_MOTOR_DC_A v0.5.1`

- LOD0: 3.904 tris;
- LOD1: 2.256 tris;
- LOD2: 744 tris;
- sockets: preservados;
- UV: PASS;
- runtime behavior: inalterado;
- AF-001H: `RUNTIME_SMOKE_PASS`.

## Cena obrigatória

O review não deve usar fundo vazio como única evidência.

A cena deve conter:
- bancada/material de apoio neutro;
- key light ampla;
- fill light controlada;
- rim/accent técnico discreto;
- câmera 3/4 de inspeção;
- câmera frontal;
- câmera lateral;
- câmera traseira;
- close do eixo/bearing;
- close dos terminais;
- socket-debug opcional separado.

Não usar glow para mascarar falta de materialidade.

## Materialidade exigida

Precisamos conseguir distinguir visualmente, sem legenda:
- carcaça metálica estampada;
- aço usinado do eixo/bearing;
- polímero técnico traseiro;
- cobre dos terminais;
- isoladores elétricos;
- badge Tehkné discreto.

## Gate artístico

### I01 — Silhouette
Reconhecível como motor DC em thumbnail e close.

### I02 — Manufacturing logic
Faceplate, bearing, eixo, terminais e shell parecem fabricáveis.

### I03 — Material separation
Metal, aço, polímero, cobre e isoladores são distinguíveis sob iluminação neutra.

### I04 — Surface quality
Highlights não denunciam primitive/blockout; ausência de faceting crítico no close.

### I05 — Functional clarity
Eixo, montagem e polaridade permanecem claros para uso educacional.

### I06 — Tehkné identity
Identidade presente sem transformar o componente em prop sci-fi decorativo.

## Gate técnico

### I07 — GLB integrity
Byte length/hash ou digest de artefato validado antes do loader.

### I08 — Runtime import
GLTFLoader sem erro e sem correção manual de escala.

### I09 — LOD0 frame benchmark
Benchmark deve usar o LOD0 real e registrar média/P95 + device/browser context.

### I10 — Browser cleanliness
Zero page errors e zero console errors relacionados ao asset.

### I11 — Node/socket preservation
Nodes funcionais obrigatórios presentes no LOD0 carregado.

### I12 — Evidence
Capturas e métricas preservadas como artefato do gate.

## Promoção

AF-001I pode concluir apenas um dos estados:

- `LOD0_PBR_RUNTIME_PASS`;
- `LOD0_PBR_RUNTIME_BLOCKED`.

Mesmo `PASS` não promove sozinho para `GOLDEN_ASSET`.

Ainda serão necessários:
- master DCC `.blend`;
- aprovação visual humana final.

## Regra de qualidade

Nenhum threshold será flexibilizado para aprovar o candidato atual. Se o PBR runtime revelar deficiência artística, o asset volta para revisão visual e mantém os contratos técnicos já aprovados.
