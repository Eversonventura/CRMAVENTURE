# Sprint 16 — Formulário único de contato e oportunidade, por B2B/B2C e segmento

Pedido: Contatos & Empresas e o Funil tinham pop-ups diferentes; deixar os mesmos campos
nos dois. Em B2C só a pessoa (sem empresa); em B2B manter empresa e contato; site e redes
sociais só para agência de marketing.

## O que mudou
- `funil/OpportunityModal.tsx` → o formulário muda conforme as Configurações da conta (`CrmSettingsContext`, lido no layout do CRM):
  - **B2C**: Nome do contato*, WhatsApp, E-mail, Telefone, Preferência de contato, Observação interna; Valor estimado, Responsável, Etapa, Temperatura, Prioridade, Motivo da busca, Principal problema, Objetivo desejado, Orçamento disponível, Quem decide; e Origem. Sem empresa (a "empresa" interna recebe o nome do contato) e sem serviço de interesse, probabilidade, previsão de fechamento e prazo.
  - **B2B**: empresa (nome, segmento, cidade, funcionários, faturamento, CNPJ, CEP, observação interna), contato (com cargo), comerciais e origem. **Site, Instagram, Google Meu Negócio, outra rede e link da bio só aparecem para segmento "Agência de marketing".**
- `contatos/ContatosEmpresasList.tsx` → "+ Adicionar" abre o mesmo formulário do Funil; "Editar" abre o card da oportunidade do contato (o mesmo do Funil/Diário). A tabela e a exportação seguem o modelo: B2C só Contato, WhatsApp/Telefone, E-mail e Etapa; B2B com empresa, CNPJ e CEP; site e redes só em agência.
- `contatos/CompanyContactModal.tsx` → ficou só para editar contato que ainda não tem oportunidade, também por modelo. `contatos/actions.ts`: removida a criação por esse formulário (agora é a do Funil).
- `form-fields.ts` (novo) + `actions.ts` + `contatos/actions.ts` → **corrige um risco**: salvar gravava vazio em todo campo que não veio no formulário; com formulários que escondem campos isso apagaria dados guardados (ex.: site e Instagram ao trocar a conta para um segmento sem redes). Agora só os campos enviados são gravados; campo enviado vazio continua limpando. Detalhes da origem (campanha, anúncio…) ainda são limpos ao trocar o canal.
- Importação de planilha: em B2C basta mapear "Nome do contato"; em B2B continua exigindo "Nome da empresa".
- `CrmSettingsContext.tsx` (novo) e `crm/layout.tsx` fornecem as configurações aos componentes.

## Banco
Não muda schema.

## Verificação
`npx tsc --noEmit` e `next build` limpos. Os três formulários (agência, B2B de outro segmento e B2C) renderizados com o componente real. Não testado no navegador: salvar cada formulário, editar um contato pela aba Contatos, importação em B2C, e o efeito de trocar o modelo com dados já salvos.

## Decisões minhas (confirmar)
- Em B2C mantive **Valor estimado**, que não estava na lista pedida: sem ele a venda não entra nas metas (receita e meta olímpica).
- Em B2B, os campos de empresa que não são site/redes (segmento, cidade, funcionários, faturamento, CNPJ, CEP) continuam para todos os segmentos.
