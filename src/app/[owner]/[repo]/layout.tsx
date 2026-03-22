import { ProjectProvider } from "@/context/ProjectContext";
import AppShell from "@/components/layout/AppShell";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  return (
    <ProjectLayoutInner params={params}>{children}</ProjectLayoutInner>
  );
}

async function ProjectLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return (
    <ProjectProvider owner={owner} repo={repo}>
      <AppShell owner={owner} repo={repo}>
        {children}
      </AppShell>
    </ProjectProvider>
  );
}
