# Cartografia

Portfólio interativo em torno de uma ideia: **uma organização é um sistema vivo**.
Em vez de uma lista de projetos, o site abre como um software que observa e reage —
uma rede que nasce, respira e se reconfigura conforme você a explora.

## Comportamentos

O sistema é lido por sete lentes, e cada uma reconfigura a rede em tempo real:

`Entrada · Transformação · Dependência · Propagação · Observabilidade · Resiliência · Colapso`

## Como rodar

Não há build nem dependências. Abra o `index.html` no navegador — ou sirva a pasta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Estrutura

```
.
├── index.html        # marcação
├── css/
│   └── styles.css    # identidade visual e layout
└── js/
    └── cartografia.js # a rede viva (canvas) e os comportamentos
```

Feito com HTML, CSS e Canvas puros.
