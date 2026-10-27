// Parsing da planilha de importação do CRM. Roda no navegador (não é
// Server Action) — fix real de um bug real: mandar o arquivo pro
// servidor via FormData de Server Action batia no limite de tamanho de
// corpo de requisição da Vercel (bem abaixo do bodySizeLimit configurado
// no Next.js, mesmo problema já visto no upload de carrossel do
// Cronograma) e crashava com "Algo deu errado nesta página" pra
// planilhas um pouco maiores. Ler e parsear no cliente evita esse
// limite inteiramente — só os dados já extraídos (linhas + mapeamento)
// vão pro servidor depois, em confirmImport.
//
// .xlsx usa `read-excel-file` em vez de `exceljs`: o bundle de
// navegador do exceljs (dist/exceljs.min.js) tem um bug conhecido de
// leitura no cliente ("Cannot read properties of undefined (reading
// 'sheets')") — funcionava só no servidor. `xlsx`/SheetJS (a
// biblioteca mais popular pra isso) foi descartada por ter
// vulnerabilidade alta sem correção disponível (prototype pollution +
// ReDoS) — risco real aqui, já que é exatamente arquivo enviado pelo
// usuário sendo parseado. `read-excel-file` é mantida, sem
// vulnerabilidades conhecidas, e feita pra rodar no navegador.

export const MAX_IMPORT_ROWS = 500;

export const SYSTEM_FIELDS = [
  { key: "company_name", label: "Nome da empresa", required: true },
  { key: "contact_name", label: "Nome do contato", required: false },
  { key: "role_title", label: "Cargo", required: false },
  { key: "phone", label: "Telefone", required: false },
  { key: "whatsapp", label: "WhatsApp", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "postal_code", label: "CEP", required: false },
  { key: "segment", label: "Segmento", required: false },
  { key: "website", label: "Site", required: false },
  { key: "instagram", label: "Instagram", required: false },
  { key: "other_social_url", label: "Rede social (outra)", required: false },
  { key: "google_business_url", label: "Google Meu Negócio", required: false },
  { key: "bio_link", label: "Link (bio/linktree)", required: false },
  { key: "cnpj", label: "CNPJ", required: false },
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELDS)[number]["key"];

export type ParsedImportFile = {
  headers: string[];
  suggestedMapping: (SystemFieldKey | null)[];
  rows: string[][];
  error?: string;
  truncated?: boolean;
};

// Normaliza (minúsculo, sem acento, sem espaço nas pontas) pra comparar
// cabeçalhos de coluna sem depender de escrita exata.
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const COLUMN_HINTS: Record<SystemFieldKey, string[]> = {
  company_name: ["empresa", "nome da empresa", "company", "razao social", "cliente"],
  contact_name: ["nome", "contato", "nome do contato", "responsavel"],
  role_title: ["cargo", "funcao", "role"],
  phone: ["telefone", "fone", "celular", "tel"],
  whatsapp: ["whatsapp", "whats", "zap"],
  email: ["email", "e-mail"],
  city: ["cidade", "city"],
  postal_code: ["cep", "codigo postal"],
  segment: ["segmento", "setor", "ramo", "nicho"],
  website: ["site", "website"],
  instagram: ["instagram", "insta"],
  other_social_url: ["rede social", "facebook", "tiktok", "linkedin"],
  google_business_url: ["google meu negocio", "google business", "gmn"],
  bio_link: ["linktree", "link na bio", "bio link", "links"],
  cnpj: ["cnpj"],
};

function suggestField(header: string): SystemFieldKey | null {
  const normalized = normalize(header);
  for (const field of SYSTEM_FIELDS) {
    if (COLUMN_HINTS[field.key].some((hint) => normalized.includes(hint))) {
      return field.key;
    }
  }
  return null;
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  return String(v);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === "," || char === ";") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function buildResult(table: string[][]): ParsedImportFile {
  if (table.length === 0) return { headers: [], suggestedMapping: [], rows: [] };
  const headers = table[0].map((h) => h.trim());
  const dataRows = table.slice(1).filter((r) => r.some((c) => c.trim().length > 0));
  const truncated = dataRows.length > MAX_IMPORT_ROWS;
  return {
    headers,
    suggestedMapping: headers.map(suggestField),
    rows: dataRows.slice(0, MAX_IMPORT_ROWS),
    truncated,
  };
}

export async function parseImportFileClient(file: File): Promise<ParsedImportFile> {
  if (!file || file.size === 0) {
    return { headers: [], suggestedMapping: [], rows: [], error: "Selecione um arquivo." };
  }

  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
      const table = lines.map((line) => parseCsvLine(line));
      return buildResult(table);
    }

    if (name.endsWith(".xlsx")) {
      // Carrega só quando precisa (planilha real) — mesma lógica de
      // lazy-load já usada pro recharts, pra não engordar o bundle
      // inicial da tela.
      const { readSheet } = await import("read-excel-file/browser");
      const sheetRows = await readSheet(file);
      if (sheetRows.length === 0) {
        return { headers: [], suggestedMapping: [], rows: [], error: "Planilha vazia." };
      }
      const table = sheetRows.map((row) => row.map((v) => cellToString(v)));
      return buildResult(table);
    }

    if (name.endsWith(".xls")) {
      return {
        headers: [],
        suggestedMapping: [],
        rows: [],
        error:
          ".xls (formato binário antigo) não é suportado — salve como .xlsx ou .csv no Excel/Sheets e tente de novo.",
      };
    }

    return { headers: [], suggestedMapping: [], rows: [], error: "Formato não reconhecido." };
  } catch (e) {
    return {
      headers: [],
      suggestedMapping: [],
      rows: [],
      error: e instanceof Error ? `Falha ao ler o arquivo: ${e.message}` : "Falha ao ler o arquivo.",
    };
  }
}
