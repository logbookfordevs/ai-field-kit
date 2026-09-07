# Use one Portable Agent File

Each v1 Custom Agent source will be one Markdown file with structured frontmatter and an instruction body. Catalog entries point directly to that file, and the catalog entry ID must match the file's Agent Name. The catalog may provide presentation labels, while runtime description and behavior remain source-owned. AFK translates the file through Harness Adapters; multi-file agent packages are deferred until a concrete need for supporting assets justifies the additional source and installation semantics.
