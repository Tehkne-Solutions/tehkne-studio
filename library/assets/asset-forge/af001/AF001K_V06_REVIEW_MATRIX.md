# AF-001K v0.6 — Golden Motor review matrix

**Assinatura: Tehkné Solutions**

## Regra fail-closed

A v0.6 só pode avançar de `DCC_CANDIDATE_NOT_GOLDEN` para `HERO_CANDIDATE` quando todos os gates críticos abaixo passarem. Média numérica não compensa falha crítica.

## Evidências obrigatórias

1. three-quarter hero;
2. front orthographic;
3. side orthographic;
4. rear orthographic;
5. bearing close;
6. terminals close;
7. QA JSON com LOD0/1/2 + sockets;
8. `.blend` master candidate;
9. GLB LOD0/1/2.

## Gates críticos

### K06-01 — Silhouette
PASS somente se o objeto for reconhecível como motor DC industrial sem depender de texto ou cor.

### K06-02 — Manufacturing logic
PASS somente se shell, rolled seams, endbell, mounting recesses, bearing e terminais parecerem fabricáveis e fisicamente conectados.

### K06-03 — Material separation
PASS somente se stamped steel, machined steel, polymer e copper forem distintos sob iluminação neutra sem clipping.

### K06-04 — Surface quality
PASS somente se close de bearing/carcaça não parecer primitive/blockout e microbevels criarem highlights plausíveis.

### K06-05 — Educational readability
PASS somente se eixo, mounting points e terminais positivo/negativo forem fáceis de localizar sem descaracterizar o hardware.

### K06-06 — Tehkné identity
PASS somente se a identidade for discreta, flush/fabricável e não funcionar como glow, bandeira ou ornamento dominante.

## Gates técnicos associados

- LOD0: 3.000–4.500 tris;
- LOD1: 1.500–2.400 tris;
- LOD2: 500–900 tris;
- 4/4 sockets em todos os LODs;
- nenhuma mudança nos IDs/sockets/simulação AF-001B;
- runtime AF-001I deve ser repetido com o novo LOD0 antes de `GOLDEN_ASSET`;
- target-hardware AF-001L permanece obrigatório.

## Classificação

- `FAIL`: qualquer gate crítico falha.
- `DCC_CANDIDATE`: QA técnico passa, visual ainda não revisado.
- `HERO_CANDIDATE`: seis gates visuais passam, ainda sem runtime/target hardware final.
- `GOLDEN_ASSET`: somente após AF-001I + AF-001K + AF-001L.
