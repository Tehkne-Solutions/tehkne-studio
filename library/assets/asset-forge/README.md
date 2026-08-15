# Tehkné Studio — Asset Forge

**Assinatura: Tehkné Solutions**

Esta árvore versiona os contratos de produção dos assets 3D e seus gates de qualidade.

## Regra de promoção

Um asset não é considerado pronto apenas por possuir um modelo 3D. O estado `READY` exige, conforme aplicável:

- escala e orientação estáveis;
- pivôs e sockets funcionais;
- metadata educacional e técnica;
- GLB runtime reimportável;
- LODs medidos;
- UVs e materiais PBR;
- comportamento/simulação validado;
- QA fail-closed;
- render e benchmark no runtime alvo;
- revisão visual compatível com a direção premium do Tehkné Studio.

## Formatos

- master DCC: `.blend` quando materializado no pipeline DCC;
- runtime: `.glb` / glTF 2.0;
- metadata: `.json`;
- documentação/gates: `.md` e `.json`;
- diagramas: `.svg`;
- previews: `.png` / `.webp`.

## AF-001

O primeiro vertical slice é `TS_ELEC_MOTOR_DC_A`. Ele estabelece o padrão antes de escalar a biblioteca para roda, suporte, bateria, sensores, microcontroladores e demais componentes.

Nenhum binário candidato deve ser promovido para a biblioteca definitiva enquanto o gate visual/runtime correspondente estiver pendente.
