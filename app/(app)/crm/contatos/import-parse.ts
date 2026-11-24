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

export const MAX_IMPORT_ROWS = 1000;

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
  // Dados do lead (valem para B2B e B2C)
  { key: "entry_date", label: "Data de entrada do lead", required: false },
  { key: "acquisition_channel", label: "Origem (canal de aquisição)", required: false },
  { key: "priority", label: "Prioridade", required: false },
  { key: "temperature", label: "Temperatura (quente/morno/frio)", required: false },
  { key: "notes", label: "Observação interna", required: false },
  { key: "activity", label: "Comentários e atividade (vai pra linha do tempo)", required: false },
  { key: "stage", label: "Etapa do fluxo", required: false },
  { key: "responsible", label: "Responsável (vendedor)", required: false },
  { key: "estimated_value", label: "Valor estimado (R$)", required: false },
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
  company_name: ["empresa", "nome da empresa", "company", "razao social"],
  contact_name: ["nome", "contato", "nome do contato", "cliente"],
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
  entry_date: ["dia de entrada", "data de entrada", "data do lead", "data de cadastro", "entrada", "cadastro", "data"],
  acquisition_channel: ["origem", "canal", "fonte"],
  priority: ["prioridade"],
  temperature: ["temperatura"],
  notes: ["observacao", "observacoes", "obs", "anotacao"],
  activity: ["comentario", "atividade", "historico", "acompanhamento", "andamento"],
  stage: ["etapa", "fase"],
  responsible: ["responsavel", "vendedor", "atendente", "consultor"],
  estimated_value: ["valor", "ticket", "honorario"],
};

// Campos que o formulário da conta mostra (B2C não tem empresa; redes e site só agência de marketing;
// meta por contratos não pede valor). Usado para listar só o que faz sentido no mapeamento.
export function importFieldsFor(opts: { isB2C: boolean; showOnline: boolean; byContracts: boolean }) {
  const companyOnly: SystemFieldKey[] = ["company_name", "role_title", "cnpj", "segment"];
  const onlineOnly: SystemFieldKey[] = ["website", "instagram", "other_social_url", "google_business_url", "bio_link"];
  return SYSTEM_FIELDS.filter((f) => {
    if (opts.isB2C && companyOnly.includes(f.key)) return false;
    if (!opts.showOnline && onlineOnly.includes(f.key)) return false;
    if (opts.byContracts && f.key === "estimated_value") return false;
    return true;
  });
}

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
  // Cada campo é sugerido para uma coluna só (a primeira que combina).
  const used = new Set<SystemFieldKey>();
  const suggestedMapping = headers.map((h) => {
    const f = suggestField(h);
    if (!f || used.has(f)) return null;
    used.add(f);
    return f;
  });
  return {
    headers,
    suggestedMapping,
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


// ---- Conversões usadas na importação (datas e valores como aparecem em planilhas brasileiras) ----

// "17/09/2026", "17/09/26", "17-09-2026", "2026-09-17" → "2026-09-17" (ou null).
export function parseSheetDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  let match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/);
    if (!match) return null;
    [d, m] = [Number(match[1]), Number(match[2])];
    y = Number(match[3]);
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  // Confere se o dia existe de verdade (31/02 não existe).
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// "1.500,00", "R$ 1500", "1500.5" → número (ou null).
export function parseSheetNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/(\.)(?=\d{3}(\D|$))/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Sem acento, minúsculo, sem espaços nas pontas: compara textos da planilha com os da conta.
export function normalizeText(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
