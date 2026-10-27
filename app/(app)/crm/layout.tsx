import { CrmTabs } from "./CrmTabs";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <CrmTabs />
      {children}
    </div>
  );
}
