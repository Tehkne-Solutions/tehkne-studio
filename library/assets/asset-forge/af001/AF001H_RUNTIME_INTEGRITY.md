# AF-001H — Runtime Integrity Gate

**Assinatura: Tehkné Solutions**

## Incidente detectado

O primeiro preview LOD2 foi enviado ao repositório como arquivo GLB estático, porém o blob resultante ficou truncado/corrompido.

Evidência do browser smoke:
- arquivo esperado: `21,452` bytes;
- SHA256 esperado: `0a74f27df8a67b61e5ac10b87c0b6fa3736531fac15044bb360a641da6228e69`;
- resposta estática observada: ~`7,497` bytes;
- GLTFLoader: `Invalid typed array length: 8664`.

A rota Next e os demais gates de domínio estavam saudáveis. A falha era de integridade do payload binário.

## Correção

O AF-001H passa a servir o payload de smoke por um endpoint Node dedicado:

`/api/asset-forge/af001/motor`

Antes de responder, o endpoint:
1. descompacta o payload GLB conhecido;
2. valida byte length exato;
3. valida SHA256 exato;
4. falha com `AF001H_ASSET_INTEGRITY_FAILURE` se houver divergência;
5. somente então responde `model/gltf-binary`.

O Playwright verifica a mesma integridade antes de abrir o preview 3D.

## Regra permanente

Nenhum asset binário de produção deve ser considerado válido apenas por existir no repositório ou responder HTTP 200.

O gate de materialização deve validar, no mínimo:
- identidade do asset;
- tamanho esperado ou faixa contratada;
- hash/digest quando o artefato é imutável;
- import/reload pelo runtime;
- ausência de erro do loader.

## Estado

`AF-001H_RUNTIME_INTEGRITY_CANDIDATE`

A promoção para `RUNTIME_SMOKE_PASS` depende da CI/Playwright verde nesta revisão.

Isso não promove `TS_ELEC_MOTOR_DC_A` para `GOLDEN_ASSET`; os gates visual, LOD0 benchmark e master DCC continuam independentes e fail-closed.
