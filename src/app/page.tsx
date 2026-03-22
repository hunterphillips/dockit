import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ProjectSelector from "@/components/ProjectSelector";
import type { Session } from "next-auth";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <ProjectSelector />;
}

export { Session };
