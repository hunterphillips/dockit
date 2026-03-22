import type { FileChange } from "./github-client";

export interface ProjectConfig {
  displayNames: Record<string, string>;
  icons: Record<string, string>;
}

export const DEFAULT_CONFIG: ProjectConfig = {
  displayNames: {
    "business-logic": "Business Logic",
    integrations: "Integrations",
    "roles-and-access": "Roles & Access",
    decisions: "Decisions",
  },
  icons: {
    "business-logic": "layers",
    integrations: "link",
    "roles-and-access": "users",
    decisions: "bookmark",
  },
};

const indexContent = (section: string, description: string) => `# ${section}

${description}
`;

const docContent = (title: string, placeholder: string) => `# ${title}

${placeholder}
`;

export function getScaffoldFiles(): FileChange[] {
  return [
    {
      path: "docs/.meta/config.json",
      content: JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
    },
    {
      path: "docs/.meta/assets/diagrams/_index.md",
      content: indexContent("Diagrams", "System diagrams and architecture visualizations."),
    },
    {
      path: "docs/.meta/assets/screenshots/_index.md",
      content: indexContent("Screenshots", "UI screenshots and visual references."),
    },
    {
      path: "docs/overview.md",
      content: docContent(
        "Overview",
        "A high-level description of this system — what it does, who uses it, and why it exists."
      ),
    },
    {
      path: "docs/business-logic/data-model.md",
      content: docContent(
        "Data Model",
        "Describe the core entities, their attributes, and how they relate to each other."
      ),
    },
    {
      path: "docs/business-logic/workflows.md",
      content: docContent(
        "Workflows",
        "Document the key business processes and end-to-end flows through the system."
      ),
    },
    {
      path: "docs/business-logic/rules-and-policies.md",
      content: docContent(
        "Rules & Policies",
        "Capture business rules, validation logic, and operational policies."
      ),
    },
    {
      path: "docs/integrations/inbound/_index.md",
      content: indexContent(
        "Inbound Integrations",
        "Systems that send data into this application — APIs consumed, webhooks received, file imports."
      ),
    },
    {
      path: "docs/integrations/outbound/_index.md",
      content: indexContent(
        "Outbound Integrations",
        "Systems this application sends data to — APIs called, events published, exports produced."
      ),
    },
    {
      path: "docs/roles-and-access/personas.md",
      content: docContent(
        "Personas",
        "Describe the types of users who interact with this system and their goals."
      ),
    },
    {
      path: "docs/roles-and-access/access-matrix.md",
      content: docContent(
        "Access Matrix",
        "Map roles to permissions — what each persona can see, create, edit, and delete."
      ),
    },
    {
      path: "docs/decisions/_index.md",
      content: indexContent(
        "Decisions",
        "A record of significant architectural and product decisions. Each file is one decision."
      ),
    },
    {
      path: "docs/glossary.md",
      content: docContent(
        "Glossary",
        "Definitions for domain-specific terms, abbreviations, and jargon used across this system's documentation."
      ),
    },
  ];
}

// Parse config.json from a fetched string
export function parseConfig(raw: string): ProjectConfig {
  try {
    return JSON.parse(raw) as ProjectConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Resolve a display name for a path segment
export function getDisplayName(segment: string, config?: ProjectConfig): string {
  const map = config?.displayNames ?? DEFAULT_CONFIG.displayNames;
  return (
    map[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
