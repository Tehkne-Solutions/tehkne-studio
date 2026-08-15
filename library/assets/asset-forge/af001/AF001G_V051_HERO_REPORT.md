# AF-001G — Golden Motor Hero v0.5.1

**Assinatura: Tehkné Solutions**

## Estado

`HERO_CANDIDATE`

A revisão v0.5.1 mantém todos os contratos funcionais do AF-001 e altera apenas a camada visual/LOD.

### Budgets medidos
- LOD0: **3.904 tris** — PASS (3.000–4.500)
- LOD1: **2.256 tris** — PASS (1.500–2.400)
- LOD2: **744 tris** — PASS (500–900)
- UV: PASS
- required nodes: PASS em todos os LODs

## Evolução visual
- faceplate estampado em múltiplos níveis;
- conjunto central de bearing/boss com maior profundidade;
- recessos de montagem integrados;
- flat no eixo para lógica de acoplamento;
- terminal island traseira;
- blades de cobre e isoladores;
- estampagens laterais mais esparsas;
- badge Tehkné discreto e fabricável;
- indexação física inferior.

## Auditoria artística

O candidato é superior à v0.4.1 e já passa os gates estruturais, mas ainda **não** é declarado arte Golden final.

O próximo gate é `AF-001I — LOD0 PBR Runtime Review`, usando o LOD0 real no React Three Fiber para avaliar materialidade, highlights, profundidade de superfície e custo representativo.

## Promoção

`GOLDEN_ASSET = BLOCKED`

Pendências:
1. AF-001I LOD0 PBR runtime review;
2. benchmark Web/mobile representativo do LOD0;
3. master DCC `.blend`;
4. aprovação humana final em close.
