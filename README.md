# Cartografia Operacional

Portfólio interativo de engenharia de sistemas: uma organização como um
**sistema vivo** — observado, compreendido e projetado.

🌐 **Ao vivo:** https://vzambelli.github.io/cartografia/

## Conceito

Todo organograma mente. O trabalho real acontece nos fluxos invisíveis — nas
dependências, nas decisões e no que acontece quando algo quebra. A Cartografia
lê qualquer sistema por sete lentes de comportamento:

`Entrada · Transformação · Dependência · Propagação · Observabilidade · Resiliência · Colapso`

Cada lente reconfigura a rede em tempo real, na tela.

## Capítulos

| Capítulo | O que é | Link |
|---|---|---|
| **I — Sistema Vivo** | a rede que nasce, respira e reage | [`/`](https://vzambelli.github.io/cartografia/) |
| **II — Ponto Cego** | o sistema compreendido | [`/ii/`](https://vzambelli.github.io/cartografia/ii/) |

Os próximos capítulos estão no [ROADMAP](ROADMAP.md).

## Como rodar

Sem build, sem dependências. Abra o `index.html` no navegador — ou sirva a pasta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Estrutura

```
.
├── index.html          # Capítulo I — Sistema Vivo
├── css/styles.css      # identidade visual e layout
├── js/cartografia.js   # a rede viva (canvas) e os comportamentos
└── ii/index.html       # Capítulo II — Ponto Cego
```

## Tecnologia

HTML, CSS e Canvas puros. Sem frameworks.

## Licença

[MIT](LICENSE) © Vitória Zambelli
