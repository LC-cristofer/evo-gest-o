/**
 * reimport.js — compatibilidade segura
 *
 * O reimportador antigo dependia de uma planilha interna com dados reais e
 * mapeamentos específicos. Essa versão foi removida do repositório público
 * para proteger dados pessoais.
 *
 * Para importar dados de demonstração, use:
 *   node ../scripts/import-spreadsheet.js --file=../funcionarios.xlsx --dry-run
 *
 * Para dados reais em um ambiente privado, forneça a planilha fora do Git e
 * use scripts/import-spreadsheet.js com o arquivo local.
 */

console.log(`
EVO Gestão — importação segura

O reimportador específico da planilha interna foi desativado por privacidade.
Use o importador genérico:

  node ../scripts/import-spreadsheet.js --file=../funcionarios.xlsx --dry-run

O arquivo funcionarios.xlsx versionado neste repositório contém somente
dados fictícios para demonstração.
`);
