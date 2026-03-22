 # Glossary

  Definitions for terms used across this project's documentation.

  | Term | Definition |
  |---|---|
  | **Repository** | A GitHub repository used as the storage backend for a Dockit project. All documents live here as committed files. |
  | **Document** | A single markdown file under `docs/`. Rendered as a formatted page in the Dockit UI. |
  | **Section** | A subdirectory under `docs/` that groups related documents (e.g. `business-logic/`, `integrations/`). |
  | **Asset** | An image or binary file stored in `docs/.meta/assets/` and embedded in documents. |
  | **Scaffold** | The one-time initialization of the `docs/` folder structure in a repository, creating all default sections and placeholder files. |
  | **SHA** | A content hash assigned by GitHub to every file version. Dockit uses it to detect conflicting edits — if two people edit the same file simultaneously, only the first save succeeds. |
  | **Conflict** | What occurs when a document has been saved by someone else since you opened it. Dockit shows a conflict banner; the user must reload to get the latest version before saving. |
  | **WYSIWYG** | "What You See Is What You Get." The editing experience in Dockit — users edit formatted text, never raw markdown. |
  | **`_index.md`** | A special file that acts as the landing page for a section. It is not listed individually in the sidebar — instead, the parent folder itself is clickable. |
  | **`.meta/`** | A hidden directory inside `docs/` used for internal configuration (`config.json`) and uploaded assets. Never shown in the UI. |
  | **Frontmatter** | YAML metadata at the top of a markdown file (e.g. `title`, `status`, `date`). Used by decision records; stripped from the rendered view. |
  | **AI Assistant** | The built-in chat panel powered by Claude. Supports Q&A against all project documentation and AI-suggested edits with a diff review step before committing. |
  | **Share Link** | A read-only URL that grants access to a project's documentation without requiring a GitHub account. *(coming soon)* |
