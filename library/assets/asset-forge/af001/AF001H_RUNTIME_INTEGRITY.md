# AF-001H — Runtime Integrity Gate

**Assinatura: Tehkné Solutions**

## Resultado

`RUNTIME_SMOKE_PASS`

O AF-001H foi validado na CI do Tehkné Studio depois de uma investigação fail-closed de duas falhas reais de transporte binário.

### Evidência estrutural

- asset: `TS_ELEC_MOTOR_DC_A`;
- preview: LOD2 smoke asset;
- triângulos: `824`;
- payload íntegro: `21,452` bytes;
- SHA256: `0a74f27df8a67b61e5ac10b87c0b6fa3736531fac15044bb360a641da6228e69`;
- endpoint: `/api/asset-forge/af001/motor`;
- loader: `GLTFLoader` em React Three Fiber;
- benchmark: 120 amostras de frame-time;
- critérios smoke: média `< 100 ms`, P95 `< 150 ms`;
- erros de página/console: `0` exigido.

### Evidência CI

Workflow run `31853672748` / run number `75`:
- dependency audit: PASS;
- Alpha 01 regression gate: PASS;
- S2.1: PASS;
- S2.2: PASS;
- S2.3: PASS;
- S2.4: PASS;
- Chromium install: PASS;
- browser smoke: PASS;
- failure artifact: skipped porque não houve falha.

## Incidente detectado e corrigido

O primeiro preview LOD2 foi enviado ao repositório como arquivo GLB estático, porém o blob resultante ficou truncado/corrompido.

Evidência do primeiro browser smoke:
- arquivo esperado: `21,452` bytes;
- resposta estática observada: ~`7,497` bytes;
- `GLTFLoader`: `Invalid typed array length: 8664`.

Na primeira tentativa de correção, um gzip embutido em string monolítica também chegou inválido e foi bloqueado por `gunzipSync` com `Z_DATA_ERROR`.

A solução final segmenta o payload codificado em blocos pequenos, remonta-o no servidor, descompacta, valida byte length e SHA256 e só então responde `model/gltf-binary`.

## Regra permanente

Nenhum asset binário de produção deve ser considerado válido apenas por existir no repositório ou responder HTTP 200.

O gate de materialização deve validar, no mínimo:
- identidade do asset;
- tamanho esperado ou faixa contratada;
- hash/digest quando o artefato é imutável;
- import/reload pelo runtime;
- ausência de erro do loader.

## Limite desta promoção

AF-001H passa para `RUNTIME_SMOKE_PASS`, mas `TS_ELEC_MOTOR_DC_A` continua em `GOLDEN_ASSET_CANDIDATE`.

Continuam bloqueados de forma independente:
- render PBR final do LOD0;
- benchmark representativo Web/mobile do LOD0;
- master DCC `.blend`;
- aprovação visual final em close.
