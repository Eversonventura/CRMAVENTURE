/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Anexos da linha do tempo aceitam até 15MB; o padrão do Next é 1MB.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  // PDF da proposta (@react-pdf/renderer): a Vercel não rastreia as fontes do
  // pdfkit (require dinâmico), então precisam ser listadas.
  outputFileTracingIncludes: {
    "/crm/propostas/[id]/pdf": [
      "./node_modules/pdfkit/js/data/**/*",
      "./node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

module.exports = nextConfig;
