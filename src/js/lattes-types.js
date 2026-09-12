/* ==========================================================================
   lattesZen — Taxonomia de Categorias e Tipos (espelha a Plataforma Lattes)
   --------------------------------------------------------------------------
   11 categorias numeradas, cada uma com sua lista de tipos (algumas com
   subgrupos, como Produções). Um mesmo TIPO pode aparecer em mais de uma
   categoria (ex.: Patente em "Patentes e Registros" e "Inovação"); por isso
   o item catalogado guarda SEMPRE categoryKey + typeKey.

   Campo: { key, label, type, required?, options?, placeholder? }
   type: 'text' | 'textarea' | 'number' | 'datebr' | 'date' | 'url' | 'select'
   'datebr': aceita aaaa, mm/aaaa ou dd/mm/aaaa; na exportação XML Lattes
   apenas o ANO é mantido (usado em todo campo de ano da aplicação).
   ========================================================================== */

// Átomos de campo reutilizados
const F_TITULO  = { key: 'titulo', label: 'Título', type: 'text', required: true };
const F_ANO     = { key: 'ano', label: 'Ano de início', type: 'datebr', required: true };
const F_DOI     = { key: 'doi', label: 'DOI', type: 'text', placeholder: '10.xxxx/xxxxx' };
const F_URL     = { key: 'url', label: 'URL / Link', type: 'url' };
const F_AUTORES = { key: 'autores', label: 'Autores', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' };
const F_INST    = { key: 'instituicao', label: 'Instituição', type: 'text' };
const F_FINAL   = { key: 'finalidade', label: 'Finalidade / Descrição', type: 'textarea' };
const F_CIDADE  = { key: 'cidade', label: 'Cidade', type: 'text' };
const F_NATUREZA = (options) => ({ key: 'natureza', label: 'Natureza', type: 'select', options });
const F_AINI = { key: 'anoInicio', label: 'Ano de início', type: 'datebr' };
const F_AFIM = { key: 'anoFim', label: 'Ano de fim', type: 'datebr', row: 'periodo' };
// Datas completas (dd/mm/aaaa) usadas na categoria Atuação. Na exportação XML
// Lattes apenas o ANO é mantido (o schema só aceita ANO-INICIO/ANO-FIM).
const F_DINI = { key: 'anoInicio', label: 'Data de início', type: 'datebr' };
const F_DFIM = { key: 'anoFim', label: 'Data de fim (vazio = atual)', type: 'datebr' };
const F_PAIS = { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' };
const F_IDIOMA = { key: 'idioma', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [] };
// Opções de "Meio de divulgação" (Livros/Capítulos) — enum MEIO-DE-DIVULGACAO
// do schema Lattes, exceto WEB (não usada na tela real para estes tipos).
const MEIO_DIVULGACAO_OPTIONS = ['Impresso', 'Meio magnético', 'Meio digital', 'Filme', 'Hipertexto', 'Outro', 'Impresso e mídia eletrônica'];
// Período usado nos itens de Atuação (Vínculo, Corpo editorial, Comitê,
// Revisor...): Início, Situação (Atual/Anterior) e Fim — o Fim só aparece
// quando a Situação é "Anterior (finalizado)", como na tela real do Lattes.
const periodoComSituacao = () => [
    { key: 'anoInicio', label: 'Início (mês/ano)', type: 'datebr', row: 'periodo' },
    { key: 'situacao', label: 'Situação', type: 'select', options: ['Atual (não finalizado)', 'Anterior (finalizado)'], row: 'periodo' },
    { key: 'anoFim', label: 'Fim (mês/ano)', type: 'datebr', row: 'periodo', disabledWhen: { field: 'situacao', in: ['', 'Atual (não finalizado)'] } },
];

// Níveis de Formação acadêmica/titulação (espelha FORMACAO-ACADEMICA-TITULACAO
// do schema Lattes) e um atalho para "todos os níveis, exceto os informados"
// — usado nos `disabledWhen` dos campos específicos de cada nível abaixo.
// Inclui '' (nenhum Nível escolhido ainda) na lista de exclusão: assim, antes
// de escolher o Nível, nenhum campo específico de um nível aparece.
const NIVEIS_FORMACAO = ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Graduação', 'Aperfeiçoamento',
    'Especialização', 'Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica'];
const nivelExcept = (...keep) => [...NIVEIS_FORMACAO.filter(n => !keep.includes(n)), ''];

// Conjuntos de campos reutilizáveis
// Projetos (Dados gerais + Equipe/Financiadores/Produção C&T/Orientações, na
// ordem e com os campos das telas reais do Lattes). Os blocos em tabela
// (Equipe, Instituições envolvidas, Financiamento, Produção C&T, Orientações)
// usam o tipo `repeater` (lista com adicionar/editar/remover linha).
const NATUREZA_PROJETO_OPTIONS = ['Desenvolvimento', 'Extensão', 'Pesquisa', 'Ensino', 'Outra'];
const SITUACAO_PROJETO_OPTIONS = ['Em andamento', 'Concluído', 'Desativado'];
const FINANCIADOR_NATUREZA_OPTIONS = ['Bolsa', 'Auxílio financeiro', 'Remuneração', 'Outro', 'Cooperação', 'Não informado'];
const QTD_ALUNOS_BASE = [
    { key: 'qtdGraduacao', label: 'Graduação', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdEspecializacao', label: 'Especialização', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoAcademico', label: 'Mestrado acadêmico', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdMestradoProfissional', label: 'Mestrado profissionalizante', type: 'number', row: 'qtdAlunos' },
    { key: 'qtdDoutorado', label: 'Doutorado', type: 'number', row: 'qtdAlunos' },
];
const QTD_TECNICO = { key: 'qtdTecnicoNivelMedio', label: 'Técnico de nível médio', type: 'number', row: 'qtdAlunos' };
const QTD_FUNDAMENTAL = { key: 'qtdEnsinoFundamental', label: 'Ensino Fundamental (1º grau)', type: 'number', row: 'qtdAlunos' };
const QTD_MEDIO = { key: 'qtdEnsinoMedio', label: 'Ensino Médio (2º grau)', type: 'number', row: 'qtdAlunos' };

const projetoEquipeField = (label, addLabel) => ({ key: 'equipe', label: label || 'Equipe', type: 'repeater',
    addLabel: addLabel || 'Adicionar pesquisador', columns: [
        { key: 'nome', label: 'Nome', type: 'text', required: true },
        { key: 'coordenador', label: 'Coordenador(a)', type: 'checkbox' }] });
// "Informe os dados da instituição": Nome, Sigla, País, UF — UF só habilita
// quando País = Brasil (comparação sem acento/maiúscula, via enabledWhenCol).
// Reutilizado em toda coluna/campo "instituição" da categoria Projetos.
const institucaoColumns = () => [
    { key: 'nome', label: 'Nome da instituição', type: 'text', required: true },
    { key: 'sigla', label: 'Sigla', type: 'text' },
    { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
    { key: 'uf', label: 'UF', type: 'text', enabledWhenCol: { key: 'pais', equals: 'Brasil' } },
];
const projetoInstituicoesEnvolvidasField = () => ({ key: 'instituicoesEnvolvidas', label: 'Instituições envolvidas no projeto', type: 'repeater',
    addLabel: 'Adicionar instituição', columns: institucaoColumns() });
const projetoFinanciadoresField = () => ({ key: 'financiadores', label: 'Instituição de financiamento', type: 'repeater',
    addLabel: 'Adicionar financiador', help: 'O valor financiado não será exibido na internet.', columns: [
        ...institucaoColumns(),
        { key: 'codigoProjeto', label: 'Código do projeto', type: 'text' },
        { key: 'valor', label: 'Valor financiado', type: 'number' },
        { key: 'natureza', label: 'Natureza', type: 'select', options: FINANCIADOR_NATUREZA_OPTIONS }] });
// "Instituição de execução": mesmos 4 campos (Nome/Sigla/País/UF), mas como
// valor único (não é uma lista) — UF via disabledWhen.notEquals (só habilita
// quando País = Brasil).
const projetoInstituicaoExecucaoFields = () => [
    { key: 'instituicaoExecucaoNome', label: 'Instituição de execução', type: 'text' },
    { key: 'instituicaoExecucaoSigla', label: 'Sigla', type: 'text', row: 'instExecucao' },
    { key: 'instituicaoExecucaoPais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil', row: 'instExecucao' },
    { key: 'instituicaoExecucaoUf', label: 'UF', type: 'text', row: 'instExecucao', disabledWhen: { field: 'instituicaoExecucaoPais', notEquals: 'Brasil' } },
];
const projetoProducoesField = () => ({ key: 'producoesCT', label: 'Produção C&T', type: 'repeater',
    addLabel: 'Adicionar produção', columns: [
        { key: 'titulo', label: 'Título da produção', type: 'text', required: true },
        { key: 'ano', label: 'Ano', type: 'datebr' },
        { key: 'tipo', label: 'Tipo', type: 'text' }] });
const projetoOrientacoesField = () => ({ key: 'orientacoesProjeto', label: 'Orientações', type: 'repeater',
    addLabel: 'Adicionar orientação', columns: [
        { key: 'titulo', label: 'Título da orientação', type: 'text', required: true },
        { key: 'ano', label: 'Ano', type: 'datebr' },
        { key: 'tipo', label: 'Tipo', type: 'text' }] });

// Bloco comum de Dados gerais + rodapé (Equipe...Orientações), usado pelas
// 4 naturezas "simples" de projeto (Pesquisa, Desenvolvimento, Extensão, Outro).
// `extraQtd` insere campos extras na "Quantidade de alunos envolvidos" (ex.:
// Técnico de nível médio, só em Desenvolvimento). `tituloLabel`/`natSitRow`
// são particularidades só de Projetos de pesquisa (ver PROJETO_PESQUISA).
const projetoFieldsPadrao = (extraQtdAntes, tituloLabel, natSitRow) => [
    { ...F_TITULO, label: tituloLabel || 'Título' },
    { key: 'descricao', label: 'Descrição', type: 'textarea' },
    { ...F_NATUREZA(NATUREZA_PROJETO_OPTIONS), row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'situacao', label: 'Situação', type: 'select', options: SITUACAO_PROJETO_OPTIONS, row: natSitRow ? 'naturezaSituacao' : undefined },
    { key: 'anoInicio', label: 'Ano início', type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: 'Ano fim', row: 'periodo' },
    { key: 'cooperacaoEmpresa', label: 'É um projeto de cooperação entre uma instituição de pesquisa e uma empresa?', type: 'checkbox' },
    { key: 'empresaCnpj', label: 'CNPJ da empresa', type: 'text', placeholder: '00.000.000/0000-00', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaNome', label: 'Nome da empresa', type: 'text', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaEmail', label: 'E-mail Institucional', type: 'text', placeholder: 'nome@empresa.com.br', disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'empresaSetor', label: 'Setor', type: 'select', options: window.CNAE_SETORES || [], disabledWhen: { field: 'cooperacaoEmpresa', in: ['', 'Não'] } },
    { key: 'potencialInovacao', label: 'O projeto possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'potencialInovacaoDescricao', label: 'Qual o potencial de inovação do projeto?', type: 'textarea', disabledWhen: { field: 'potencialInovacao', in: ['', 'Não'] } },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: 'Órgão/Unidade', type: 'text' },
    projetoEquipeField('Equipe', 'Adicionar pesquisador'),
    projetoInstituicoesEnvolvidasField(),
    ...(extraQtdAntes || []), ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Projeto de ensino: cooperação/inovação/temática são específicos dessa
// natureza na tela do Lattes e não têm atributo correspondente no schema
// (ficam só na interface — ver comentário em buildAtuacoes).
const ACOES_INOVADORAS_NIVEIS = ['Ensino Fundamental (1º grau)', 'Ensino Médio (2º grau)', 'Graduação', 'Especialização', 'Mestrado', 'Mestrado Profissional', 'Doutorado'];
const TEMATICA_PROJETO_ENSINO = ['Ensino e aprendizagem', 'Aprendizagem por projetos', 'Projetos de curso', 'Formação inicial ou continuada de professores',
    'Inserção de tecnologias no ensino', 'Ação inclusiva', 'Integração social (escola, família, comunidade)', 'Projeto de intervenção',
    'Mobilidade e internacionalização', 'Avaliação', 'Gestão', 'Outra'];
const PROJETO_ENSINO_FIELDS = [
    F_TITULO,
    { key: 'descricao', label: 'Descrição', type: 'textarea' },
    F_NATUREZA(NATUREZA_PROJETO_OPTIONS),
    { key: 'situacao', label: 'Situação', type: 'select', options: SITUACAO_PROJETO_OPTIONS },
    { key: 'anoInicio', label: 'Ano início', type: 'datebr', required: true, row: 'periodo' },
    { ...F_AFIM, label: 'Ano fim', row: 'periodo' },
    { key: 'cooperacaoTipos', label: 'É um projeto em cooperação com', type: 'checkboxes', options: ['Instituição de ensino', 'Agência de fomento', 'Empresa'] },
    { key: 'acoesInovadoras', label: 'O projeto possui ações inovadoras e produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'acoesInovadorasNiveis', label: 'O projeto possui ações inovadoras na', type: 'checkboxes', options: ACOES_INOVADORAS_NIVEIS, disabledWhen: { field: 'acoesInovadoras', in: ['', 'Não'] } },
    { key: 'tematica', label: 'Em relação à temática', type: 'checkboxes', options: TEMATICA_PROJETO_ENSINO },
    { key: 'tematicaOutra', label: 'Especifique (se marcou "Outra" na temática)', type: 'text' },
    { key: 'objetivosMetas', label: 'Objetivos e metas', type: 'textarea' },
    ...projetoInstituicaoExecucaoFields(),
    { key: 'orgaoUnidade', label: 'Órgão/Unidade', type: 'text' },
    projetoEquipeField('Participantes', 'Adicionar participante'),
    projetoInstituicoesEnvolvidasField(),
    QTD_FUNDAMENTAL, QTD_MEDIO, ...QTD_ALUNOS_BASE,
    projetoFinanciadoresField(), projetoProducoesField(), projetoOrientacoesField(),
];
// Átomos para a categoria 20 (Registros pessoais)
const AL_ENT   = { key: 'entidade', label: 'Entidade', type: 'text' };
const AL_PAPEL = { key: 'papel', label: 'Papel / Atuação', type: 'text' };
const AL_FREQ  = { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' };
const AL_IMP   = { key: 'descricao', label: 'Conquistas / Impacto', type: 'textarea' };
const AL_LOCAL = { key: 'local', label: 'Local / Cidade', type: 'text' };
const AL_ANO   = { key: 'ano', label: 'Ano de início', type: 'datebr' };
const alNome = (label) => ({ key: 'titulo', label, type: 'text', required: true });
// Campos padrão de uma certificação (nome+sigla, instituição emissora,
// obtenção/validade, código/link de verificação) — usados pelos 4 tipos de
// Certificações abaixo.
const alCertificacaoFields = () => [
    alNome('Nome completo da certificação'),
    { key: 'sigla', label: 'Sigla', type: 'text', row: 'certSiglaEnt' },
    { key: 'entidade', label: 'Instituição emissora', type: 'text', placeholder: 'ex.: PMI, ANBIMA, Scrum.org', row: 'certSiglaEnt' },
    { key: 'anoInicio', label: 'Ano de obtenção', type: 'datebr', row: 'certAnoVal' },
    { key: 'anoFim', label: 'Validade até', type: 'datebr', row: 'certAnoVal' },
    { key: 'codigoVerificacao', label: 'Código de verificação', type: 'text', row: 'certCodLink' },
    { key: 'url', label: 'Link de verificação', type: 'url', row: 'certCodLink' },
];
// Campos padrão de uma filiação (entidade, categoria/cargo, nº de sócio,
// período) — usados pelos 5 tipos de Filiações abaixo.
const alFiliacaoFields = () => [
    alNome('Entidade'),
    { key: 'categoria', label: 'Categoria', type: 'text', row: 'filCatSocio' },
    { key: 'numeroSocio', label: 'Número de sócio', type: 'text', row: 'filCatSocio' },
    { ...F_AINI, row: 'periodo' }, F_AFIM,
];
// Campos padrão de uma menção na imprensa (título, veículo, data) — usados
// pelos 3 tipos de Imprensa abaixo.
const alImprensaFields = () => [
    alNome('Título da matéria'),
    { key: 'entidade', label: 'Nome do veículo', type: 'text', required: true, row: 'impVeicData' },
    { key: 'ano', label: 'Data de veiculação', type: 'datebr', required: true, row: 'impVeicData' },
];

// Autores como lista (Nome completo/Nome como citado) — mesmo padrão dos
// demais tipos de Produção bibliográfica (issue de auditoria vs. Lattes real).
const PROD_AUTORES_LISTA = { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
    { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
    { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
] };
// Palavras-chave/Área/Setores/Outras informações — mesmo bloco final usado
// pelos demais tipos de Produção bibliográfica.
const PROD_PALAVRAS_AREA_SETORES_OUTRAS = [
    { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
    { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
    { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
    { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
];
// A tela real (doc 6.3/6.4) tem Nome comum/científico da espécie, Autoridade
// Nacional e Número do processo E do certificado (separados) — nenhum desses
// tem atributo correspondente em DADOS-BASICOS-DA-CULTIVAR/DETALHAMENTO-DA-
// CULTIVAR no XSD/DTD, limitação genuína do schema, por isso não entraram na
// UI. "Melhoristas" é o equivalente de Autores para este tipo (upgrade pra
// lista, mesmo padrão dos demais tipos de Produções).
const CULTIVAR_FIELDS = [{ key: 'titulo', label: 'Denominação', type: 'text', required: true }, { ...F_ANO, row: 'periodo' }, F_AFIM,
    F_FINAL, { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
    { key: 'registro', label: 'Nº do registro / solicitação', type: 'text' },
    { key: 'dataConcessao', label: 'Data da concessão / registro', type: 'date' }, F_PAIS,
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: 'Melhoristas' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS];
// Desenho industrial registrado (doc 6.5). `instituicao` = Instituição(ões)
// financiadora(s), distinta de `instituicaoRegistro` (mesmo padrão de
// Programa de Computador Registrado, issue #63).
const PI_FIELDS = [
    { key: 'registro', label: 'Número do registro', type: 'text' },
    { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { key: 'dataDeposito', label: 'Data do registro', type: 'date' },
    { key: 'dataConcessao', label: 'Data de concessão', type: 'date' },
    { ...F_FINAL, label: 'Finalidade' },
    { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { key: 'titular', label: 'Depositante/Titular (pessoas e instituições)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { ...PROD_AUTORES_LISTA, label: 'Inventores' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];
// Topografia de circuito integrado registrada (doc 6.7) — mesma estrutura de
// PI_FIELDS, mas sem Depositante/Titular nem Data do registro/concessão
// (não constam na tela real deste tipo específico).
const TOPOGRAFIA_FIELDS = [
    { key: 'registro', label: 'Número do registro', type: 'text' },
    { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
    F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
    { ...F_FINAL, label: 'Finalidade' },
    { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
    { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
    { ...PROD_AUTORES_LISTA, label: 'Inventores' },
    ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
];

/* ---- Definição global dos TIPOS (por chave) ---- */
const TYPES = {
    // 01 Dados gerais
    IDENTIFICACAO: { label: 'Identificação', noEvidence: true, singleton: true, perfil: true, fields: [
        { key: 'titulo', label: 'Nome completo (nome civil)', type: 'text', required: true },
        { key: 'usaNomeSocial', label: 'Deseja utilizar o nome social?', type: 'select', options: ['Não', 'Sim'], help: 'De acordo com o Decreto 8.727/2016, pessoa travesti ou transexual pode optar pela exibição apenas do nome social nas buscas públicas do Currículo Lattes.' },
        { key: 'nomeSocial', label: 'Nome social', type: 'text', disabledWhen: { field: 'usaNomeSocial', in: ['', 'Não'] } },
        { key: 'citacoes', label: 'Nome em citações bibliográficas', type: 'repeater', addLabel: 'Adicionar variação', help: 'Cada variação do seu nome usada em publicações (ex.: CARVALHO, Alexsandro Cardoso).', columns: [
            { key: 'nome', label: 'Variação do nome', type: 'text', required: true }] },
        { key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
        { key: 'corRaca', label: 'Cor ou raça', type: 'select', options: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não desejo declarar'] },
        { key: 'sexo', label: 'Sexo', type: 'select', options: ['Masculino', 'Feminino'], help: 'Exigido pelo Lattes na importação do XML.' },
        { key: 'nacionalidade', label: 'Nacionalidade', type: 'text', placeholder: 'Brasileira' },
        { key: 'paisNacionalidade', label: 'País de nacionalidade', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
        { key: 'pais', label: 'País de nascimento', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
        { key: 'ufNascimento', label: 'UF de nascimento', type: 'text', placeholder: 'ex.: RS', disabledWhen: { field: 'pais', notEquals: 'Brasil' } },
        { key: 'cidadeNascimento', label: 'Cidade de nascimento', type: 'text' },
        { key: 'dataNascimento', label: 'Data de nascimento', type: 'datebr' },
        { key: 'orcid', label: 'ORCID', type: 'text' },
        F_URL,
        { key: 'pcd', label: 'Você é uma pessoa com Deficiência?', type: 'select', options: ['Não', 'Sim'] },
        { key: 'deficiencias', label: 'Deficiência(s)', type: 'checkboxes', disabledWhen: { field: 'pcd', in: ['', 'Não'] }, options: ['Auditiva', 'Física', 'Intelectual', 'Visual', 'Transtorno do Espectro Autista (TEA)', 'Múltipla'], descriptions: {
            'Auditiva': 'Perda bilateral, parcial ou total, de quarenta e um decibéis (dB) ou mais, aferida por audiograma nas frequências de 500Hz, 1.000Hz, 2.000Hz e 3.000Hz (Decreto nº 3.298/1999); limitação de longo prazo da audição, uni ou bilateral, que, em interação com uma ou mais barreiras, obstrui a participação plena e efetiva da pessoa na sociedade em igualdade de condições com as demais pessoas (Lei nº 14.768/2023).',
            'Física': 'Alteração completa ou parcial de um ou mais segmentos do corpo humano, acarretando o comprometimento da função física, apresentando-se sob a forma de paraplegia, paraparesia, monoplegia, monoparesia, tetraplegia, tetraparesia, triplegia, triparesia, hemiplegia, hemiparesia, ostomia, amputação ou ausência de membro, paralisia cerebral, nanismo, membros com deformidade congênita ou adquirida, exceto as deformidades estéticas e as que não produzam dificuldades para o desempenho de funções (Decreto nº 3.298/1999).',
            'Intelectual': 'Funcionamento intelectual significativamente inferior à média, com manifestação antes dos dezoito anos e limitações associadas a duas ou mais áreas de habilidades adaptativas, tais como: comunicação; cuidado pessoal; habilidades sociais; utilização dos recursos da comunidade; saúde e segurança; habilidades acadêmicas; lazer; e trabalho (Decreto nº 3.298/1999).',
            'Visual': 'Cegueira, na qual a acuidade visual é igual ou menor que 0,05 no melhor olho, com a melhor correção óptica; baixa visão, que significa acuidade visual entre 0,3 e 0,05 no melhor olho, com a melhor correção óptica; os casos nos quais a somatória da medida do campo visual em ambos os olhos for igual ou menor que 60°; ou a ocorrência simultânea de quaisquer das condições anteriores (Decreto nº 3.298/1999); visão monocular, classificada como deficiência sensorial do tipo visual (Lei nº 14.126/2021).',
            'Transtorno do Espectro Autista (TEA)': 'Síndrome clínica caracterizada pela deficiência persistente e clinicamente significativa da comunicação e da interação sociais, manifestada por deficiência marcada de comunicação verbal e não verbal usada para interação social; ausência de reciprocidade social; falência em desenvolver e manter relações apropriadas ao seu nível de desenvolvimento; padrões restritivos e repetitivos de comportamentos, interesses e atividades; excessiva aderência a rotinas e padrões de comportamento ritualizados; e interesses restritos e fixos (Lei nº 12.764/2012).',
            'Múltipla': 'Associação de duas ou mais deficiências (Decreto nº 3.298/1999).',
        } },
    ] },
    FOTO_PERFIL: { label: 'Foto de perfil', noExport: true, noEvidence: true, singleton: true, perfil: true, accept: 'image/jpeg,image/png', fields: [{ key: 'titulo', label: 'Descrição', type: 'text', placeholder: 'ex.: Foto oficial 2025' }] },
    DOCUMENTO_PESSOAL: { label: 'Documentos pessoais', noExport: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'tipoDoc', label: 'Tipo de documento', type: 'select', required: true, options: ['Título de eleitor', 'Certidão de nascimento', 'Certidão de casamento', 'Conselho de classe', 'Diploma / Certificado', 'Carteira profissional', 'CNH', 'Comprovante de residência', 'Reservista', 'PIS/PASEP', 'Outro'] },
        { key: 'titulo', label: 'Descrição / Nº do documento', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão emissor', type: 'text' },
        { key: 'data', label: 'Data de emissão / validade', type: 'datebr' },
        { key: 'observacoes', label: 'Observações', type: 'textarea' }] },
    DOC_IDENTIDADE: { label: 'Identidade (RG)', singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: 'Número', type: 'text', required: true },
        { key: 'orgao', label: 'Órgão emissor', type: 'text' },
        { key: 'uf', label: 'Unidade Federativa (UF)', type: 'text', placeholder: 'ex.: RS' },
        { key: 'dataEmissao', label: 'Data de emissão', type: 'datebr' }] },
    DOC_PASSAPORTE: { label: 'Passaporte', singleton: true, perfil: true, accept: 'application/pdf,image/jpeg,image/png', fields: [
        { key: 'numero', label: 'Número do passaporte', type: 'text', required: true },
        { key: 'dataValidade', label: 'Data de validade', type: 'datebr' },
        { key: 'dataEmissao', label: 'Data de emissão', type: 'datebr' },
        { key: 'paisEmissao', label: 'País de emissão', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }] },
    ENDERECO: { label: 'Endereço', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'titulo', label: 'Endereço', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Profissional', 'Residencial'] }, F_CIDADE, { key: 'uf', label: 'UF', type: 'text' }, { key: 'cep', label: 'CEP', type: 'text' }] },
    LICENCA: { label: 'Licença maternidade, paternidade e adoção', noExport: true, fields: [{ key: 'titulo', label: 'Descrição', type: 'text', required: true }, { key: 'tipo', label: 'Tipo', type: 'select', options: ['Maternidade', 'Paternidade', 'Adoção'] }, { key: 'dataInicio', label: 'Data de início', type: 'datebr', row: 'periodo' }, { key: 'dataFim', label: 'Data de fim', type: 'datebr', row: 'periodo' }] },
    IDIOMAS: { label: 'Idiomas', fields: [{ key: 'titulo', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [], required: true }, { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }] },
    PREMIO: { label: 'Prêmios e títulos', fields: [F_TITULO, { key: 'ano', label: 'Data da premiação', type: 'datebr', required: true }, { key: 'entidade', label: 'Entidade promotora', type: 'text', required: true }] },
    RESUMO_CV: { label: 'Texto inicial do Currículo Lattes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: 'Texto', type: 'textarea', required: true }] },
    OUTRAS_INFO: { label: 'Outras informações relevantes', singleton: true, noEvidence: true, perfil: true, fields: [{ key: 'descricao', label: 'Descrição', type: 'textarea', required: true }] },

    // 02 Formação
    FORMACAO_ACADEMICA: { label: 'Formação acadêmica/titulação', fields: [
        { key: 'nivel', label: 'Nível', type: 'select', required: true, options: NIVEIS_FORMACAO },
        // "Tipo de X": só existe (e só faz sentido) para o próprio nível X.
        { key: 'tipoDoutorado', label: 'Tipo de doutorado', type: 'select', options: ['Normal', 'Sanduíche', 'Cotutela', 'Cotutela-Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Doutorado') } },
        { key: 'tipoMestrado', label: 'Tipo de mestrado', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado') } },
        { key: 'tipoMestradoProfissional', label: 'Tipo de mestrado profissional', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado profissional') } },
        { key: 'tipoGraduacao', label: 'Tipo de graduação', type: 'select', options: ['Normal', 'Sanduíche'],
          disabledWhen: { field: 'nivel', in: nivelExcept('Graduação') } },
        { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
        { key: 'curso', label: 'Curso', type: 'text',
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Residência médica'] } },
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true,
          disabledWhen: { field: 'nivel', in: nivelExcept('Aperfeiçoamento', 'Especialização') } },
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'] },
        { ...F_AINI, row: 'periodo' }, { key: 'anoFim', label: 'Conclusão (ano)', type: 'datebr', row: 'periodo',
          disabledWhen: { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] } },
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título (mês/ano)', type: 'datebr',
          disabledWhen: [
              { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') },
              { field: 'statusCurso', in: ['', 'Em andamento', 'Incompleto'] },
          ] },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'],
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio'] } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        { key: 'titulo', label: 'Título da dissertação/tese', type: 'text',
          labelWhen: { field: 'nivel', map: { 'Graduação': 'Título monografia', 'Aperfeiçoamento': 'Título monografia', 'Especialização': 'Título monografia' } },
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'orientador', label: 'Nome completo do orientador', type: 'text',
          disabledWhen: { field: 'nivel', in: ['Ensino fundamental', 'Ensino médio', 'Curso técnico', 'Residência médica'] } },
        { key: 'coorientador', label: 'Nome completo do coorientador', type: 'text',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado') } },
        { key: 'residenciaEm', label: 'Residência médica em', type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'numeroRegistro', label: 'Número do registro', type: 'text', disabledWhen: { field: 'nivel', in: nivelExcept('Residência médica') } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).',
          disabledWhen: { field: 'nivel', in: nivelExcept('Mestrado', 'Mestrado profissional', 'Doutorado', 'Residência médica') } },
    ] },
    POS_DOUTORADO: { label: 'Pós-doutorado e/ou livre-docência', fields: [
        { key: 'tipo', label: 'Nível', type: 'select', required: true, options: ['Pós-Doutorado', 'Livre-docência'] },
        { key: 'instituicao', label: 'Instituição', type: 'text', required: true },
        // Pós-Doutorado: Status do curso, Período (início/conclusão) e Bolsa.
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'],
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { ...F_AINI, row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'anoFim', label: 'Ano de conclusão', type: 'datebr', row: 'periodo', disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'],
          disabledWhen: { field: 'tipo', equals: 'Livre-docência' } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: { field: 'comBolsa', in: ['', 'Não'] } },
        // Livre-docência: Período (obtenção do título), Detalhamento (título),
        // Palavras-chave e Setores.
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título', type: 'datebr', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text', disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).',
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
        // Áreas: comum aos dois níveis.
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).',
          disabledWhen: { field: 'tipo', equals: 'Pós-Doutorado' } },
    ] },
    // Nível de Formação complementar (espelha FORMACAO-COMPLEMENTAR do schema
    // Lattes: 4 elementos distintos — só "MBA" tem bolsa/orientador/monografia/
    // áreas/palavras-chave/setores; os outros 3 só têm os campos básicos.
    FORMACAO_COMPLEMENTAR: { label: 'Formação complementar', fields: [
        { key: 'nivel', label: 'Nível', type: 'select', required: true, default: 'Outros',
          options: ['Curso de curta duração', 'Extensão universitária', 'MBA', 'Outros'] },
        { key: 'titulo', label: 'Curso', type: 'text', required: true },
        F_INST,
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true },
        { key: 'statusCurso', label: 'Status do curso', type: 'select', options: ['Em andamento', 'Concluído', 'Incompleto'] },
        { key: 'anoInicio', label: 'Início (ano)', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Conclusão (ano)', type: 'datebr', row: 'periodo' },
        { key: 'anoObtencaoTitulo', label: 'Obtenção do título', type: 'datebr', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'comBolsa', label: 'Com bolsa?', type: 'select', options: ['Sim', 'Não'], disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text', disabledWhen: [{ field: 'nivel', notEquals: 'MBA' }, { field: 'comBolsa', in: ['', 'Não'] }] },
        { key: 'tituloMonografia', label: 'Título da monografia', type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'orientador', label: 'Nome completo do orientador', type: 'text', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).', disabledWhen: { field: 'nivel', notEquals: 'MBA' } },
    ] },

    // 03 Atuação
    VINCULO_PROFISSIONAL: { label: 'Atuação profissional', fields: [
        { key: 'instituicao', label: 'Nome da instituição', type: 'text', required: true },
        { key: 'vinculo', label: 'Tipo do vínculo', type: 'text' },
        { key: 'vinculoEmpregaticio', label: 'Possui vínculo empregatício?', type: 'select', options: ['Sim', 'Não'] },
        { key: 'cargo', label: 'Enquadramento funcional', type: 'text' },
        { key: 'cargaHoraria', label: 'Carga horária semanal', type: 'number', na: true },
        { key: 'dedicacaoExclusiva', label: 'Dedicação exclusiva', type: 'select', options: ['Sim', 'Não'] },
        ...periodoComSituacao(),
        { key: 'titulo', label: 'Outras informações', type: 'textarea' }] },
    LINHA_PESQUISA: { label: 'Linhas de pesquisa', fields: [{ key: 'titulo', label: 'Linha de pesquisa', type: 'text', required: true }, F_INST, { key: 'descricao', label: 'Objetivos', type: 'textarea' }] },
    // noExport: o schema oficial CurriculoLattes.xsd NÃO possui elemento para
    // corpo editorial, comitê de assessoramento nem revisor (periódico/fomento)
    // — só há ATIVIDADES-DE-CONSELHO-COMISSAO-E-CONSULTORIA (=ATIV_CONSELHO).
    // Ficam catalogáveis localmente e na página pública, mas fora do XML Lattes.
    CORPO_EDITORIAL: { label: 'Membro de corpo editorial', noExport: true, fields: [
        { key: 'titulo', label: 'Periódico', type: 'text', required: true },
        ...periodoComSituacao()] },
    COMITE_ASSESSORAMENTO: { label: 'Membro de comitê de assessoramento', noExport: true, fields: [
        { key: 'instituicao', label: 'Agência de fomento', type: 'text' },
        { key: 'titulo', label: 'Comitê', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    REVISOR_PERIODICO: { label: 'Revisor de periódico', noExport: true, fields: [
        { key: 'titulo', label: 'Periódico', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    REVISOR_FOMENTO: { label: 'Revisor de projeto de agência de fomento', noExport: true, fields: [
        { key: 'titulo', label: 'Agência de fomento', type: 'text', required: true },
        ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' }] },
    AREA_ATUACAO: { label: 'Áreas de atuação', noEvidence: true, perfil: true, fields: [{ key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', required: true, help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' }] },
    // Atividades da atuação profissional (subitens de "Atuação profissional",
    // na ordem e com os campos das telas reais do Lattes). O campo com "Digite
    // e pressione ENTER" (cargo, linha de pesquisa, treinamento…) é um texto
    // livre — separe múltiplos valores por ponto e vírgula (;).
    ATIV_DIRECAO: { label: 'Direção e administração', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Cargo ou função', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_PESQUISA: { label: 'Pesquisa e desenvolvimento', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Linhas de pesquisa', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_ENSINO: { label: 'Ensino', fields: [
        F_INST,
        { key: 'nivel', label: 'Nível', type: 'select', required: true, options: ['Graduação', 'Pós-graduação', 'Especialização', 'Aperfeiçoamento', 'Ensino fundamental', 'Ensino médio', 'Outros'] },
        { key: 'curso', label: 'Curso', type: 'text', required: true }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'disciplinas', label: 'Disciplinas ministradas', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_ESTAGIO: { label: 'Estágio', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Estágio realizado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_SERVICO: { label: 'Serviço técnico especializado', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Serviço realizado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_EXTENSAO: { label: 'Extensão universitária', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Atividade de extensão realizada', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_TREINAMENTO: { label: 'Treinamento', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Treinamento ministrado', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_OUTRA: { label: 'Outra atividade técnico-científica', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Outra atividade técnico-científica', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },
    ATIV_CONSELHO: { label: 'Conselhos, comissões e consultoria', fields: [
        F_INST, { key: 'orgao', label: 'Órgão/Unidade', type: 'text' }, ...periodoComSituacao(),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
        { key: 'titulo', label: 'Cargo ou função', type: 'text', required: true, placeholder: 'Separe por ponto e vírgula (;)' }] },

    // 04 Projetos
    PROJETO_PESQUISA: { label: 'Projetos de pesquisa', fields: projetoFieldsPadrao(null, 'Nome do projeto', true) },
    PROJETO_DESENVOLVIMENTO: { label: 'Projeto de desenvolvimento tecnológico', fields: projetoFieldsPadrao([QTD_TECNICO]) },
    PROJETO_EXTENSAO: { label: 'Projeto de extensão', fields: projetoFieldsPadrao() },
    PROJETO_ENSINO: { label: 'Projeto de ensino', fields: PROJETO_ENSINO_FIELDS },
    PROJETO_OUTRO: { label: 'Outros tipos de projetos', fields: projetoFieldsPadrao() },

    // 05.1 Produção bibliográfica
    ARTIGO_PERIODICO: { label: 'Artigos completos publicados em periódicos', fields: [
        F_DOI,
        F_TITULO, F_ANO, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'periodico', label: 'Periódico / Revista', type: 'text', required: true }, { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo / Número', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial / Número artigo eletrônico', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    ARTIGO_ACEITO: { label: 'Artigos aceitos para publicação', fields: [
        F_DOI,
        F_TITULO, { ...F_ANO, label: 'Ano previsto para publicação' }, F_IDIOMA,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'periodico', label: 'Título do periódico/revista em que o artigo será publicado', type: 'text', required: true },
        { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 2 tipos específicos abaixo (Livros/Capítulos).
    LIVRO_CAPITULO: { label: 'Livros e capítulos', fields: [
        { key: 'tipoObra', label: 'Tipo', type: 'select', required: true, options: ['Livro publicado', 'Livro organizado', 'Capítulo de livro'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_AUTORES, { key: 'tituloLivro', label: 'Título do livro (se capítulo)', type: 'text' },
        { key: 'organizadores', label: 'Organizadores', type: 'text' }, { key: 'editora', label: 'Editora', type: 'text' },
        F_CIDADE, { key: 'isbn', label: 'ISBN', type: 'text' }, { key: 'edicao', label: 'Edição', type: 'text' },
        { key: 'paginas', label: 'Páginas', type: 'text' }, F_IDIOMA, F_PAIS, F_URL] },
    LIVROS: { label: 'Livros', fields: [
        F_DOI,
        { key: 'tipoObra', label: 'Tipo', type: 'select', required: true, options: ['Livro publicado', 'Organização de obra publicada'] },
        { key: 'naturezaLivroPublicado', label: 'Natureza', type: 'select', options: ['Coletânea', 'Texto Integral', 'Verbete', 'Outro'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Livro publicado' } },
        { key: 'naturezaOrganizacao', label: 'Natureza', type: 'select', options: ['Periódico', 'Outro', 'Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia'],
          disabledWhen: { field: 'tipoObra', notEquals: 'Organização de obra publicada' } },
        { key: 'titulo', label: 'Título do livro', type: 'text', required: true },
        { ...F_ANO, label: 'Ano' }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'numeroVolumes', label: 'Número de volumes', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'isbn', label: 'ISBN', type: 'text' },
        { key: 'edicao', label: 'Número da edição/revisão', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    CAPITULOS_LIVRO: { label: 'Capítulos', fields: [
        F_DOI,
        { key: 'titulo', label: 'Título do capítulo', type: 'text', required: true },
        { ...F_ANO, label: 'Ano' }, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tituloLivro', label: 'Título do livro', type: 'text' },
        { key: 'organizadores', label: 'Organizadores', type: 'text', help: 'Se houver mais de um organizador, informe os nomes separados por ponto e vírgula (;).' },
        { key: 'numeroVolumes', label: 'Número do volume', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'edicao', label: 'Número da edição/revisão', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'isbn', label: 'ISBN', type: 'text' },
        { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    TEXTO_JORNAL: { label: 'Texto em jornal ou revista (magazine)', fields: [
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Jornal de notícias', 'Revista (Magazine)'] },
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País da publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'veiculo', label: 'Título do jornal/revista em que o texto foi publicado', type: 'text', required: true },
        { key: 'issn', label: 'ISSN', type: 'text' },
        { key: 'data', label: 'Data de publicação', type: 'date' },
        { key: 'volume', label: 'Volume', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'cidade', label: 'Local de publicação', type: 'text' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    TRABALHO_EVENTO: { label: 'Trabalhos publicados em anais de eventos', fields: [
        F_DOI,
        F_NATUREZA(['Completo', 'Resumo', 'Resumo expandido']),
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País de publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'classificacaoEvento', label: 'Classificação do evento', type: 'select', options: ['Internacional', 'Nacional', 'Regional', 'Local'] },
        { key: 'evento', label: 'Nome do evento', type: 'text', required: true },
        { key: 'cidade', label: 'Cidade', type: 'text' },
        { key: 'anoEvento', label: 'Ano do evento', type: 'datebr' },
        { key: 'anais', label: 'Título dos anais do evento', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' },
        { key: 'fasciculo', label: 'Fascículo', type: 'text' },
        { key: 'serie', label: 'Série', type: 'text' },
        { key: 'paginaInicial', label: 'Página inicial', type: 'text' },
        { key: 'paginaFinal', label: 'Página final', type: 'text' },
        { key: 'isbn', label: 'ISBN/ISSN', type: 'text', validate: 'isbnIssn', placeholder: 'ISBN-10, ISBN-13 ou ISSN' },
        { key: 'editora', label: 'Nome da editora', type: 'text' },
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    APRESENTACAO: { label: 'Apresentação de trabalho e palestra', fields: [
        F_DOI,
        F_NATUREZA(['Comunicação', 'Conferência ou palestra', 'Congresso', 'Seminário', 'Simpósio', 'Outra']),
        F_TITULO, { ...F_ANO, label: 'Ano' },
        { key: 'pais', label: 'País de publicação', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        // Meio de divulgação/Home page aparecem na tela do Lattes para este
        // tipo, mas o schema de exportação offline (docs/CurriculoLattes.xsd)
        // não tem atributo correspondente em DADOS-BASICOS-DA-APRESENTACAO-DE-
        // TRABALHO — ficam só para registro, não são exportados no XML.
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'evento', label: 'Nome do evento', type: 'text' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local', type: 'text' },
        F_CIDADE,
        { key: 'autoresLista', label: 'Autores', type: 'repeater', addLabel: 'Adicionar autor', columns: [
            { key: 'nomeCompleto', label: 'Nome completo', type: 'text', required: true },
            { key: 'nomeCitacao', label: 'Nome como citado', type: 'text' },
        ] },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    PARTITURA: { label: 'Partitura musical', fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Canto', 'Coral', 'Orquestra', 'Outro']), F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'formacao', label: 'Formação instrumental', type: 'text' },
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' }, { key: 'numeroCatalogo', label: 'Número do catálogo', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRADUCAO: { label: 'Tradução', fields: [
        F_TITULO, F_ANO, F_NATUREZA(['Livro', 'Artigo', 'Outro']), F_PAIS,
        { key: 'idioma', label: 'Idioma da tradução', type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorOriginal', label: 'Autor da obra original', type: 'text' },
        { key: 'obraOriginal', label: 'Título da obra original', type: 'text' },
        { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        { key: 'idiomaOriginal', label: 'Idioma original', type: 'select', options: window.IDIOMAS_LATTES || [] },
        { key: 'editora', label: 'Editora da tradução', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'edicao', label: 'No. edição ou revisão', type: 'text' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo', type: 'text' }, { key: 'serie', label: 'Série', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PREFACIO: { label: 'Prefácio, posfácio', fields: [
        { key: 'natureza', label: 'Tipo', type: 'select', options: ['Prefácio', 'Posfácio', 'Apresentação', 'Introdução'] },
        // "Natureza" real do schema (LIVRO/OUTRA/REVISTAS_OU_PERIODICOS) — não
        // confundir com o campo acima ("Tipo" na tela real, mas guardado na
        // chave `natureza` por herdar o átomo F_NATUREZA original).
        { key: 'naturezaObra', label: 'Natureza', type: 'select', options: ['Livro', 'Revistas ou periódicos', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'autorPublicacao', label: 'Autor da publicação', type: 'text' },
        { key: 'obra', label: 'Título da publicação', type: 'text' },
        { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'edicao', label: 'No. edição ou revisão', type: 'text' },
        // "Número de páginas" existe na tela real (doc), mas o schema oficial
        // não tem atributo para isso em DETALHAMENTO-DO-PREFACIO-POSFACIO —
        // fica só de uso interno, não é exportado no XML.
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'volume', label: 'Volume', type: 'text' }, { key: 'fasciculo', label: 'Fascículo', type: 'text' }, { key: 'serie', label: 'Série', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_BIBLIOGRAFICA: { label: 'Outra produção bibliográfica', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'editora', label: 'Editora', type: 'text' }, { key: 'cidade', label: 'Cidade da editora', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' }, { key: 'issnIsbn', label: 'ISSN/ISBN', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },

    // 05.2 Produção técnica
    ASSESSORIA_CONSULTORIA: { label: 'Assessoria e consultoria', fields: [
        F_NATUREZA(['Assessoria', 'Consultoria']), F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EXTENSAO_TECNOLOGICA: { label: 'Extensão tecnológica', fields: [
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // "Tipo de programa" e "Depositante/Titular" (Pessoas/Instituições) são
    // grupos repetíveis da tela real sem elemento correspondente no XSD —
    // limitação genuína do schema, não têm como ser exportados. "Linguagens"
    // e "Qual o potencial de inovação?" (texto longo) também não têm atributo
    // correspondente. Nenhum dos quatro foi adicionado à UI por esse motivo.
    SOFTWARE_SEM_REGISTRO: { label: 'Programa de computador sem registro', fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'select', options: ['Restrita', 'Irrestrita'] },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: 'Resumo', type: 'textarea' },
    ] },
    PRODUTO_TECNOLOGICO: { label: 'Produtos', fields: [
        { key: 'natureza', label: 'Tipo', type: 'select', options: ['Piloto', 'Projeto', 'Protótipo', 'Outro'] },
        // "Natureza" real do schema (APARELHO/EQUIPAMENTO/FARMACOS_E_SIMILARES/
        // INSTRUMENTO/OUTRA) — distinta do "Tipo" acima (chave `natureza`
        // herdada do átomo F_NATUREZA original, mapeado pra TIPO-PRODUTO).
        { key: 'naturezaProduto', label: 'Natureza', type: 'select', options: ['Aparelho', 'Equipamento', 'Fármacos e similares', 'Instrumento', 'Outra'] },
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        { key: 'registro', label: 'Registro (se houver)', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    PROCESSO_TECNICA: { label: 'Processos ou técnicas', fields: [
        F_NATUREZA(['Analítica', 'Instrumental', 'Pedagógica', 'Processual', 'Terapêutica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE,
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TRABALHO_TECNICO: { label: 'Trabalhos técnicos', fields: [
        F_NATUREZA(['Parecer', 'Elaboração de projeto', 'Relatório técnico', 'Serviços na área da saúde', 'Extensão tecnológica', 'Outra']),
        F_TITULO, F_ANO, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'duracaoMeses', label: 'Duração (meses)', type: 'number' }, { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' }, F_CIDADE, F_INST,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CARTA_MAPA: { label: 'Cartas, mapas ou similares', fields: [
        F_NATUREZA(['Aerofotograma', 'Carta', 'Fotograma', 'Mapa', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'tema', label: 'Tema', type: 'text' },
        { key: 'tecnica', label: 'Técnica', type: 'text' },
        { key: 'areaRepresentada', label: 'Área representada', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    CURSO_MINISTRADO: { label: 'Curso de curta duração ministrado', fields: [
        { key: 'nivel', label: 'Nível do curso', type: 'select', options: ['Extensão', 'Aperfeiçoamento', 'Especialização', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'participacaoAutores', label: 'Participação dos autores', type: 'select', options: ['Docente', 'Organizador', 'Outra'] },
        PROD_AUTORES_LISTA,
        { key: 'cargaHoraria', label: 'Duração (carga horária)', type: 'number', na: true },
        { key: 'unidade', label: 'Unidade da duração (h, dias, meses...)', type: 'text' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local do curso', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MATERIAL_DIDATICO: { label: 'Desenvolvimento de material didático ou instrucional', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    EDITORACAO: { label: 'Editoração', fields: [
        F_NATUREZA(['Livro', 'Anais', 'Catálogo', 'Coletânea', 'Enciclopédia', 'Periódico', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'paginas', label: 'Nº de páginas', type: 'text' },
        // Editoração: o principal aqui é a Editora, não a instituição — nem
        // sempre há uma instituição promotora por trás (ex.: editora
        // comercial independente), por isso o N/A.
        { key: 'instituicao', label: 'Instituição promotora', type: 'text', na: true },
        { key: 'editora', label: 'Editora', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Meio de divulgação e Home page NÃO têm atributo correspondente no XSD/DTD
    // para Manutenção de obra artística (ao contrário dos demais tipos da
    // seção) — limitação genuína do schema, por isso não entraram na UI. O
    // campo `finalidade` (chave antiga, atrás rotulada "Finalidade /
    // Descrição") já era exportado como LOCAL — relabeled pra bater com o
    // campo real da tela ("Local"), sem trocar a chave nem os dados salvos.
    MANUTENCAO_OBRA: { label: 'Manutenção de obra artística', fields: [
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['Conservação', 'Restauração', 'Outro'] },
        F_NATUREZA(['Arquitetura', 'Desenho', 'Escultura', 'Fotografia', 'Gravura', 'Pintura', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeObra', label: 'Nome da obra', type: 'text' },
        { key: 'autorObra', label: 'Autor da obra', type: 'text' },
        { key: 'anoObra', label: 'Ano da obra', type: 'text' },
        { key: 'acervo', label: 'Acervo', type: 'select', options: ['Público', 'Privado'] },
        { ...F_FINAL, label: 'Local' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MAQUETE: { label: 'Maquete', fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'objetoRepresentado', label: 'Objeto representado', type: 'text' },
        { key: 'materialUtilizado', label: 'Material utilizado', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MIDIA: { label: 'Entrevistas, mesas redondas, programas e comentários na mídia', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', options: ['Entrevista', 'Mesa redonda', 'Comentário', 'Programa', 'Outra'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'veiculo', label: 'Veículo de divulgação', type: 'text' },
        { key: 'tema', label: 'Tema', type: 'text' },
        { key: 'dataRealizacao', label: 'Data de realização', type: 'datebr' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        PROD_AUTORES_LISTA, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    RELATORIO_PESQUISA: { label: 'Relatório de pesquisa', fields: [
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'nomeProjeto', label: 'Nome do projeto', type: 'text' },
        { key: 'paginas', label: 'Número de páginas', type: 'text' },
        { key: 'disponibilidade', label: 'Disponibilidade', type: 'text' },
        { key: 'instituicao', label: 'Instituição financiadora', type: 'text' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // A tela real tem "Natureza" (select) e "Tema" (texto) como campos
    // distintos; o campo `plataforma` já existente (antes rotulado
    // "Plataforma / Tema" e, no export antigo, usado tanto como Natureza
    // quanto como Tema — bug de conflação) só correspondia de fato ao Tema —
    // relabeled, mantendo a chave e os dados salvos. `natureza` é campo novo.
    MIDIA_SOCIAL: { label: 'Redes sociais, websites e blogs', fields: [
        F_NATUREZA(['Rede Social', 'Fórum', 'Blog', 'Site']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'plataforma', label: 'Tema', type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    OUTRA_TECNICA: { label: 'Outra produção técnica', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA, F_FINAL,
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'local', label: 'Local', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },

    // 05.3 Produção artística/cultural. Artes cênicas e Música têm a mesma
    // estrutura (Música soma "Formação instrumental"); o campo `evento`
    // (chave antiga, rotulado "Evento / Local") já era exportado como
    // INSTITUICAO-PROMOTORA-DO-EVENTO — relabeled pra bater com o campo real
    // da tela, sem trocar a chave nem os dados salvos.
    // "Ineditismo da obra" consta na tela real de Artes cênicas (doc 5.27.12),
    // mas DETALHAMENTO-DE-ARTES-CENICAS não tem o atributo FLAG-INEDITISMO-DA-
    // OBRA no XSD/DTD (só DETALHAMENTO-DA-MUSICA tem) — limitação genuína do
    // schema, por isso o campo não entrou na UI de Artes cênicas.
    ARTES_CENICAS: { label: 'Artes cênicas', fields: [
        F_NATUREZA(['Audiovisual', 'Circense', 'Coreográfica', 'Diversas', 'Operística', 'Performática', 'Radialística', 'Teatral', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tipoEvento', label: 'Tipo de evento', type: 'text' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: 'Data de estreia', type: 'datebr' },
        { key: 'localEstreia', label: 'Local da estreia', type: 'text' },
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'instituicaoPremio', label: 'Nome da instituição promotora do prêmio', type: 'text' },
        { key: 'obraReferencia', label: 'Obra de referência', type: 'text' },
        { key: 'autorObraReferencia', label: 'Autor da obra de referência', type: 'text' },
        { key: 'anoObraReferencia', label: 'Ano da obra de referência', type: 'text' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    MUSICA: { label: 'Música', fields: [
        F_NATUREZA(['Apresentação de obra', 'Arranjo', 'Audiovisual', 'Composição', 'Diversas', 'Interpretação', 'Publicação de partitura', 'Registro fonográfico', 'Trilha sonora', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'tipoEvento', label: 'Tipo de evento', type: 'text' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        { key: 'formacaoInstrumental', label: 'Formação instrumental', type: 'text' },
        { key: 'ineditismo', label: 'Ineditismo da obra', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'dataEstreia', label: 'Data de estreia', type: 'datebr' },
        { key: 'localEstreia', label: 'Local da estreia', type: 'text' },
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'instituicaoPremio', label: 'Nome da instituição promotora do prêmio', type: 'text' },
        { key: 'obraReferencia', label: 'Obra de referência', type: 'text' },
        { key: 'autorObraReferencia', label: 'Autor da obra de referência', type: 'text' },
        { key: 'anoObraReferencia', label: 'Ano da obra de referência', type: 'text' },
        { key: 'duracaoMinutos', label: 'Duração (minutos)', type: 'number' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // Tipo de evento / Itinerante / Nome da instituição promotora do prêmio
    // constam na tela real (doc 5.29), mas DETALHAMENTO-DE-ARTES-VISUAIS não
    // tem atributo correspondente no XSD/DTD — limitação genuína do schema,
    // por isso não entraram na UI.
    ARTES_VISUAIS: { label: 'Artes visuais', fields: [
        F_NATUREZA(['Intervenção urbana', 'Livro de artista', 'Performance', 'Pintura', 'Programação visual', 'Vídeo', 'Webart', 'Animação', 'Instalação', 'Computação gráfica', 'Desenho', 'Diversas', 'Escultura', 'Filme', 'Fotografia', 'Gravura', 'Ilustração', 'Outra']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'atividadeAutores', label: 'Atividade dos autores', type: 'text' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'temporada', label: 'Temporada', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    // A tela real de "Outra produção artística/cultural" tem muito mais
    // campos (Tipo de evento, Atividade dos autores, Ineditismo da obra,
    // Data de estreia/encerramento, Local da estreia, Nome da instituição
    // promotora do prêmio, Obra de referência/autor/ano, Duração, Temporada —
    // doc 5.30), mas DETALHAMENTO-DE-OUTRA-PRODUCAO-ARTISTICA-CULTURAL só tem
    // 5 atributos no XSD/DTD (INSTITUICAO-PROMOTORA-DO-EVENTO, LOCAL-DO-
    // EVENTO, CIDADE, EXPOSICAO, PREMIACAO) — de longe a maior limitação
    // genuína de schema encontrada nesta seção. Só os campos com
    // correspondência real entraram na UI.
    OUTRA_ARTISTICA: { label: 'Outra produção artística/cultural', fields: [
        { key: 'natureza', label: 'Natureza', type: 'text' },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        PROD_AUTORES_LISTA,
        { key: 'premiacao', label: 'Premiação', type: 'text' },
        { key: 'evento', label: 'Instituição promotora do evento', type: 'text' },
        { key: 'localEvento', label: 'Local do evento', type: 'text' }, F_CIDADE,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },

    // 06/07 Patentes e Registros / Inovação
    // "Situação do Depósito/Patente" (grupo repetível) usa o elemento
    // HISTORICO-SITUACOES-PATENTE, que existe no XSD mas NÃO no DTD (ainda
    // usado pela importação real do Lattes) — exportar quebraria a
    // importação, por isso não entrou na UI (campo `situacao` antigo,
    // texto livre sem exportação real, foi removido). "Depositante/Titular"
    // tem colunas separadas de Pessoas e Instituições na tela real, mas
    // REGISTRO-OU-PATENTE só tem o atributo NOME-DO-TITULAR no DTD
    // (NOME-DO-DEPOSITANTE existe só no XSD) — por isso os dois grupos
    // viram um único campo de texto livre aqui.
    PATENTE: { label: 'Patente', fields: [
        { key: 'categoria', label: 'Categoria', type: 'select', options: ['Produto', 'Processo', 'Produto e Processo', 'Outra'] },
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicao', label: 'Instituição onde foi depositada', type: 'text' }, F_PAIS,
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Patente de Invenção', 'Patente de Modelo de Utilidade'] },
        F_TITULO,
        { key: 'numeroPCT', label: 'Número do depósito PCT (caso exista)', type: 'text' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { key: 'titular', label: 'Depositante/Titular (pessoas e instituições)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        { ...PROD_AUTORES_LISTA, label: 'Inventores' },
        { key: 'outrasInfo', label: 'Resumo', type: 'textarea' },
        F_URL,
        { ...F_FINAL, label: 'Finalidade' },
        { key: 'instituicaoFinanceira', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
    ] },
    // Diferente de Programa de computador sem registro (5.13), esta tela não
    // tem Meio de divulgação, Home page nem Idioma (doc 6.2).
    SOFTWARE_REGISTRADO: { label: 'Programa de Computador Registrado', fields: [
        F_NATUREZA(['Computacional', 'Multimídia', 'Outro']),
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' },
        F_PAIS, F_TITULO,
        { key: 'dataDeposito', label: 'Data do registro', type: 'date' },
        { key: 'dataConcessao', label: 'Data do certificado de registro', type: 'date' },
        { ...F_FINAL, label: 'Finalidade' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'instituicao', label: 'Instituição(ões) financiadora(s)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)' },
        { key: 'plataforma', label: 'Plataforma / Ambiente', type: 'text' },
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS.slice(0, 3),
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    CULTIVAR_PROTEGIDA: { label: 'Cultivar protegida', fields: CULTIVAR_FIELDS },
    CULTIVAR_REGISTRADA: { label: 'Cultivar registrada', fields: CULTIVAR_FIELDS },
    DESENHO_INDUSTRIAL: { label: 'Desenho industrial registrado', fields: PI_FIELDS },
    // "Tipo" (de Produto/de Serviço/Coletiva/Certificação) consta na tela
    // real (doc 6.6.6), mas DADOS-BASICOS-DA-MARCA/DETALHAMENTO-DA-MARCA não
    // tem atributo correspondente no XSD/DTD (só NATUREZA, livre) — mantido
    // na UI como referência do usuário, mas sem exportação no XML. Sem
    // Finalidade/Depositante-Titular: não constam na tela real deste tipo.
    MARCA: { label: 'Marca registrada', fields: [
        { key: 'registro', label: 'Número do registro', type: 'text' },
        { key: 'instituicaoRegistro', label: 'Instituição de registro', type: 'text' }, F_PAIS,
        { key: 'tipo', label: 'Tipo', type: 'select', options: ['de Produto', 'de Serviço', 'Coletiva', 'Certificação'] },
        { key: 'natureza', label: 'Natureza', type: 'select', options: ['Figurativa', 'Nominativa', 'Mista', 'Tridimensional'] },
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        { key: 'dataDeposito', label: 'Data do depósito', type: 'date' },
        { key: 'dataConcessao', label: 'Data da concessão', type: 'date' },
        { key: 'potencialInovacao', label: 'Possui potencial de inovação de produtos, processos ou serviços?', type: 'checkbox' },
        { ...PROD_AUTORES_LISTA, label: 'Inventores' },
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },
    TOPOGRAFIA_CI: { label: 'Topografia de circuito integrado registrada', fields: TOPOGRAFIA_FIELDS },

    // 09 Eventos
    // "Classificação do evento" (Internacional/Nacional/Regional/Local, doc
    // 9.1.5) consta na tela real, mas nenhum dos elementos DADOS-BASICOS-DA-
    // PARTICIPACAO-EM-* / DETALHAMENTO-DA-PARTICIPACAO-EM-* tem atributo
    // correspondente no XSD/DTD (o atributo CLASSIFICACAO-DO-EVENTO existe
    // no schema, mas pertence a DETALHAMENTO-DO-TRABALHO — Trabalho publicado
    // em anais de evento, seção 5.5, um tipo totalmente diferente) —
    // limitação genuína do schema, por isso não entrou na UI. Os demais
    // campos da tela real (9.1) já estavam corretamente mapeados.
    PARTICIPACAO_EVENTO: { label: 'Participação em eventos, congressos, exposições, feiras e olimpíadas', fields: [
        { key: 'titulo', label: 'Nome do evento', type: 'text', required: true },
        { key: 'natureza', label: 'Natureza', type: 'select', required: true, options: ['Congresso', 'Seminário', 'Simpósio', 'Oficina', 'Encontro', 'Olimpíada', 'Feira', 'Exposição', 'Outra'] },
        { key: 'formaParticipacao', label: 'Forma de participação', type: 'select', options: ['Convidado', 'Participante', 'Ouvinte'] },
        { key: 'tipoParticipacao', label: 'Tipo de apresentação / participação', type: 'select', options: ['Conferencista', 'Simposista', 'Moderador', 'Avaliador', 'Homenageado'], disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'tituloApresentacao', label: 'Título da apresentação', type: 'text', help: 'Preencher apenas para Convidado ou Participante.', disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { ...F_ANO, row: 'periodo' }, F_AFIM,
        { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' },
        F_CIDADE,
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox', help: 'Só se aplica a Convidado ou Participante — Ouvinte não tem produção.', disabledWhen: { field: 'formaParticipacao', equals: 'Ouvinte' } },
        { key: 'cargaHoraria', label: 'Carga horária (h)', type: 'number', na: true, help: 'Campo interno do lattesZen — não existe no Currículo Lattes e não é exportado no XML.' },
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' }] },
    ORGANIZACAO_EVENTO: { label: 'Organização de eventos, congressos, exposições, feiras e olimpíadas', fields: [
        { key: 'tipoEvento', label: 'Tipo', type: 'select', options: ['Concerto', 'Concurso', 'Congresso', 'Exposição', 'Festival', 'Feira', 'Olimpíada', 'Outro'] },
        F_NATUREZA(['Curadoria', 'Montagem', 'Museologia', 'Organização']),
        F_TITULO, { ...F_ANO, row: 'periodo' }, F_AFIM,
        { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'meioDivulgacao', label: 'Meio de divulgação', type: 'select', options: MEIO_DIVULGACAO_OPTIONS }, F_URL,
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'divulgacaoCT', label: 'É uma produção para educação e popularização de C&T?', type: 'checkbox' },
        { key: 'instituicao', label: 'Instituição promotora', type: 'text' },
        { key: 'duracaoSemanas', label: 'Duração (semanas)', type: 'number' },
        { key: 'itinerante', label: 'Evento itinerante', type: 'checkbox' },
        { key: 'catalogo', label: 'Catálogo', type: 'checkbox' },
        { key: 'local', label: 'Local', type: 'text' }, F_CIDADE,
        PROD_AUTORES_LISTA,
        ...PROD_PALAVRAS_AREA_SETORES_OUTRAS,
    ] },

    // 10 Orientações
    ORIENTACAO_CONCLUIDA: { label: 'Orientações e supervisões concluídas', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'orientando', label: 'Nome do orientado(a)', type: 'text', required: true },
        { key: 'natureza', label: 'Tipo de orientação', type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: 'Curso', type: 'text' }, F_INST,
        { key: 'comBolsa', label: 'Com bolsa?', type: 'checkbox' },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    // "10 mais relevantes?" consta na tela real (doc 10.2, mesma estrutura de
    // 10.1), mas nenhum dos elementos DADOS-BASICOS-DA-ORIENTACAO-EM-
    // ANDAMENTO-DE-* tem o atributo FLAG-RELEVANCIA no XSD/DTD (só as
    // "concluídas" têm) — mantido na UI como referência do usuário, mas sem
    // exportação no XML para este tipo.
    ORIENTACAO_ANDAMENTO: { label: 'Orientações e supervisões em andamento', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Mestrado', 'Doutorado', 'Pós-Doutorado', 'Outra'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Iniciação científica', 'TCC / Graduação', 'Especialização / Monografia', 'Doutorado', 'Pós-Doutorado', 'Outra'] } },
        { key: 'titulo', label: 'Título do trabalho', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, { key: 'pais', label: 'País', type: 'select', options: window.PAISES_LATTES || [], default: 'Brasil' }, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'relevante', label: 'É um dos 10 trabalhos mais relevantes de sua produção?', type: 'checkbox' },
        { key: 'orientando', label: 'Nome do orientando(a)', type: 'text', required: true },
        { key: 'natureza', label: 'Tipo de orientação', type: 'select', options: ['Orientador principal', 'Coorientador'] },
        { key: 'curso', label: 'Curso', type: 'text' }, F_INST,
        { key: 'comBolsa', label: 'Com bolsa?', type: 'checkbox' },
        { key: 'bolsa', label: 'Agência financiadora', type: 'text' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },

    // 11 Bancas
    BANCA_CONCLUSAO: { label: 'Participação em bancas de trabalhos de conclusão', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Mestrado', 'Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] },
        { key: 'modalidade', label: 'Tipo', type: 'select', options: ['Acadêmico', 'Profissionalizante'], help: 'Apenas para Mestrado.',
          disabledWhen: { field: 'tipo', in: ['Doutorado', 'Exame de qualificação de doutorado', 'Exame de qualificação de mestrado', 'Curso de aperfeiçoamento/especialização', 'Graduação'] } },
        { key: 'titulo', label: 'Título', type: 'text' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        { key: 'candidato', label: 'Nome do candidato', type: 'text' }, F_INST, { key: 'curso', label: 'Curso', type: 'text' },
        { key: 'membros', label: 'Participantes da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },
    BANCA_JULGADORA: { label: 'Participação em bancas de comissões julgadoras', fields: [
        { key: 'tipo', label: 'Natureza', type: 'select', required: true, options: ['Concurso público', 'Professor titular', 'Livre-docência', 'Avaliação de cursos', 'Outra'] },
        { key: 'titulo', label: 'Título', type: 'text', help: 'Título do concurso, cargo ou processo avaliado.' }, { ...F_ANO, row: 'periodo' }, F_AFIM, F_PAIS, F_IDIOMA,
        { key: 'url', label: 'Home page do trabalho (URL)', type: 'url' },
        F_INST,
        { key: 'membros', label: 'Participantes da banca', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Um nome por posição — a ordem digitada é a ordem de autoria na banca.' },
        { key: 'palavrasChave', label: 'Palavras-chave', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;)', help: 'Até 6 palavras-chave (limite da Plataforma Lattes).' },
        { key: 'areaConhecimento', label: 'Área do conhecimento (CNPq/CAPES)', type: 'areatree', help: 'Selecione do mais geral ao mais específico: Grande área > Área > Subárea > Especialidade.' },
        { key: 'setores', label: 'Setores de atividade', type: 'cnaeSetores', help: 'Até 3 setores (lista CNAE).' },
        { key: 'outrasInfo', label: 'Outras informações', type: 'textarea' },
    ] },

    // 20 Registros pessoais — Desenvolvimento Pessoal e Habilidades
    AL_CURSO_LIVRE: { label: 'Cursos livres', fields: [alNome('Nome do curso'), { key: 'entidade', label: 'Instituição', type: 'text' }, { key: 'frequencia', label: 'Carga horária', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_IDIOMAS: { label: 'Idiomas e proficiências', fields: [{ key: 'titulo', label: 'Idioma', type: 'select', options: window.IDIOMAS_LATTES || [], required: true }, { key: 'habilidades', label: 'Proficiência (nível por habilidade)', type: 'skilllevels', options: ['Leitura', 'Fala', 'Escrita', 'Compreensão'], levels: ['Bom', 'Razoável', 'Pouco'] }, { key: 'entidade', label: 'Onde estudou', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_TREINAMENTO: { label: 'Treinamentos e workshops', fields: [alNome('Nome'), AL_ENT, AL_PAPEL, AL_FREQ, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_PROJETO_PESSOAL: { label: 'Projetos pessoais e autodidatismo', fields: [alNome('Nome do projeto'), AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Frequência / Dedicação', type: 'text' }, AL_IMP, F_URL] },

    // 99 — Engajamento Comunitário e Cidadania
    AL_VOLUNTARIADO: { label: 'Voluntariado e trabalho social', fields: [alNome('Nome da atividade'), { key: 'entidade', label: 'Organização', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Carga horária / Frequência', type: 'text' }, AL_IMP] },
    AL_LIDERANCA: { label: 'Liderança e atuação associativa', fields: [alNome('Nome / Cargo'), { key: 'entidade', label: 'Entidade / Associação', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_ORG_EVENTO_COM: { label: 'Organização de eventos comunitários', fields: [alNome('Nome do evento'), { key: 'entidade', label: 'Entidade promotora', type: 'text' }, AL_PAPEL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, AL_IMP] },

    // 99 — Saúde, Esporte e Bem-Estar
    AL_ESPORTE: { label: 'Experiências esportivas', fields: [alNome('Modalidade / Atividade'), { key: 'entidade', label: 'Clube / Local', type: 'text' }, AL_PAPEL, { ...F_AINI, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP] },
    AL_COMPETICAO: { label: 'Competições e torneios amadores', fields: [alNome('Competição'), { key: 'entidade', label: 'Organizador', type: 'text' }, { key: 'papel', label: 'Categoria / Colocação', type: 'text' }, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_LOCAL, { key: 'descricao', label: 'Resultado / Impacto', type: 'textarea' }] },
    AL_EXPEDICAO: { label: 'Expedições, Trilhas e roteiros', fields: [alNome('Expedição / Trilha'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, { key: 'frequencia', label: 'Distância / Duração', type: 'text' }, AL_PAPEL, AL_IMP] },
    AL_BEMESTAR: { label: 'Práticas integrativas e bem-estar', fields: [alNome('Prática'), AL_ENT, { key: 'frequencia', label: 'Frequência', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP] },

    // 99 — Interesses, Cultura e Lazer
    AL_HOBBY: { label: 'Hobbies e expressão artística', fields: [alNome('Hobby / Atividade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, { ...F_AINI, row: 'periodo' }, F_AFIM, AL_IMP, F_URL] },
    AL_COLECIONISMO: { label: 'Colecionismo', fields: [alNome('Coleção / Tema'), { key: 'descricao', label: 'Descrição / Acervo', type: 'textarea' }, F_AINI, { key: 'frequencia', label: 'Nº de itens / Frequência', type: 'text' }, F_URL] },
    AL_CULTURAL: { label: 'Experiências culturais', fields: [alNome('Experiência'), AL_LOCAL, { ...AL_ANO, row: 'periodo' }, F_AFIM, AL_IMP] },
    AL_GASTRONOMIA: { label: 'Gastronomia e culinária', fields: [alNome('Atividade / Especialidade'), AL_PAPEL, { key: 'frequencia', label: 'Frequência', type: 'text' }, AL_IMP, F_URL] },

    // 20 — Registros e Reconhecimentos
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 3 tipos específicos abaixo.
    AL_IMPRENSA: { label: 'Imprensa', fields: [
        alNome('Título da matéria'),
        { key: 'entidade', label: 'Nome do veículo', type: 'text', required: true },
        { key: 'ano', label: 'Data de veiculação', type: 'datebr', required: true }] },
    AL_IMPRENSA_CITACAO: { label: 'Citação na Imprensa', fields: alImprensaFields() },
    AL_IMPRENSA_ENTREVISTADO: { label: 'Entrevistado', fields: alImprensaFields() },
    AL_IMPRENSA_OUTRA: { label: 'Outras', fields: alImprensaFields() },
    AL_CONCURSO: { label: 'Concursos e processos seletivos', fields: [
        alNome('Nome do concurso / processo seletivo'),
        { key: 'local', label: 'Local', type: 'text' },
        { key: 'banca', label: 'Banca', type: 'text' },
        { key: 'cargo', label: 'Cargo', type: 'text' },
        { ...F_AINI, row: 'periodo' }, F_AFIM,
        { key: 'colocacao', label: 'Colocação', type: 'text' },
        { key: 'situacao', label: 'Situação final', type: 'select', options: ['Em andamento', 'Aprovado', 'Reprovado'] }] },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 5 tipos específicos abaixo.
    AL_FILIACAO: { label: 'Filiações', fields: [
        alNome('Entidade'),
        { key: 'categoria', label: 'Categoria', type: 'text' },
        { key: 'numeroSocio', label: 'Número de sócio', type: 'text' },
        { ...F_AINI, row: 'periodo' }, F_AFIM] },
    AL_FILIACAO_CONSELHO: { label: 'Conselhos de Classe', fields: alFiliacaoFields() },
    AL_FILIACAO_CIENTIFICA: { label: 'Entidades Científicas e de Pesquisa', fields: alFiliacaoFields() },
    AL_FILIACAO_ASSOC_PROF: { label: 'Associações Profissionais Internacionais ou Nacionais', fields: alFiliacaoFields() },
    AL_FILIACAO_SINDICATO: { label: 'Sindicatos e Associações de Categoria', fields: alFiliacaoFields() },
    AL_FILIACAO_OUTRA: { label: 'Outras', fields: alFiliacaoFields() },
    // Mantido apenas para compatibilidade com itens já catalogados (chave
    // legada); novos itens usam os 4 tipos específicos abaixo.
    AL_CERTIFICACAO: { label: 'Certificações', fields: [
        alNome('Nome da certificação'),
        { key: 'entidade', label: 'Instituto certificador', type: 'text' },
        { key: 'anoInicio', label: 'Data da certificação', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Validade até', type: 'datebr', row: 'periodo' }] },
    AL_CERT_PROF_GESTAO: { label: 'Certificações Profissionais e de Gestão', fields: alCertificacaoFields() },
    AL_CERT_TI: { label: 'Certificações de TI', fields: alCertificacaoFields() },
    AL_CERT_FINANCEIRA: { label: 'Certificações Financeiras', fields: alCertificacaoFields() },
    AL_CERT_OUTRA: { label: 'Outras certificações', fields: alCertificacaoFields() },

    // Conexões (dentro de Dados gerais; somente link; sem comprovação; não-Lattes)
    CONEXAO_SOCIAL: { label: 'Redes sociais', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Rede / Plataforma', type: 'text', required: true, placeholder: 'ex.: Instagram, Facebook, X, YouTube, TikTok' },
        { key: 'url', label: 'Link (URL)', type: 'text', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: 'Usuário / @', type: 'text' }] },
    CONEXAO_ACADEMICA: { label: 'Redes acadêmicas', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Plataforma', type: 'select', required: true, options: ['Currículo Lattes', 'Web of Science', 'Google Scholar (MyCitation)', 'Zotero', 'Outra'] },
        { key: 'url', label: 'Link (URL)', type: 'text', required: true, placeholder: 'https://...' },
        { key: 'usuario', label: 'Identificador / ID', type: 'text' }] },
    CONEXAO_PROFISSIONAL: { label: 'Redes profissionais', noExport: true, noEvidence: true, naoLattes: true, fields: [
        { key: 'titulo', label: 'Plataforma / Tipo', type: 'text', required: true, placeholder: 'ex.: LinkedIn, E-mail profissional, Site pessoal' },
        { key: 'url', label: 'Link / URL (ou e-mail)', type: 'text', required: true, placeholder: 'https://...  ou  nome@dominio' },
        { key: 'usuario', label: 'Usuário / contato', type: 'text' }] },

    /* --- Grupos de Pesquisa (não-Lattes; só com o módulo RSC) --- */
    RSC_GRUPO_PESQUISA: { label: 'Grupo de pesquisa/extensão registrado', noExport: true, rsc: true, fields: [
        { key: 'titulo', label: 'Grupo de pesquisa', type: 'text', required: true },
        { key: 'instituicao', label: 'Instituição', type: 'text', placeholder: 'ex.: UNIFESP' },
        { key: 'lideres', label: 'Líder(es)', type: 'textarea', placeholder: 'Separe por ponto e vírgula (;) se houver mais de um' },
        { key: 'viceLider', label: 'Vice-líder', type: 'text' },
        { key: 'area', label: 'Área', type: 'text', placeholder: 'ex.: Educação' },
        { key: 'papel', label: 'Função', type: 'select', options: ['Líder', 'Vice-líder', 'Pesquisador', 'Estudante', 'Técnico', 'Colaborador estrangeiro'], required: true },
        { key: 'anoInicio', label: 'Data de inclusão', type: 'datebr' },
        { key: 'egresso', label: 'Egresso', type: 'checkbox' },
        { key: 'anoFim', label: 'Data de desligamento', type: 'datebr', disabledWhen: { field: 'egresso', in: ['Não'] } },
    ] },

    /* --- Atuação em Crise de Saúde Pública (não-Lattes; só com o módulo RSC) --- */
    RSC_CRISE_SAUDE_ATUACAO: { label: 'Atuação em crise de saúde pública', noExport: true, rsc: true, fields: [
        { key: 'tipoSituacao', label: 'Tipo de situação', type: 'select', options: ['Surto', 'Epidemia', 'Pandemia'], required: true },
        { key: 'ato', label: 'Ato que decretou a situação', type: 'text' },
        { key: 'anoInicio', label: 'Data de início', type: 'datebr', row: 'periodo' },
        { key: 'anoFim', label: 'Data de fim', type: 'datebr', row: 'periodo' },
        { key: 'descricao', label: 'Descrição da atuação', type: 'textarea' },
    ] },
};
// Garante que cada tipo conheça a própria chave
Object.keys(TYPES).forEach(k => TYPES[k].key = k);

/* ---- As 11 categorias do menu Lattes (com subgrupos onde há) ---- */
const PROD_BIBLIO = ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVROS', 'CAPITULOS_LIVRO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'PARTITURA', 'TRADUCAO', 'PREFACIO', 'OUTRA_BIBLIOGRAFICA'];
const PROD_TECNICA = ['ASSESSORIA_CONSULTORIA', 'EXTENSAO_TECNOLOGICA', 'SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'TRABALHO_TECNICO', 'CARTA_MAPA', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'EDITORACAO', 'MANUTENCAO_OBRA', 'MAQUETE', 'MIDIA', 'RELATORIO_PESQUISA', 'MIDIA_SOCIAL', 'OUTRA_TECNICA'];
const PROD_ARTISTICA = ['ARTES_CENICAS', 'MUSICA', 'ARTES_VISUAIS', 'OUTRA_ARTISTICA'];
const PI_TYPES = ['PATENTE', 'SOFTWARE_REGISTRADO', 'CULTIVAR_PROTEGIDA', 'CULTIVAR_REGISTRADA', 'DESENHO_INDUSTRIAL', 'MARCA', 'TOPOGRAFIA_CI'];
const AL_NOTE = 'Os itens registrados nesta categoria não são vinculados ao Currículo Lattes e não serão exportados, mas serão exibidos na página pessoal do módulo Publicar na Web.';

window.LATTES_CATEGORIES = [
    { num: '01', key: 'DADOS_GERAIS', label: 'Dados gerais', icon: 'fa-id-card',
      // Identificação, Endereço, Texto inicial e Outras informações são
      // editados em Configurações (perfil); Foto de perfil e Documentos
      // pessoais têm categoria própria (20/21). Aqui ficam os demais itens
      // de 01 (Conexões incluída no final).
      types: ['LICENCA', 'IDIOMAS', 'PREMIO', 'CONEXAO_SOCIAL', 'CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL'] },
    { num: '02', key: 'FORMACAO', label: 'Formação', icon: 'fa-user-graduate',
      types: ['FORMACAO_ACADEMICA', 'POS_DOUTORADO', 'FORMACAO_COMPLEMENTAR'] },
    { num: '03', key: 'ATUACAO', label: 'Atuação', icon: 'fa-briefcase',
      // Áreas de atuação é editada em Configurações (perfil), não aqui.
      groups: [
          { label: null, types: ['VINCULO_PROFISSIONAL', 'LINHA_PESQUISA', 'CORPO_EDITORIAL', 'COMITE_ASSESSORAMENTO', 'REVISOR_PERIODICO', 'REVISOR_FOMENTO'] },
          { label: 'Atividades de Atuação profissional', types: ['ATIV_DIRECAO', 'ATIV_PESQUISA', 'ATIV_ENSINO', 'ATIV_ESTAGIO', 'ATIV_SERVICO', 'ATIV_EXTENSAO', 'ATIV_TREINAMENTO', 'ATIV_OUTRA', 'ATIV_CONSELHO'] },
      ] },
    { num: '04', key: 'PROJETOS', label: 'Projetos', icon: 'fa-diagram-project',
      types: ['PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '05', key: 'PRODUCOES', label: 'Produções', icon: 'fa-book',
      groups: [
          { label: 'Produção Bibliográfica', types: PROD_BIBLIO },
          { label: 'Produção Técnica', types: PROD_TECNICA },
          { label: 'Outra produção artística/cultural', types: PROD_ARTISTICA },
      ] },
    { num: '06', key: 'PATENTES_REGISTROS', label: 'Patentes e Registros', icon: 'fa-certificate', types: PI_TYPES },
    { num: '07', key: 'INOVACAO', label: 'Inovação', icon: 'fa-lightbulb',
      types: ['SOFTWARE_SEM_REGISTRO', 'PRODUTO_TECNOLOGICO', 'PROCESSO_TECNICA', 'PROJETO_PESQUISA', 'PROJETO_DESENVOLVIMENTO', 'PROJETO_EXTENSAO', 'PROJETO_ENSINO', 'PROJETO_OUTRO'] },
    { num: '08', key: 'EDUCACAO_CT', label: 'Educação e Popularização de C&T', icon: 'fa-chalkboard-user',
      types: ['ARTIGO_PERIODICO', 'ARTIGO_ACEITO', 'LIVROS', 'CAPITULOS_LIVRO', 'TEXTO_JORNAL', 'TRABALHO_EVENTO', 'APRESENTACAO', 'SOFTWARE_SEM_REGISTRO', 'CURSO_MINISTRADO', 'MATERIAL_DIDATICO', 'MIDIA', 'SOFTWARE_REGISTRADO', 'ORGANIZACAO_EVENTO', 'PARTICIPACAO_EVENTO', 'MIDIA_SOCIAL', 'ARTES_VISUAIS', 'ARTES_CENICAS', 'MUSICA', 'OUTRA_BIBLIOGRAFICA', 'OUTRA_TECNICA', 'OUTRA_ARTISTICA'] },
    { num: '09', key: 'EVENTOS', label: 'Eventos', icon: 'fa-calendar-days', types: ['PARTICIPACAO_EVENTO', 'ORGANIZACAO_EVENTO'] },
    { num: '10', key: 'ORIENTACOES', label: 'Orientações', icon: 'fa-user-group', types: ['ORIENTACAO_CONCLUIDA', 'ORIENTACAO_ANDAMENTO'] },
    { num: '11', key: 'BANCAS', label: 'Bancas', icon: 'fa-gavel', types: ['BANCA_CONCLUSAO', 'BANCA_JULGADORA'] },
    { num: '12', key: 'AL_DESENVOLVIMENTO', label: 'Desenvolvimento Pessoal e Habilidades', icon: 'fa-seedling', naoLattes: true,
      note: AL_NOTE, types: ['AL_CURSO_LIVRE', 'AL_IDIOMAS', 'AL_TREINAMENTO', 'AL_PROJETO_PESSOAL'] },
    { num: '13', key: 'AL_ENGAJAMENTO', label: 'Engajamento Comunitário e Cidadania', icon: 'fa-people-group', naoLattes: true,
      note: AL_NOTE, types: ['AL_VOLUNTARIADO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM'] },
    { num: '14', key: 'AL_SAUDE_ESPORTE', label: 'Saúde, Esporte e Bem-Estar', icon: 'fa-heart-pulse', naoLattes: true,
      note: AL_NOTE, types: ['AL_ESPORTE', 'AL_COMPETICAO', 'AL_EXPEDICAO', 'AL_BEMESTAR'] },
    { num: '15', key: 'AL_INTERESSES', label: 'Interesses, Cultura e Lazer', icon: 'fa-palette', naoLattes: true,
      note: AL_NOTE, types: ['AL_HOBBY', 'AL_COLECIONISMO', 'AL_CULTURAL', 'AL_GASTRONOMIA'] },
    { num: '16', key: 'AL_CERTIFICACAO_CAT', label: 'Certificações', icon: 'fa-certificate', naoLattes: true,
      note: AL_NOTE, types: ['AL_CERT_PROF_GESTAO', 'AL_CERT_TI', 'AL_CERT_FINANCEIRA', 'AL_CERT_OUTRA'] },
    { num: '17', key: 'AL_FILIACAO_CAT', label: 'Filiações', icon: 'fa-id-badge', naoLattes: true,
      note: AL_NOTE, types: ['AL_FILIACAO_CONSELHO', 'AL_FILIACAO_CIENTIFICA', 'AL_FILIACAO_ASSOC_PROF', 'AL_FILIACAO_SINDICATO', 'AL_FILIACAO_OUTRA'] },
    { num: '18', key: 'AL_CONCURSO_CAT', label: 'Concursos e Processos seletivos', icon: 'fa-list-check', naoLattes: true,
      note: AL_NOTE, types: ['AL_CONCURSO'] },
    { num: '19', key: 'AL_IMPRENSA_CAT', label: 'Imprensa', icon: 'fa-newspaper', naoLattes: true,
      note: AL_NOTE, types: ['AL_IMPRENSA_CITACAO', 'AL_IMPRENSA_ENTREVISTADO', 'AL_IMPRENSA_OUTRA'] },
    { num: '20', key: 'RSC_GRUPO', label: 'Grupos de Pesquisa', icon: 'fa-microscope', naoLattes: true, rscOnly: true,
      types: ['RSC_GRUPO_PESQUISA'] },
    // Fotos de Perfil e Documentos pessoais: editados em Configurações
    // (perfil), não em Catalogar — por isso `perfilOnly` (fora do seletor
    // de categoria do Catalogar), mas continuam vinculados ao Lattes. Ficam
    // como subpasta de "01 Dados Gerais" (`subOf`), não soltas em
    // "Evidências" — daí o num com ponto (01.1, 01.2).
    { num: '01.1', key: 'PERFIL_FOTOS', label: 'Fotos de Perfil', icon: 'fa-camera', perfilOnly: true, subOf: 'DADOS_GERAIS', types: ['FOTO_PERFIL'] },
    { num: '21', key: 'RSC_CRISE_SAUDE', label: 'Atuação em Crise de Saúde Pública', icon: 'fa-virus', naoLattes: true, rscOnly: true,
      types: ['RSC_CRISE_SAUDE_ATUACAO'] },
    { num: '01.2', key: 'PERFIL_DOCS', label: 'Documentos pessoais', icon: 'fa-address-card', perfilOnly: true, subOf: 'DADOS_GERAIS', types: ['DOCUMENTO_PESSOAL', 'DOC_IDENTIDADE', 'DOC_PASSAPORTE'] },
];

// Categoria "primária" de cada tipo (usada pelo importador do XML)
const PRIMARY_CATEGORY = {
    IDENTIFICACAO: 'DADOS_GERAIS', FOTO_PERFIL: 'PERFIL_FOTOS', DOCUMENTO_PESSOAL: 'PERFIL_DOCS', DOC_IDENTIDADE: 'PERFIL_DOCS', DOC_PASSAPORTE: 'PERFIL_DOCS', ENDERECO: 'DADOS_GERAIS', LICENCA: 'DADOS_GERAIS', IDIOMAS: 'DADOS_GERAIS',
    PREMIO: 'DADOS_GERAIS', RESUMO_CV: 'DADOS_GERAIS', OUTRAS_INFO: 'DADOS_GERAIS',
    FORMACAO_ACADEMICA: 'FORMACAO', POS_DOUTORADO: 'FORMACAO', FORMACAO_COMPLEMENTAR: 'FORMACAO',
    VINCULO_PROFISSIONAL: 'ATUACAO', LINHA_PESQUISA: 'ATUACAO', CORPO_EDITORIAL: 'ATUACAO', COMITE_ASSESSORAMENTO: 'ATUACAO', REVISOR_PERIODICO: 'ATUACAO', REVISOR_FOMENTO: 'ATUACAO', AREA_ATUACAO: 'ATUACAO',
    ATIV_ENSINO: 'ATUACAO', ATIV_DIRECAO: 'ATUACAO', ATIV_CONSELHO: 'ATUACAO', ATIV_EXTENSAO: 'ATUACAO', ATIV_SERVICO: 'ATUACAO', ATIV_OUTRA: 'ATUACAO',
    ATIV_PESQUISA: 'ATUACAO', ATIV_ESTAGIO: 'ATUACAO', ATIV_TREINAMENTO: 'ATUACAO',
    PROJETO_PESQUISA: 'PROJETOS', PROJETO_DESENVOLVIMENTO: 'PROJETOS', PROJETO_EXTENSAO: 'PROJETOS', PROJETO_ENSINO: 'PROJETOS', PROJETO_OUTRO: 'PROJETOS',
    ARTIGO_PERIODICO: 'PRODUCOES', ARTIGO_ACEITO: 'PRODUCOES', LIVRO_CAPITULO: 'PRODUCOES', LIVROS: 'PRODUCOES', CAPITULOS_LIVRO: 'PRODUCOES', TEXTO_JORNAL: 'PRODUCOES', TRABALHO_EVENTO: 'PRODUCOES', APRESENTACAO: 'PRODUCOES', PARTITURA: 'PRODUCOES', TRADUCAO: 'PRODUCOES', PREFACIO: 'PRODUCOES', OUTRA_BIBLIOGRAFICA: 'PRODUCOES',
    ASSESSORIA_CONSULTORIA: 'PRODUCOES', EXTENSAO_TECNOLOGICA: 'PRODUCOES', SOFTWARE_SEM_REGISTRO: 'PRODUCOES', PRODUTO_TECNOLOGICO: 'PRODUCOES', PROCESSO_TECNICA: 'PRODUCOES', TRABALHO_TECNICO: 'PRODUCOES', CARTA_MAPA: 'PRODUCOES', CURSO_MINISTRADO: 'PRODUCOES', MATERIAL_DIDATICO: 'PRODUCOES', EDITORACAO: 'PRODUCOES', MANUTENCAO_OBRA: 'PRODUCOES', MAQUETE: 'PRODUCOES', MIDIA: 'PRODUCOES', RELATORIO_PESQUISA: 'PRODUCOES', MIDIA_SOCIAL: 'PRODUCOES', OUTRA_TECNICA: 'PRODUCOES',
    ARTES_CENICAS: 'PRODUCOES', MUSICA: 'PRODUCOES', ARTES_VISUAIS: 'PRODUCOES', OUTRA_ARTISTICA: 'PRODUCOES',
    PATENTE: 'PATENTES_REGISTROS', SOFTWARE_REGISTRADO: 'PATENTES_REGISTROS', CULTIVAR_PROTEGIDA: 'PATENTES_REGISTROS', CULTIVAR_REGISTRADA: 'PATENTES_REGISTROS', DESENHO_INDUSTRIAL: 'PATENTES_REGISTROS', MARCA: 'PATENTES_REGISTROS', TOPOGRAFIA_CI: 'PATENTES_REGISTROS',
    PARTICIPACAO_EVENTO: 'EVENTOS', ORGANIZACAO_EVENTO: 'EVENTOS',
    ORIENTACAO_CONCLUIDA: 'ORIENTACOES', ORIENTACAO_ANDAMENTO: 'ORIENTACOES',
    BANCA_CONCLUSAO: 'BANCAS', BANCA_JULGADORA: 'BANCAS',
    // chaves legadas (compatibilidade com dados antigos)
    LIVRO: 'PRODUCOES', CAPITULO_LIVRO: 'PRODUCOES', SOFTWARE: 'PRODUCOES', ORIENTACAO: 'ORIENTACOES', BANCA: 'BANCAS', PROJETO: 'PROJETOS',
};
['AL_CURSO_LIVRE', 'AL_IDIOMAS', 'AL_TREINAMENTO', 'AL_PROJETO_PESSOAL'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_DESENVOLVIMENTO'; });
['AL_VOLUNTARIADO', 'AL_LIDERANCA', 'AL_ORG_EVENTO_COM'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_ENGAJAMENTO'; });
['AL_ESPORTE', 'AL_COMPETICAO', 'AL_EXPEDICAO', 'AL_BEMESTAR'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_SAUDE_ESPORTE'; });
['AL_HOBBY', 'AL_COLECIONISMO', 'AL_CULTURAL', 'AL_GASTRONOMIA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_INTERESSES'; });
PRIMARY_CATEGORY.AL_CERTIFICACAO = 'AL_CERTIFICACAO_CAT';
['AL_CERT_PROF_GESTAO', 'AL_CERT_TI', 'AL_CERT_FINANCEIRA', 'AL_CERT_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_CERTIFICACAO_CAT'; });
PRIMARY_CATEGORY.AL_FILIACAO = 'AL_FILIACAO_CAT';
['AL_FILIACAO_CONSELHO', 'AL_FILIACAO_CIENTIFICA', 'AL_FILIACAO_ASSOC_PROF', 'AL_FILIACAO_SINDICATO', 'AL_FILIACAO_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_FILIACAO_CAT'; });
PRIMARY_CATEGORY.AL_CONCURSO = 'AL_CONCURSO_CAT';
PRIMARY_CATEGORY.AL_IMPRENSA = 'AL_IMPRENSA_CAT';
['AL_IMPRENSA_CITACAO', 'AL_IMPRENSA_ENTREVISTADO', 'AL_IMPRENSA_OUTRA'].forEach(k => { PRIMARY_CATEGORY[k] = 'AL_IMPRENSA_CAT'; });
['CONEXAO_SOCIAL', 'CONEXAO_ACADEMICA', 'CONEXAO_PROFISSIONAL'].forEach(k => { PRIMARY_CATEGORY[k] = 'DADOS_GERAIS'; });
PRIMARY_CATEGORY.RSC_GRUPO_PESQUISA = 'RSC_GRUPO';
PRIMARY_CATEGORY.RSC_CRISE_SAUDE_ATUACAO = 'RSC_CRISE_SAUDE';
const LEGACY_TYPE = { LIVRO: 'LIVRO_CAPITULO', CAPITULO_LIVRO: 'LIVRO_CAPITULO', SOFTWARE: 'SOFTWARE_SEM_REGISTRO', ORIENTACAO: 'ORIENTACAO_ANDAMENTO', BANCA: 'BANCA_CONCLUSAO' };

/* ---- Categoria/tipo especial: itens NÃO LATTES ---- */
window.NAO_LATTES_TYPE = {
    key: 'NAO_LATTES', label: 'Item não-Lattes (pessoal)',
    fields: [F_TITULO, { key: 'categoria', label: 'Categoria', type: 'select', options: ['Hobby', 'Atividade pessoal', 'Voluntariado', 'Certificado avulso', 'Curso livre', 'Outro'] }, { ...F_ANO, row: 'periodo' }, F_AFIM, { key: 'descricao', label: 'Descrição', type: 'textarea' }, F_URL],
};

/* ---- Enums do schema Lattes: normalização rótulo↔token ----
   Muitos atributos do XSD são enumerados (NATUREZA, TIPO, NÍVEL, SITUAÇÃO…).
   O lattesZen usa rótulos legíveis; o Lattes usa tokens em CAIXA_ALTA. Estas
   funções convertem nos dois sentidos, garantindo ida-e-volta sem perdas. */
function _tok(s) {
    return String(s == null ? '' : s).trim().toUpperCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
        .replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Aliases onde o rótulo não normaliza exatamente para o token do XSD.
const ENUM_ALIAS = {
    'LIVRO_ORGANIZADO': 'LIVRO_ORGANIZADO_OU_EDICAO',
    'CONFERENCIA_OU_PALESTRA': 'CONFERENCIA',
};
function enumToken(value) {
    const t = _tok(value);
    return ENUM_ALIAS[t] || t;
}
window.LattesEnums = { tok: _tok, token: enumToken };

/* ---- API pública ---- */
window.LattesTypes = (function () {
    const catByKey = {};
    LATTES_CATEGORIES.forEach(c => { catByKey[c.key] = c; });
    catByKey['NAO_LATTES'] = { num: '00', key: 'NAO_LATTES', label: 'Não-Lattes', icon: 'fa-heart' };

    const BACKUP_FOLDER = 'Cópia de segurança';
    const INBOX_FOLDER = 'Caixa de Entrada';
    const EVIDENCIAS_FOLDER = 'Evidências';
    const LATTES_XML_FOLDER = 'Exportação/Lattes XML';
    const RSC_PCCTAE_FOLDER = 'Exportação/RSC-PCCTAE';
    const SUMULA_FAPESP_FOLDER = 'Exportação/Súmula Curricular FAPESP';
    const EXPORT_FOLDERS = [RSC_PCCTAE_FOLDER, 'Exportação/Progressão Docentes', SUMULA_FAPESP_FOLDER, LATTES_XML_FOLDER];
    const PUBLICACAO_FOLDER = 'Publicação para Web';
    const LIXEIRA_FOLDER = 'Lixeira';
    const EXTRA_FOLDERS = [PUBLICACAO_FOLDER, 'Relatórios', LIXEIRA_FOLDER];

    // Nome de pasta seguro para o sistema de arquivos, legível e ordenável
    // Padrão: "NN Nome" (número + espaço + nome, sem hífen)
    function folderName(cat) {
        const safe = (cat.label || cat.key).replace(/[\\/:*?"<>|]/g, '').trim();
        return `${cat.num || '00'} ${safe}`;
    }
    function slugFolder(cat) {
        // subOf: fica como subpasta da categoria indicada, não solta em
        // "Evidências" (ex.: Fotos de Perfil/Documentos pessoais dentro de
        // "01 Dados Gerais").
        if (cat.subOf) return `${EVIDENCIAS_FOLDER}/${folderName(catByKey[cat.subOf])}/${folderName(cat)}`;
        return `${EVIDENCIAS_FOLDER}/${folderName(cat)}`;
    }
    // Pasta de itens sem categoria reconhecida (fallback de categoryFolder) —
    // também uma subpasta de "01 Dados Gerais" (01.3 Outros).
    const OUTROS_FOLDER = `${EVIDENCIAS_FOLDER}/${folderName(catByKey['DADOS_GERAIS'])}/01.3 Outros`;

    // Title Case pt-BR (iniciais maiúsculas, conectores em minúsculas)
    const TC_MINOR = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'ao', 'aos', 'à', 'às', 'com', 'por', 'para', 'sem', 'sob', 'entre', 'no', 'na', 'nos', 'nas', 'ou']);
    function titleCasePt(s) {
        const toks = String(s == null ? '' : s).toLowerCase().split(/(\s+|\/|-)/);
        let first = true;
        return toks.map(t => {
            if (t === '' || /^\s+$/.test(t) || t === '-') return t;
            if (t === '/') { first = true; return t; }
            const res = (!first && TC_MINOR.has(t)) ? t : t.replace(/\p{L}/u, c => c.toUpperCase());
            first = false;
            return res;
        }).join('');
    }

    return {
        categories: LATTES_CATEGORIES,
        naoLattes: NAO_LATTES_TYPE,
        backupFolder() { return BACKUP_FOLDER; },
        publicacaoFolder() { return PUBLICACAO_FOLDER; },
        lattesXmlFolder() { return LATTES_XML_FOLDER; },
        rscFolder() { return RSC_PCCTAE_FOLDER; },
        sumulaFapespFolder() { return SUMULA_FAPESP_FOLDER; },
        lixeiraFolder() { return LIXEIRA_FOLDER; },
        getType(typeKey) { return TYPES[typeKey] || (typeKey === 'NAO_LATTES' ? NAO_LATTES_TYPE : null); },
        // compat: get() devolve o tipo (independe de categoria)
        get(typeKey) { return this.getType(typeKey); },
        label(typeKey) { const t = this.getType(typeKey); return t ? t.label : typeKey; },
        categoryByKey(catKey) { return catByKey[catKey] || null; },
        categoryLabel(catKey) { const c = catByKey[catKey]; return c ? c.label : (catKey || ''); },
        categoryNumLabel(catKey) { const c = catByKey[catKey]; return c ? `${c.num ? c.num + '. ' : ''}${c.label}` : (catKey || ''); },
        // Itens legados 'NAO_LATTES' (e a antiga categoria 'ATIVIDADES_LIVRES',
        // dividida em categorias próprias) caem na primeira delas por padrão.
        categoryFolder(catKey) {
            if (catKey === 'NAO_LATTES' || catKey === 'ATIVIDADES_LIVRES') return slugFolder(catByKey['AL_DESENVOLVIMENTO']);
            const c = catByKey[catKey]; return c ? slugFolder(c) : OUTROS_FOLDER;
        },
        outrosFolder() { return OUTROS_FOLDER; },
        primaryCategory(typeKey) { return PRIMARY_CATEGORY[typeKey] || 'PRODUCOES'; },
        normalizeType(typeKey) { return LEGACY_TYPE[typeKey] || typeKey; },
        isNaoLattesCategory(catKey) { return catKey === 'NAO_LATTES' || !!(catByKey[catKey] && catByKey[catKey].naoLattes); },
        // Tipos "não-Lattes" por si só (ex.: Conexões), mesmo dentro de uma
        // categoria que normalmente é Lattes (Dados gerais).
        isNaoLattesType(typeKey) { const t = this.getType(typeKey); return !!(t && t.naoLattes); },
        isSingleton(typeKey) { const t = this.getType(typeKey); return !!(t && t.singleton); },
        // Tipos de "perfil" (Dados gerais) editados em Configurações, não em Catalogar
        isPerfilType(typeKey) { const t = this.getType(typeKey); return !!(t && t.perfil); },
        perfilTypes() { return Object.keys(TYPES).filter(k => TYPES[k].perfil); },
        // Estrutura de pastas criada ao configurar o diretório: Caixa de
        // Entrada e Cópia de segurança na raiz (a Caixa ganha a subpasta
        // "Processados" à parte, por Storage.ensureInbox); Exportação
        // (RSC-PCCTAE, Progressão Docentes, Súmula Curricular FAPESP e
        // Lattes XML); Evidências (uma subpasta por categoria); e Publicação
        // para Web e Relatórios — todas de uso manual (o app não grava nelas
        // automaticamente).
        allFolders() {
            return [INBOX_FOLDER, BACKUP_FOLDER, ...EXPORT_FOLDERS, ...LATTES_CATEGORIES.map(slugFolder), ...EXTRA_FOLDERS];
        },
        itemTitle(item) {
            const f = item.fields || {};
            // Formação acadêmica/titulação: exibe "anoInicio-anoFim Nível · Curso"
            // (o campo "titulo" guarda o TCC/dissertação/tese, não serve de rótulo).
            if (item.typeKey === 'FORMACAO_ACADEMICA') {
                const ini = String(f.anoInicio || '').trim();
                const fim = String(f.anoFim || '').trim();
                const periodo = (ini && fim) ? `${ini}-${fim}` : (ini || fim || '');
                const resto = [f.nivel, f.curso].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                const t = [periodo, resto].filter(Boolean).join(' ');
                if (t) return t;
            }
            // Áreas de atuação: hierarquia CNPq/CAPES (Grande área > Área > Subárea > Especialidade)
            if (item.typeKey === 'AREA_ATUACAO') {
                const partes = [f.grandeArea, f.area, f.subarea, f.especialidade].map(x => String(x || '').trim()).filter(Boolean);
                if (partes.length) return partes.map(titleCasePt).join(' > '); // separador ASCII (compatível com ISO-8859-1)
                if (f.areaConhecimento) return titleCasePt(f.areaConhecimento);
            }
            // Atuação profissional: "Cargo/Função" (o ano já aparece à parte no
            // card; o campo "titulo" é só "outras informações", raramente
            // preenchido — sem isso o fallback caía em "instituicao", que se
            // repete em várias atuações na mesma entidade e não diferencia
            // uma da outra).
            if (item.typeKey === 'VINCULO_PROFISSIONAL' && String(f.cargo || '').trim()) return String(f.cargo).trim();
            // Concursos e processos seletivos: "Cargo (Colocação)" (o ano já
            // aparece à parte no card; o campo "titulo" é o nome do concurso,
            // que se repete pouco mas não diz qual foi o cargo/resultado).
            if (item.typeKey === 'AL_CONCURSO') {
                const cargo = String(f.cargo || '').trim(), coloc = String(f.colocacao || '').trim();
                const t = coloc ? `${cargo || f.titulo || ''} (${coloc})`.trim() : cargo;
                if (t) return t;
            }
            // Orientações: "Nome do orientando | Título do trabalho" (o ano já
            // aparece à parte no card).
            if (item.typeKey === 'ORIENTACAO_CONCLUIDA' || item.typeKey === 'ORIENTACAO_ANDAMENTO') {
                const t = [f.orientando, f.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' | ');
                if (t) return t;
            }
            // Documentos pessoais: "Tipo de documento · Descrição/Nº do documento"
            if (item.typeKey === 'DOCUMENTO_PESSOAL') {
                const t = [f.tipoDoc, f.titulo].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                if (t) return t;
            }
            // Identidade (RG) / Passaporte: não têm campo "titulo" — usam "numero"
            if (item.typeKey === 'DOC_IDENTIDADE') {
                const t = [f.numero, f.orgao].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
                if (t) return t;
            }
            if (item.typeKey === 'DOC_PASSAPORTE' && String(f.numero || '').trim()) return String(f.numero).trim();
            // Atuação em crise de saúde pública: "Tipo de situação — Ato que
            // decretou" (não tem campo "titulo" próprio).
            if (item.typeKey === 'RSC_CRISE_SAUDE_ATUACAO') {
                const t = [f.tipoSituacao, f.ato].map(x => String(x || '').trim()).filter(Boolean).join(' — ');
                if (t) return t;
            }
            // Texto inicial do CV / Outras informações: não têm campo "titulo" —
            // mostram um trecho do próprio texto (evita repetir o rótulo do card).
            if (item.typeKey === 'RESUMO_CV' || item.typeKey === 'OUTRAS_INFO') {
                const d = String(f.descricao || '').trim().replace(/\s+/g, ' ');
                if (d) return d.length > 60 ? d.slice(0, 60) + '…' : d;
            }
            return f.titulo || f.curso || f.orientando || f.candidato || f.instituicao || f.nome || '(sem título)';
        },
    };
})();
