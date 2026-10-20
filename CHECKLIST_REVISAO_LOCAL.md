# English Next Level — revisão local

Branch revisada: `codex/enl-cleanup`. A branch `main` e o site público não foram alterados.

## O que foi implementado

- [x] Código separado em `css/`, `js/`, `functions/`, `tests/` e `browser-tests/`.
- [x] Jogos Numbers, Words e Topics/Speak; teclado e controles de toque onde aplicável.
- [x] Perfil e progresso local; sincronização por Functions testada em emuladores locais; histórico diário por 2 anos, preservando totais antigos.
- [x] Revisão espaçada FSRS, modo visitante e suporte offline/PWA.
- [x] Firebase local com regras e funções de servidor para testes.

## O que já foi verificado

- [x] Testes automatizados: 390 aprovados.
- [x] Sintaxe: 77 arquivos JavaScript aprovados.
- [x] CI do código no commit `a6bedd5`: testes, emuladores e smoke test passaram ([resultado](https://github.com/Wolfschiffer/EnglishNextLevel/actions/runs/39441229828)).
- [x] Preview local em 320, 390 e 1280 px: sem rolagem horizontal ou erros de JavaScript.
- [x] Cópia local e branch de trabalho comparadas por hash, sem divergências.

## Confira manualmente no seu computador

- [ ] Jogar uma rodada completa de Numbers e conferir resultado e pontuação.
- [ ] Fazer uma atividade Words e ouvir a pronúncia no dispositivo.
- [ ] Abrir Topics/Speak e testar o microfone no navegador que você usa.
- [ ] Conferir telas e controles no celular; testar instalação e uso offline do PWA.
- [ ] Se revisar login e sincronização, usar somente os emuladores locais e uma conta de teste.

Áudio e microfone reais não foram aprovados manualmente. O QA do Firebase na nuvem, App Check e a publicação do backend também não foram feitos; os testes continuam locais, sem cobrança. A publicação no site principal exige revisão e aprovação suas.

## Onde localizar

- `README.md` — como abrir o projeto e executar os testes.
- `index.html` — telas e ordem de carregamento dos scripts.
- `js/` — jogos, perfil, autenticação, áudio e PWA.
- `functions/` e `firestore.rules` — validação e segurança no servidor.
- `tests/`, `browser-tests/` e `.github/workflows/quality.yml` — verificações automáticas.
