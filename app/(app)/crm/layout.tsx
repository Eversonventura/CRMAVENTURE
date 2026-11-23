// A navegação do CRM fica no menu lateral (components/AppSidebar.tsx).
import { CrmSettingsProvider } from "./CrmSettingsContext";
import { getCrmSettings } from "./settings";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const settings = await getCrmSettings();
  return (
    <CrmSettingsProvider settings={settings}>
      <div>{children}</div>
    </CrmSettingsProvider>
  );
}
