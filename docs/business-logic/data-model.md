 # Data Model

  Dockit has no application database for document content. All persistent state lives in a GitHub repository. The entities below are logical — they map directly to files and
  directories on GitHub.

  ## Repository (Project)

  The top-level container. A Dockit project is a one-to-one mapping with a GitHub repository.                                                                                   
   
  | Attribute | Source |                                                                                                                                                        
  |---|---|                                                 
  | Owner | GitHub org or username |
  | Name | GitHub repository name |                                                                                                                                             
  | Default branch | Resolved from GitHub API (`main` assumed as fallback) |
  | Has docs | Whether a `docs/` directory exists in the repository |                                                                                                           
                                                                                                                                                                                
  A repository must have a `docs/` folder to be opened in Dockit. Repositories without one can be initialized via the scaffold flow.                                            
                                                                                                                                                                                
  ## Document                                                                                                                                                                   
                                                            
  A single markdown file under `docs/`.                                                                                                                                         
   
  | Attribute | Source |                                                                                                                                                        
  |---|---|                                                 
  | Path | Full file path within the repository (e.g. `docs/business-logic/workflows.md`) |
  | Content | Raw markdown string, decoded from GitHub's base64 response |
  | SHA | GitHub content hash for this version of the file |                                                                                                                    
  | Title | Extracted from the first `# Heading` in the content, or derived from the filename |                                                                                 
                                                                                                                                                                                
  The SHA is the only concurrency mechanism. It is stored client-side while a document is open and submitted on every write. GitHub rejects writes with a stale SHA — Dockit    
  surfaces this as a conflict.                                                                                                                                                  
                                                                                                                                                                                
  ## Section                                                                                                                                                                    
   
  A subdirectory under `docs/`. Sections have no explicit metadata file of their own — their display name and icon are defined in `docs/.meta/config.json`.                     
                                                            
  | Attribute | Source |                                                                                                                                                        
  |---|---|                                                 
  | Path | Directory path (e.g. `docs/business-logic/`) |
  | Display name | `config.json` → `displayNames` map, or title-cased from directory name |                                                                                     
  | Icon | `config.json` → `icons` map |                                                                                                                                        
  | Landing page | `_index.md` inside the directory, if present |                                                                                                               
                                                                                                                                                                                
  ## Config                                                                                                                                                                     
                                                                                                                                                                                
  `docs/.meta/config.json` holds project-level display configuration. It is read on every project load and used to label sections in the sidebar.                               
                                                            
  ```json                                                                                                                                                                       
  {                                                         
    "displayNames": {                                                                                                                                                           
      "business-logic": "Business Logic",                                                                                                                                       
      "integrations": "Integrations"
    },                                                                                                                                                                          
    "icons": {                                              
      "business-logic": "layers",                                                                                                                                               
      "integrations": "link"                                                                                                                                                    
    }                                                                                                                                                                           
  }                                                                                                                                                                             
                                                                                                                                                                                
  Asset                                                     

  A binary file (image, diagram, screenshot) stored in docs/.meta/assets/. Assets are committed to GitHub and referenced by relative path from the document that embeds them.   
  
  ┌───────────┬───────────────────────────────────────────────────────────────┐                                                                                                 
  │ Attribute │                            Source                             │
  ├───────────┼───────────────────────────────────────────────────────────────┤
  │ Path      │ docs/.meta/assets/diagrams/ or docs/.meta/assets/screenshots/ │
  ├───────────┼───────────────────────────────────────────────────────────────┤
  │ Content   │ Base64-encoded, committed directly via the GitHub file API    │                                                                                                 
  ├───────────┼───────────────────────────────────────────────────────────────┤                                                                                                 
  │ Reference │ Relative markdown image link in the embedding document        │                                                                                                 
  └───────────┴───────────────────────────────────────────────────────────────┘                                                                                                 
       
